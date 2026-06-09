-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: studio membership plans + contracts
-- Includes:
--   1. studio_membership_plans table + RLS
--   2. studio_member_contracts table + RLS
--   3. sign_membership RPC
--   4. respond_membership_request RPC
--   5. request_membership_cancellation RPC
--   6. confirm_membership_end RPC
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Membership plans defined by a studio
CREATE TABLE IF NOT EXISTS studio_membership_plans (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id        uuid        NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  price_cents      integer     NOT NULL CHECK (price_cents >= 0),
  billing_interval text        NOT NULL DEFAULT 'monthly'
                               CHECK (billing_interval IN ('monthly', 'yearly')),
  min_term_months  integer     NOT NULL DEFAULT 0 CHECK (min_term_months >= 0),
  description      text        NULL,
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Partial index: fast lookup of active plans per studio
CREATE INDEX IF NOT EXISTS studio_membership_plans_studio_active_idx
  ON studio_membership_plans (studio_id)
  WHERE is_active = true;

ALTER TABLE studio_membership_plans ENABLE ROW LEVEL SECURITY;

-- Any authenticated user may read plans (needed to show them on StudioDetailScreen)
CREATE POLICY "membership_plans_select"
  ON studio_membership_plans
  FOR SELECT
  USING (true);

-- INSERT restricted to studio staff (RLS guard; primary path is direct INSERT)
CREATE POLICY "membership_plans_insert"
  ON studio_membership_plans
  FOR INSERT
  WITH CHECK (is_studio_staff(studio_id));

-- UPDATE restricted to studio staff (e.g. deactivating a plan)
CREATE POLICY "membership_plans_update"
  ON studio_membership_plans
  FOR UPDATE
  USING (is_studio_staff(studio_id));

-- 2. Member contracts (one active contract per user per studio at a time)
CREATE TABLE IF NOT EXISTS studio_member_contracts (
  id                         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  studio_id                  uuid        NOT NULL REFERENCES studios(id)    ON DELETE CASCADE,
  plan_id                    uuid        NOT NULL REFERENCES studio_membership_plans(id),
  -- Snapshots taken at signing time so plan changes never affect existing contracts
  plan_name_snapshot         text        NOT NULL,
  price_cents_snapshot       integer     NOT NULL,
  billing_interval_snapshot  text        NOT NULL,
  min_term_months_snapshot   integer     NOT NULL,
  status                     text        NOT NULL DEFAULT 'pending'
                                         CHECK (status IN ('pending','active','cancellation_requested','ended','declined')),
  signed_at                  timestamptz NOT NULL DEFAULT now(),
  start_date                 date        NULL,
  cancel_requested_at        timestamptz NULL,
  ended_at                   date        NULL,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  responded_by               uuid        NULL REFERENCES auth.users(id)
);

-- At most one laufender Vertrag per (user, studio) — partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS studio_member_contracts_one_active_per_user_studio
  ON studio_member_contracts (user_id, studio_id)
  WHERE status IN ('pending', 'active', 'cancellation_requested');

-- Index for staff queries by studio + status
CREATE INDEX IF NOT EXISTS studio_member_contracts_studio_status_idx
  ON studio_member_contracts (studio_id, status);

ALTER TABLE studio_member_contracts ENABLE ROW LEVEL SECURITY;

-- SELECT: own contracts OR studio staff
CREATE POLICY "member_contracts_select"
  ON studio_member_contracts
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR is_studio_staff(studio_id)
  );

-- No direct INSERT/UPDATE policies: all state transitions run through SECURITY DEFINER RPCs

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RPC: sign_membership — user signs up for a plan
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sign_membership(p_plan_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan   RECORD;
  v_id     uuid;
  v_name   text;
BEGIN
  -- Load plan; error if not found or inactive
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

  -- Guard: no concurrent active/pending contract for the same studio
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

  -- Load requester name for notification text
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

GRANT EXECUTE ON FUNCTION sign_membership(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPC: respond_membership_request — staff confirms or declines a pending contract
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION respond_membership_request(
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

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Nur ausstehende Anträge können beantwortet werden.';
  END IF;

  -- Load studio name for notification text
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

GRANT EXECUTE ON FUNCTION respond_membership_request(uuid, boolean) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPC: request_membership_cancellation — user requests to cancel an active contract
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION request_membership_cancellation(p_contract_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio_id uuid;
  v_status    text;
  v_name      text;
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

  UPDATE studio_member_contracts
  SET
    status               = 'cancellation_requested',
    cancel_requested_at  = now(),
    updated_at           = now()
  WHERE id = p_contract_id;

  -- Load requester name for notification text
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

GRANT EXECUTE ON FUNCTION request_membership_cancellation(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RPC: confirm_membership_end — staff confirms the cancellation and ends the contract
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION confirm_membership_end(p_contract_id uuid)
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

  IF v_status <> 'cancellation_requested' THEN
    RAISE EXCEPTION 'Nur Verträge mit laufender Kündigung können beendet werden.';
  END IF;

  -- Load studio name for notification text
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

GRANT EXECUTE ON FUNCTION confirm_membership_end(uuid) TO authenticated;
