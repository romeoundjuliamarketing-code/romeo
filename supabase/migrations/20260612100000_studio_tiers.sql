-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: split studio tier into studio_visibility and studio_suite
--
-- Changes:
--   a) Migrate existing 'studio' rows → 'studio_suite', then swap CHECK constraint.
--   b) SQL helper: entitlement_allows(p_tier, p_feature) IMMUTABLE.
--   c) Rewrite get_my_entitlement() with new columns.
--   d) Add server-side tier gates to protected RPCs.
--   e) Announcement INSERT RLS: restrict to studio_suite owners/coaches.
--   f) grant_studio_tier RPC (service_role only).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── a) Upgrade existing 'studio' rows before swapping the constraint ───────────

UPDATE public.subscriptions
SET tier = 'studio_suite'
WHERE tier = 'studio';

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_tier_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_tier_check
  CHECK (tier IN ('individual', 'studio_visibility', 'studio_suite'));

-- ── b) SQL helper: entitlement_allows ────────────────────────────────────────
-- Mirrors the TypeScript tierAllows() function in src/utils/entitlementTier.ts.
-- IMMUTABLE because the result depends only on the two input strings.

CREATE OR REPLACE FUNCTION public.entitlement_allows(p_tier text, p_feature text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_tier = 'studio_suite' THEN
      p_feature IN (
        'create_studio', 'manage_studio', 'map_visibility', 'invite_members',
        'trial_bookings', 'drop_in',
        'announce', 'manage_memberships', 'coach_system', 'attendance'
      )
    WHEN p_tier = 'studio_visibility' THEN
      p_feature IN (
        'create_studio', 'manage_studio', 'map_visibility', 'invite_members',
        'trial_bookings', 'drop_in'
      )
    ELSE false
  END;
$$;

GRANT EXECUTE ON FUNCTION public.entitlement_allows(text, text) TO authenticated;

-- ── c) Rewrite get_my_entitlement() ──────────────────────────────────────────
-- New columns: can_manage_studio, can_announce, can_manage_memberships.
-- Member branch (source='studio'): has_access only when owner tier = studio_suite;
--   all can_* flags = false (members are not owners).
-- Individual direct sub: has_access = true, all studio can_* = false.

CREATE OR REPLACE FUNCTION public.get_my_entitlement()
RETURNS TABLE (
  has_access            boolean,
  tier                  text,
  source                text,
  can_create_studio     boolean,
  can_manage_studio     boolean,
  can_announce          boolean,
  can_manage_memberships boolean,
  included_seats        integer,
  used_seats            integer,
  extra_seats           integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  direct_sub       subscriptions%ROWTYPE;
  studio_sub       subscriptions%ROWTYPE;
  active_members   integer := 0;
BEGIN
  -- 1. Check for a direct subscription belonging to the current user.
  SELECT *
  INTO direct_sub
  FROM subscriptions s
  WHERE s.user_id = auth.uid()
    AND s.status IN ('active', 'trialing', 'past_due')
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  LIMIT 1;

  IF direct_sub.id IS NOT NULL THEN
    SELECT count(*)
    INTO active_members
    FROM studio_memberships sm
    WHERE sm.subscription_id = direct_sub.id
      AND sm.status = 'active';

    RETURN QUERY SELECT
      true,
      direct_sub.tier,
      'direct'::text,
      entitlement_allows(direct_sub.tier, 'create_studio'),
      entitlement_allows(direct_sub.tier, 'manage_studio'),
      entitlement_allows(direct_sub.tier, 'announce'),
      entitlement_allows(direct_sub.tier, 'manage_memberships'),
      direct_sub.included_seats,
      active_members,
      direct_sub.extra_seats;
    RETURN;
  END IF;

  -- 2. Check for access via a studio membership (user is a member of a studio).
  --    The studio's owner must have an active subscription; the tier of that
  --    subscription determines whether the member gets has_access.
  SELECT s.*
  INTO studio_sub
  FROM studio_memberships sm
  JOIN subscriptions s ON s.id = sm.subscription_id
  WHERE sm.user_id = auth.uid()
    AND sm.status = 'active'
    AND s.status IN ('active', 'trialing', 'past_due')
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  LIMIT 1;

  IF studio_sub.id IS NOT NULL THEN
    SELECT count(*)
    INTO active_members
    FROM studio_memberships sm
    WHERE sm.subscription_id = studio_sub.id
      AND sm.status = 'active';

    RETURN QUERY SELECT
      -- members only get access when the studio is on studio_suite
      (studio_sub.tier = 'studio_suite'),
      studio_sub.tier,
      'studio'::text,
      -- members are never owners; no studio management flags for them
      false,
      false,
      false,
      false,
      studio_sub.included_seats,
      active_members,
      studio_sub.extra_seats;
    RETURN;
  END IF;

  -- 3. No subscription found.
  RETURN QUERY SELECT false, NULL::text, NULL::text, false, false, false, false, 0, 0, 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_entitlement() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_entitlement() FROM anon;

-- ── d) Server-side tier gates for protected RPCs ──────────────────────────────

-- ── d1. create_studio_with_owner — requires create_studio (visibility+) ───────

CREATE OR REPLACE FUNCTION public.create_studio_with_owner(
  p_name text,
  p_city text
)
RETURNS TABLE (
  id   uuid,
  name text,
  city text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier text;
BEGIN
  SELECT s.tier
  INTO v_tier
  FROM subscriptions s
  WHERE s.user_id = auth.uid()
    AND s.status IN ('active', 'trialing', 'past_due')
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  LIMIT 1;

  IF NOT entitlement_allows(v_tier, 'create_studio') THEN
    RAISE EXCEPTION 'Studio-Abo erforderlich';
  END IF;

  RETURN QUERY
  WITH created AS (
    INSERT INTO studios (name, city, owner_user_id)
    VALUES (trim(p_name), trim(p_city), auth.uid())
    RETURNING studios.id, studios.name, studios.city
  )
  SELECT created.id, created.name, created.city
  FROM created;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_studio_with_owner(text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_studio_with_owner(text, text) FROM anon;

-- ── d2. accept_studio_invite — requires invite_members on the STUDIO OWNER's tier

CREATE OR REPLACE FUNCTION public.accept_studio_invite(p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio_id       uuid;
  v_subscription_id uuid;
  v_owner_tier      text;
BEGIN
  SELECT studio_id INTO v_studio_id
  FROM public.studio_invite_codes
  WHERE upper(code) = upper(p_code) AND expires_at > now();

  IF v_studio_id IS NULL THEN
    RAISE EXCEPTION 'Ungültiger oder abgelaufener Code';
  END IF;

  -- Resolve the studio owner's active subscription and its tier.
  SELECT sub.id, sub.tier
  INTO v_subscription_id, v_owner_tier
  FROM public.subscriptions sub
  JOIN public.studios s ON s.owner_user_id = sub.user_id
  WHERE s.id = v_studio_id
    AND sub.status IN ('active', 'trialing', 'past_due')
    AND (sub.current_period_end IS NULL OR sub.current_period_end > now())
  LIMIT 1;

  IF v_subscription_id IS NULL OR NOT entitlement_allows(v_owner_tier, 'invite_members') THEN
    RAISE EXCEPTION 'Studio hat kein aktives Abo';
  END IF;

  INSERT INTO public.studio_memberships (subscription_id, user_id)
  VALUES (v_subscription_id, auth.uid())
  ON CONFLICT (subscription_id, user_id) DO NOTHING;

  UPDATE public.profiles
  SET studio_id = v_studio_id
  WHERE id = auth.uid();

  RETURN v_studio_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_studio_invite(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_studio_invite(text) FROM anon;

-- ── d3. get_subscribed_studios — filter to map_visibility (visibility+) ────────

CREATE OR REPLACE FUNCTION public.get_subscribed_studios()
RETURNS TABLE (
  id      uuid,
  name    text,
  city    text,
  address text,
  lat     double precision,
  lng     double precision
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.city, s.address, s.lat, s.lng
  FROM studios s
  JOIN subscriptions sub ON sub.user_id = s.owner_user_id
  WHERE entitlement_allows(sub.tier, 'map_visibility')
    AND sub.status IN ('active', 'trialing', 'past_due')
    AND (sub.current_period_end IS NULL OR sub.current_period_end > now())
    AND s.lat IS NOT NULL
    AND s.lng IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_subscribed_studios() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_subscribed_studios() FROM anon;

-- ── d4. sign_membership — requires manage_memberships on STUDIO OWNER's tier ───

CREATE OR REPLACE FUNCTION public.sign_membership(p_plan_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan       RECORD;
  v_id         uuid;
  v_name       text;
  v_owner_tier text;
BEGIN
  -- Load plan; error if not found or inactive.
  SELECT id, studio_id, name, price_cents, billing_interval, min_term_months, is_active
  INTO v_plan
  FROM studio_membership_plans
  WHERE id = p_plan_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dieser Tarif existiert nicht.';
  END IF;

  IF NOT v_plan.is_active THEN
    RAISE EXCEPTION 'Dieser Tarif ist nicht mehr verfügbar.';
  END IF;

  -- Require the studio owner to have studio_suite.
  SELECT sub.tier
  INTO v_owner_tier
  FROM subscriptions sub
  JOIN studios s ON s.owner_user_id = sub.user_id
  WHERE s.id = v_plan.studio_id
    AND sub.status IN ('active', 'trialing', 'past_due')
    AND (sub.current_period_end IS NULL OR sub.current_period_end > now())
  LIMIT 1;

  IF NOT entitlement_allows(v_owner_tier, 'manage_memberships') THEN
    RAISE EXCEPTION 'Studio Suite erforderlich';
  END IF;

  -- Guard: no concurrent active/pending contract for the same studio.
  IF EXISTS (
    SELECT 1
    FROM studio_member_contracts
    WHERE user_id   = auth.uid()
      AND studio_id = v_plan.studio_id
      AND status    IN ('pending', 'active', 'cancellation_requested')
  ) THEN
    RAISE EXCEPTION 'Du hast bereits eine laufende Mitgliedschaft oder Anfrage bei diesem Studio.';
  END IF;

  INSERT INTO studio_member_contracts (
    user_id,
    studio_id,
    plan_id,
    plan_name_snapshot,
    price_cents_snapshot,
    billing_interval_snapshot,
    min_term_months_snapshot,
    status
  )
  VALUES (
    auth.uid(),
    v_plan.studio_id,
    v_plan.id,
    v_plan.name,
    v_plan.price_cents,
    v_plan.billing_interval,
    v_plan.min_term_months,
    'pending'
  )
  RETURNING id INTO v_id;

  -- Load requester name for notification text.
  SELECT COALESCE(name, 'Jemand') INTO v_name
  FROM profiles
  WHERE id = auth.uid();

  PERFORM notify_studio_staff(
    v_plan.studio_id,
    'membership_requested',
    'Neue Mitgliedschaftsanfrage',
    v_name || ' möchte eine Mitgliedschaft (' || v_plan.name || ').',
    jsonb_build_object('contract_id', v_id, 'studio_id', v_plan.studio_id),
    auth.uid()
  );

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sign_membership(uuid) TO authenticated;

-- ── d5. respond_membership_request — requires manage_memberships on OWNER tier ─

CREATE OR REPLACE FUNCTION public.respond_membership_request(
  p_id      uuid,
  p_confirm boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid;
  v_studio_id   uuid;
  v_status      text;
  v_studio_name text;
  v_owner_tier  text;
BEGIN
  SELECT user_id, studio_id, status
  INTO v_user_id, v_studio_id, v_status
  FROM studio_member_contracts
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vertrag nicht gefunden.';
  END IF;

  IF NOT is_studio_staff(v_studio_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung, um diesen Antrag zu beantworten.';
  END IF;

  -- Require studio_suite for membership management.
  SELECT sub.tier
  INTO v_owner_tier
  FROM subscriptions sub
  JOIN studios s ON s.owner_user_id = sub.user_id
  WHERE s.id = v_studio_id
    AND sub.status IN ('active', 'trialing', 'past_due')
    AND (sub.current_period_end IS NULL OR sub.current_period_end > now())
  LIMIT 1;

  IF NOT entitlement_allows(v_owner_tier, 'manage_memberships') THEN
    RAISE EXCEPTION 'Studio Suite erforderlich';
  END IF;

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Nur ausstehende Anträge können beantwortet werden.';
  END IF;

  -- Load studio name for notification text.
  SELECT name INTO v_studio_name
  FROM studios
  WHERE id = v_studio_id;

  IF p_confirm THEN
    UPDATE studio_member_contracts
    SET
      status       = 'active',
      start_date   = current_date,
      responded_by = auth.uid(),
      updated_at   = now()
    WHERE id = p_id;

    PERFORM notify_user(
      v_user_id,
      'membership_confirmed',
      'Mitgliedschaft bestätigt',
      'Deine Mitgliedschaft bei ' || COALESCE(v_studio_name, 'dem Studio') || ' ist aktiv.',
      jsonb_build_object('contract_id', p_id, 'studio_id', v_studio_id)
    );
  ELSE
    UPDATE studio_member_contracts
    SET
      status       = 'declined',
      responded_by = auth.uid(),
      updated_at   = now()
    WHERE id = p_id;

    PERFORM notify_user(
      v_user_id,
      'membership_declined',
      'Mitgliedschaftsanfrage abgelehnt',
      'Deine Mitgliedschaftsanfrage bei ' || COALESCE(v_studio_name, 'dem Studio') || ' wurde leider abgelehnt.',
      jsonb_build_object('contract_id', p_id, 'studio_id', v_studio_id)
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_membership_request(uuid, boolean) TO authenticated;

-- ── d6. request_membership_cancellation — requires manage_memberships ───────────

CREATE OR REPLACE FUNCTION public.request_membership_cancellation(p_contract_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio_id  uuid;
  v_status     text;
  v_name       text;
  v_owner_tier text;
BEGIN
  SELECT studio_id, status
  INTO v_studio_id, v_status
  FROM studio_member_contracts
  WHERE id = p_contract_id
    AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vertrag nicht gefunden.';
  END IF;

  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Nur aktive Mitgliedschaften können gekündigt werden.';
  END IF;

  -- Require studio_suite for membership management.
  SELECT sub.tier
  INTO v_owner_tier
  FROM subscriptions sub
  JOIN studios s ON s.owner_user_id = sub.user_id
  WHERE s.id = v_studio_id
    AND sub.status IN ('active', 'trialing', 'past_due')
    AND (sub.current_period_end IS NULL OR sub.current_period_end > now())
  LIMIT 1;

  IF NOT entitlement_allows(v_owner_tier, 'manage_memberships') THEN
    RAISE EXCEPTION 'Studio Suite erforderlich';
  END IF;

  UPDATE studio_member_contracts
  SET
    status               = 'cancellation_requested',
    cancel_requested_at  = now(),
    updated_at           = now()
  WHERE id = p_contract_id;

  -- Load requester name for notification text.
  SELECT COALESCE(name, 'Jemand') INTO v_name
  FROM profiles
  WHERE id = auth.uid();

  PERFORM notify_studio_staff(
    v_studio_id,
    'cancellation_requested',
    'Kündigung eingegangen',
    v_name || ' hat die Mitgliedschaft gekündigt.',
    jsonb_build_object('contract_id', p_contract_id, 'studio_id', v_studio_id),
    auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_membership_cancellation(uuid) TO authenticated;

-- ── d7. confirm_membership_end — requires manage_memberships on OWNER tier ──────

CREATE OR REPLACE FUNCTION public.confirm_membership_end(p_contract_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid;
  v_studio_id   uuid;
  v_status      text;
  v_studio_name text;
  v_owner_tier  text;
BEGIN
  SELECT user_id, studio_id, status
  INTO v_user_id, v_studio_id, v_status
  FROM studio_member_contracts
  WHERE id = p_contract_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vertrag nicht gefunden.';
  END IF;

  IF NOT is_studio_staff(v_studio_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung, um diese Kündigung zu bestätigen.';
  END IF;

  -- Require studio_suite for membership management.
  SELECT sub.tier
  INTO v_owner_tier
  FROM subscriptions sub
  JOIN studios s ON s.owner_user_id = sub.user_id
  WHERE s.id = v_studio_id
    AND sub.status IN ('active', 'trialing', 'past_due')
    AND (sub.current_period_end IS NULL OR sub.current_period_end > now())
  LIMIT 1;

  IF NOT entitlement_allows(v_owner_tier, 'manage_memberships') THEN
    RAISE EXCEPTION 'Studio Suite erforderlich';
  END IF;

  IF v_status <> 'cancellation_requested' THEN
    RAISE EXCEPTION 'Nur Verträge mit laufender Kündigung können beendet werden.';
  END IF;

  -- Load studio name for notification text.
  SELECT name INTO v_studio_name
  FROM studios
  WHERE id = v_studio_id;

  UPDATE studio_member_contracts
  SET
    status       = 'ended',
    ended_at     = current_date,
    responded_by = auth.uid(),
    updated_at   = now()
  WHERE id = p_contract_id;

  PERFORM notify_user(
    v_user_id,
    'membership_ended',
    'Mitgliedschaft beendet',
    'Deine Mitgliedschaft bei ' || COALESCE(v_studio_name, 'dem Studio') || ' wurde beendet.',
    jsonb_build_object('contract_id', p_contract_id, 'studio_id', v_studio_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_membership_end(uuid) TO authenticated;

-- ── d8. create_drop_in_booking — requires drop_in (visibility+) ────────────────

CREATE OR REPLACE FUNCTION public.create_drop_in_booking(
  p_studio_id      uuid,
  p_schedule_id    uuid,
  p_requested_date date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_enabled    boolean;
  v_booking_id uuid;
  v_owner_tier text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nicht eingeloggt.';
  END IF;

  -- Require the studio owner to have at least studio_visibility for drop-in.
  SELECT sub.tier
  INTO v_owner_tier
  FROM subscriptions sub
  JOIN studios s ON s.owner_user_id = sub.user_id
  WHERE s.id = p_studio_id
    AND sub.status IN ('active', 'trialing', 'past_due')
    AND (sub.current_period_end IS NULL OR sub.current_period_end > now())
  LIMIT 1;

  IF NOT entitlement_allows(v_owner_tier, 'drop_in') THEN
    RAISE EXCEPTION 'Studio Suite erforderlich';
  END IF;

  -- Verify drop_in_enabled for this session.
  SELECT drop_in_enabled INTO v_enabled
  FROM studio_schedule
  WHERE id = p_schedule_id AND studio_id = p_studio_id AND is_active = true;

  IF NOT FOUND OR NOT v_enabled THEN
    RAISE EXCEPTION 'Diese Einheit erlaubt keine Drop-in-Buchungen.';
  END IF;

  -- Prevent duplicate pending/confirmed drop-in for same session+date.
  IF EXISTS (
    SELECT 1 FROM trial_bookings
    WHERE user_id        = v_user_id
      AND studio_id      = p_studio_id
      AND schedule_id    = p_schedule_id
      AND requested_date = p_requested_date
      AND booking_type   = 'drop_in'
      AND status         IN ('pending', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'Du hast für diese Einheit bereits eine Buchung.';
  END IF;

  INSERT INTO trial_bookings (
    user_id, studio_id, schedule_id, requested_date,
    booking_type, status
  )
  VALUES (
    v_user_id, p_studio_id, p_schedule_id, p_requested_date,
    'drop_in', 'pending'
  )
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_drop_in_booking(uuid, uuid, date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_drop_in_booking(uuid, uuid, date) FROM anon;

-- ── d9. request_trial_booking — requires trial_bookings (visibility+) ────────

CREATE OR REPLACE FUNCTION public.request_trial_booking(
  p_studio_id   uuid,
  p_schedule_id uuid,
  p_date        date,
  p_note        text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id         uuid;
  v_owner_tier text;
BEGIN
  -- Require the studio owner to have at least studio_visibility for trial bookings.
  SELECT sub.tier
  INTO v_owner_tier
  FROM subscriptions sub
  JOIN studios s ON s.owner_user_id = sub.user_id
  WHERE s.id = p_studio_id
    AND sub.status IN ('active', 'trialing', 'past_due')
    AND (sub.current_period_end IS NULL OR sub.current_period_end > now())
  LIMIT 1;

  IF NOT entitlement_allows(v_owner_tier, 'trial_bookings') THEN
    RAISE EXCEPTION 'Studio-Abo erforderlich';
  END IF;

  -- Guard: only one pending request per studio.
  IF EXISTS (
    SELECT 1
    FROM trial_bookings
    WHERE user_id   = auth.uid()
      AND studio_id = p_studio_id
      AND status    = 'pending'
  ) THEN
    RAISE EXCEPTION 'Es existiert bereits eine offene Probetraining-Anfrage für dieses Studio.';
  END IF;

  INSERT INTO trial_bookings (user_id, studio_id, schedule_id, requested_date, note, status)
  VALUES (auth.uid(), p_studio_id, p_schedule_id, p_date, p_note, 'pending')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_trial_booking(uuid, uuid, date, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.request_trial_booking(uuid, uuid, date, text) FROM anon;

-- ── d10. respond_trial_booking — requires trial_bookings (visibility+) ────────

CREATE OR REPLACE FUNCTION public.respond_trial_booking(
  p_id      uuid,
  p_confirm boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio_id  uuid;
  v_status     text;
  v_owner_tier text;
BEGIN
  SELECT studio_id, status
  INTO v_studio_id, v_status
  FROM trial_bookings
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Buchung nicht gefunden.';
  END IF;

  IF NOT is_studio_staff(v_studio_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung, um diese Buchung zu beantworten.';
  END IF;

  -- Require the studio owner to have at least studio_visibility.
  SELECT sub.tier
  INTO v_owner_tier
  FROM subscriptions sub
  JOIN studios s ON s.owner_user_id = sub.user_id
  WHERE s.id = v_studio_id
    AND sub.status IN ('active', 'trialing', 'past_due')
    AND (sub.current_period_end IS NULL OR sub.current_period_end > now())
  LIMIT 1;

  IF NOT entitlement_allows(v_owner_tier, 'trial_bookings') THEN
    RAISE EXCEPTION 'Studio-Abo erforderlich';
  END IF;

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Nur ausstehende Buchungen können beantwortet werden.';
  END IF;

  UPDATE trial_bookings
  SET
    status       = CASE WHEN p_confirm THEN 'confirmed' ELSE 'declined' END,
    responded_at = now(),
    responded_by = auth.uid(),
    updated_at   = now()
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_trial_booking(uuid, boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.respond_trial_booking(uuid, boolean) FROM anon;

-- ── e) Announcement INSERT RLS: restrict to studio_suite owners/coaches ────────
-- Helper to look up the studio owner's active subscription tier for a given
-- studio. SECURITY DEFINER avoids RLS recursion (mirrors get_my_studio_id pattern).

CREATE OR REPLACE FUNCTION public.get_studio_owner_tier(p_studio_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sub.tier
  FROM subscriptions sub
  JOIN studios s ON s.owner_user_id = sub.user_id
  WHERE s.id = p_studio_id
    AND sub.status IN ('active', 'trialing', 'past_due')
    AND (sub.current_period_end IS NULL OR sub.current_period_end > now())
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_studio_owner_tier(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_studio_owner_tier(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_studio_owner_tier(uuid) TO service_role;

-- Replace (or create) the INSERT policy on team_announcements.
-- Allowed inserters: a coach of the studio (is_coach = true, studio_id matches),
--   AND the studio must have studio_suite.
-- The helper is SECURITY DEFINER so it can safely query subscriptions + studios
-- without triggering recursive RLS evaluation.

DROP POLICY IF EXISTS "team_announcements_insert" ON public.team_announcements;
DROP POLICY IF EXISTS "coaches_can_announce" ON public.team_announcements;

CREATE POLICY "team_announcements_insert_suite_only"
  ON public.team_announcements
  FOR INSERT
  WITH CHECK (
    -- The inserting user must be a coach of the announcement's studio.
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.studio_id = team_announcements.studio_id
        AND p.is_coach = true
    )
    -- The studio must be on studio_suite.
    AND get_studio_owner_tier(team_announcements.studio_id) = 'studio_suite'
  );

-- ── f) grant_studio_tier — service_role only B2B grant path ───────────────────

CREATE OR REPLACE FUNCTION public.grant_studio_tier(
  p_user_id    uuid,
  p_tier       text,
  p_period_end timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_tier NOT IN ('studio_visibility', 'studio_suite') THEN
    RAISE EXCEPTION 'Ungültiger Tier: %. Erlaubt: studio_visibility, studio_suite', p_tier;
  END IF;

  INSERT INTO public.subscriptions (
    user_id,
    tier,
    billing_cycle,
    status,
    current_period_end
  )
  VALUES (
    p_user_id,
    p_tier,
    'monthly',
    'active',
    p_period_end
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    tier               = excluded.tier,
    status             = 'active',
    current_period_end = excluded.current_period_end,
    updated_at         = now();
END;
$$;

-- Only service_role may call this RPC (B2B grants, not end-user facing).
REVOKE EXECUTE ON FUNCTION public.grant_studio_tier(uuid, text, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_studio_tier(uuid, text, timestamptz) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_studio_tier(uuid, text, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.grant_studio_tier(uuid, text, timestamptz) TO service_role;
