-- Sparring commitment (2/3): RPCs + membership rewiring
--
-- Server-side lifecycle for sparring_signups (spec docs/superpowers/specs/
-- sparring-verbindlichkeit.md, section 6 + 16). All RPCs are SECURITY DEFINER
-- with a pinned search_path; internal helpers are revoked from the API.
--
-- Status sets (never re-derive them elsewhere):
--   holds a slot     : pending, confirmed
--   chat member      : pending, confirmed, attended, no_show   (+ organizer)
--   reliability      : defined ONLY in get_reliability()
--
-- Lock order everywhere: open_sparrings row first, then sparring_signups rows.
-- This serialises joins/cancels/promotions per sparring (no overbooking) and
-- keeps the lifecycle cron (migration 3) deadlock-free against the RPCs.
--
-- Also rewires what used "a signup row exists" as membership, because
-- cancelled/expired rows now stay in the table: chat RLS, chat push fan-out,
-- chat lists, deactivate_sparring, the public slots_left (website!) and the
-- signup chat system messages (trigger that so far only lived in prod).
-- Deliberately untouched: the sparring_ratings insert policy (stars are hidden
-- behind SHOW_SPARRING_STARS; rewire it before bringing them back).

-- ─── 0. Central deadlines (single source, also used by migration 3) ───────────
-- Mirrored for UI copy in src/data/sparringConfig.ts — keep both in sync.

CREATE OR REPLACE FUNCTION sparring_cancel_deadline()
RETURNS interval LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT interval '6 hours' $$;          -- cancel before this = no consequence

CREATE OR REPLACE FUNCTION sparring_confirm_deadline()
RETURNS interval LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT interval '6 hours' $$;          -- unconfirmed slots expire here

CREATE OR REPLACE FUNCTION sparring_confirm_window()
RETURNS interval LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT interval '24 hours' $$;         -- final confirmation is requested from here

CREATE OR REPLACE FUNCTION sparring_reaction_time()
RETURNS interval LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT interval '2 hours' $$;          -- minimum time between a confirmation ask and expiry

-- Single definition of a "last-minute slot": handed over so close to the
-- confirm deadline (e.g. a late waitlist promotion) that the holder cannot be
-- expected to confirm in time. Such slots never expire, and declining them
-- while still unconfirmed has no consequence.
CREATE OR REPLACE FUNCTION sparring_is_last_minute_slot(
  p_slot_granted_at timestamptz,
  p_scheduled_at    timestamptz
)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT p_slot_granted_at IS NOT NULL
     AND p_slot_granted_at >= p_scheduled_at - sparring_confirm_deadline() - sparring_reaction_time()
$$;

-- ─── 1. Membership helper (used by chat RLS) ────────────────────────────────────
-- DEFINER so policies on other tables do not depend on sparring_signups RLS.

CREATE OR REPLACE FUNCTION is_sparring_member(p_sparring_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM open_sparrings
      WHERE id = p_sparring_id AND created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM sparring_signups
      WHERE sparring_id = p_sparring_id
        AND user_id = auth.uid()
        AND status IN ('pending','confirmed','attended','no_show')
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION is_sparring_member(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION is_sparring_member(uuid) TO authenticated;

-- ─── 2. Internal: waitlist promotion ────────────────────────────────────────────
-- Fills free slots with the oldest waitlist entries. Bounded by the number of
-- free slots, so it always terminates and never overbooks. Called from
-- join_sparring, cancel_sparring_signup, the slot-release trigger and the
-- lifecycle cron. Returns the number of promoted users.

CREATE OR REPLACE FUNCTION promote_sparring_waitlist(p_sparring_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sp    record;
  v_taken integer;
  v_free  integer;
  v_count integer := 0;
  r       record;
BEGIN
  -- Re-entrant inside the caller's transaction (callers already hold this lock).
  SELECT id, title, scheduled_at, max_slots, is_active
    INTO v_sp
    FROM open_sparrings
   WHERE id = p_sparring_id
     FOR UPDATE;

  IF NOT FOUND OR NOT v_sp.is_active OR v_sp.scheduled_at <= now() THEN
    RETURN 0;
  END IF;

  SELECT count(*) INTO v_taken
    FROM sparring_signups
   WHERE sparring_id = p_sparring_id
     AND status IN ('pending','confirmed');

  v_free := v_sp.max_slots - v_taken;
  IF v_free <= 0 THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT id, user_id
      FROM sparring_signups
     WHERE sparring_id = p_sparring_id
       AND status = 'waitlisted'
     ORDER BY signed_up_at, id
     LIMIT v_free
       FOR UPDATE
  LOOP
    UPDATE sparring_signups
       SET status               = 'pending',
           slot_granted_at      = now(),
           -- The promotion notice itself asks for confirmation: skip the 7-day
           -- check-in, and the 24h reminder once already inside that window.
           reminder_7d_sent_at  = now(),
           reminder_24h_sent_at = CASE
                                    WHEN now() >= v_sp.scheduled_at - sparring_confirm_window() THEN now()
                                    ELSE NULL
                                  END
     WHERE id = r.id;

    PERFORM notify_user(
      r.user_id,
      'sparring_waitlist_promoted',
      'Ein Platz ist frei geworden',
      'Du bist jetzt bei „' || COALESCE(v_sp.title, 'dem Sparring') || '“ dabei. '
        || CASE
             WHEN sparring_is_last_minute_slot(now(), v_sp.scheduled_at)
               THEN 'Bitte bestätige kurz in der App, dass du kommst.'
             ELSE 'Bitte bestätige deine Teilnahme bis '
               || to_char((v_sp.scheduled_at - sparring_confirm_deadline()) AT TIME ZONE 'Europe/Berlin', 'DD.MM. "um" HH24:MI')
               || ' Uhr in der App, sonst wird der Platz wieder freigegeben.'
           END,
      jsonb_build_object('sparring_id', p_sparring_id)
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION promote_sparring_waitlist(uuid) FROM PUBLIC, anon, authenticated;

-- ─── 3. join_sparring ───────────────────────────────────────────────────────────
-- Replaces the direct client INSERT. Returns the assigned status:
--   pending    slot taken, final confirmation requested 24h before
--   confirmed  joined inside the 24h window — the fresh join IS the final commitment
--   waitlisted sparring is full

CREATE OR REPLACE FUNCTION join_sparring(p_sparring_id uuid, p_rules_version smallint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_sp       record;
  v_existing text;
  v_taken    integer;
  v_status   text;
  v_name     text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Nicht eingeloggt.';
  END IF;
  -- Consent requirement carried over from the old insert policy (20260910120000).
  IF p_rules_version IS NULL OR p_rules_version < 1 THEN
    RAISE EXCEPTION 'Bitte stimme zuerst den Sparr-Grundregeln zu.';
  END IF;

  -- Lock the sparring: capacity check and status assignment are atomic.
  SELECT id, title, created_by, scheduled_at, max_slots, is_active, verified_only
    INTO v_sp
    FROM open_sparrings
   WHERE id = p_sparring_id
     FOR UPDATE;

  IF NOT FOUND OR NOT v_sp.is_active THEN
    RAISE EXCEPTION 'Dieses Sparring gibt es nicht mehr.';
  END IF;
  IF v_sp.scheduled_at <= now() THEN
    RAISE EXCEPTION 'Dieses Sparring hat bereits begonnen.';
  END IF;
  -- verified_only check carried over from the old insert policy (20260614120000).
  IF v_sp.verified_only AND NOT is_user_verified(v_uid) THEN
    RAISE EXCEPTION 'Dieses Sparring ist nur für verifizierte Mitglieder.';
  END IF;

  SELECT status INTO v_existing
    FROM sparring_signups
   WHERE sparring_id = p_sparring_id AND user_id = v_uid
     FOR UPDATE;

  -- Already holding a slot or queued: idempotent, keep the running lifecycle.
  IF v_existing IN ('pending','confirmed','waitlisted') THEN
    RETURN v_existing;
  END IF;
  IF v_existing IN ('attended','no_show') THEN
    RAISE EXCEPTION 'Deine Teilnahme an diesem Sparring wurde bereits erfasst.';
  END IF;

  -- Free slots go to the waitlist first, so a newcomer never jumps the queue
  -- (e.g. after the organizer raised max_slots).
  PERFORM promote_sparring_waitlist(p_sparring_id);

  SELECT count(*) INTO v_taken
    FROM sparring_signups
   WHERE sparring_id = p_sparring_id
     AND status IN ('pending','confirmed');

  IF v_taken >= v_sp.max_slots THEN
    v_status := 'waitlisted';
  ELSIF now() >= v_sp.scheduled_at - sparring_confirm_window() THEN
    v_status := 'confirmed';
  ELSE
    v_status := 'pending';
  END IF;

  -- A late cancellation must not be laundered into a clean waitlist entry
  -- (spec 16.1): coming back is only possible onto a free slot.
  IF v_existing = 'cancelled_late' AND v_status = 'waitlisted' THEN
    RAISE EXCEPTION 'Das Sparring ist inzwischen voll. Nach einer kurzfristigen Absage ist keine Warteliste möglich.';
  END IF;

  -- Re-join after cancel/expiry reuses the row: reset every lifecycle field so
  -- reminders fire again and no stale flag survives.
  INSERT INTO sparring_signups (
    sparring_id, user_id, signed_up_at, rules_version, rules_accepted_at,
    status, slot_granted_at, confirmed_at
  ) VALUES (
    p_sparring_id, v_uid, now(), p_rules_version, now(),
    v_status,
    CASE WHEN v_status = 'waitlisted' THEN NULL ELSE now() END,
    CASE WHEN v_status = 'confirmed'  THEN now() ELSE NULL END
  )
  ON CONFLICT (sparring_id, user_id) DO UPDATE
     SET status               = EXCLUDED.status,
         signed_up_at         = EXCLUDED.signed_up_at,
         rules_version        = EXCLUDED.rules_version,
         rules_accepted_at    = EXCLUDED.rules_accepted_at,
         slot_granted_at      = EXCLUDED.slot_granted_at,
         confirmed_at         = EXCLUDED.confirmed_at,
         cancelled_at         = NULL,
         checked_in_at        = NULL,
         reminder_7d_sent_at  = NULL,
         reminder_24h_sent_at = NULL;

  -- Only real slots are announced to the organizer (replaces the old
  -- AFTER INSERT trigger, which also fired for what is now the waitlist).
  IF v_status <> 'waitlisted' AND v_sp.created_by <> v_uid THEN
    SELECT name INTO v_name FROM profiles WHERE id = v_uid;
    PERFORM notify_user(
      v_sp.created_by,
      'sparring_signup',
      'Neue Sparring-Anmeldung',
      COALESCE(v_name, 'Jemand') || ' hat sich für „' || COALESCE(v_sp.title, 'dein Sparring') || '“ angemeldet.',
      jsonb_build_object('sparring_id', p_sparring_id)
    );
  END IF;

  RETURN v_status;
END;
$$;

REVOKE EXECUTE ON FUNCTION join_sparring(uuid, smallint) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION join_sparring(uuid, smallint) TO authenticated;

-- Old notification path: the RPC notifies now, only for real slots.
DROP TRIGGER  IF EXISTS trg_notify_sparring_signup ON sparring_signups;
DROP FUNCTION IF EXISTS notify_sparring_signup();

-- ─── 4. confirm_sparring — the final "Ja, ich bin dabei" ───────────────────────

CREATE OR REPLACE FUNCTION confirm_sparring(p_sparring_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_status text;
  v_sched  timestamptz;
  v_active boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Nicht eingeloggt.';
  END IF;

  -- Row lock serialises against the expiry step of the lifecycle cron.
  SELECT ss.status, os.scheduled_at, os.is_active
    INTO v_status, v_sched, v_active
    FROM sparring_signups ss
    JOIN open_sparrings os ON os.id = ss.sparring_id
   WHERE ss.sparring_id = p_sparring_id
     AND ss.user_id = v_uid
     FOR UPDATE OF ss;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Du bist für dieses Sparring nicht angemeldet.';
  END IF;
  IF v_status = 'confirmed' THEN
    RETURN;
  END IF;
  IF v_status = 'expired' THEN
    RAISE EXCEPTION 'Dein Platz ist verfallen. Du kannst erneut zusagen, falls noch ein Platz frei ist.';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Du hast keinen Platz, den du bestätigen kannst.';
  END IF;
  IF NOT v_active THEN
    RAISE EXCEPTION 'Dieses Sparring wurde abgesagt.';
  END IF;
  IF v_sched <= now() THEN
    RAISE EXCEPTION 'Dieses Sparring hat bereits begonnen.';
  END IF;

  UPDATE sparring_signups
     SET status = 'confirmed', confirmed_at = now()
   WHERE sparring_id = p_sparring_id AND user_id = v_uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION confirm_sparring(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION confirm_sparring(uuid) TO authenticated;

-- ─── 5. cancel_sparring_signup — "Kann doch nicht teilnehmen" ──────────────────
-- Replaces the direct client DELETE. Returns 'cancelled' (no consequence) or
-- 'cancelled_late' (counts as not attended).

CREATE OR REPLACE FUNCTION cancel_sparring_signup(p_sparring_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_sp   record;
  v_row  record;
  v_new  text;
  v_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Nicht eingeloggt.';
  END IF;

  SELECT id, title, created_by, scheduled_at, is_active
    INTO v_sp
    FROM open_sparrings
   WHERE id = p_sparring_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dieses Sparring gibt es nicht mehr.';
  END IF;

  SELECT id, status, slot_granted_at
    INTO v_row
    FROM sparring_signups
   WHERE sparring_id = p_sparring_id AND user_id = v_uid
     FOR UPDATE;

  IF NOT FOUND OR v_row.status NOT IN ('pending','confirmed','waitlisted') THEN
    RAISE EXCEPTION 'Du bist für dieses Sparring nicht angemeldet.';
  END IF;

  IF v_row.status = 'waitlisted' OR NOT v_sp.is_active THEN
    -- Never had a slot, or the organizer called it off: no consequence.
    v_new := 'cancelled';
  ELSIF now() <= v_sp.scheduled_at - sparring_cancel_deadline() THEN
    v_new := 'cancelled';
  ELSIF v_row.status = 'pending'
    AND sparring_is_last_minute_slot(v_row.slot_granted_at, v_sp.scheduled_at) THEN
    -- Last-minute slot (e.g. late waitlist promotion), never confirmed:
    -- declining it is no broken commitment.
    v_new := 'cancelled';
  ELSE
    v_new := 'cancelled_late';
  END IF;

  UPDATE sparring_signups
     SET status = v_new, cancelled_at = now()
   WHERE id = v_row.id;

  IF v_row.status IN ('pending','confirmed') THEN
    PERFORM promote_sparring_waitlist(p_sparring_id);

    IF v_sp.created_by <> v_uid AND v_sp.is_active THEN
      SELECT name INTO v_name FROM profiles WHERE id = v_uid;
      PERFORM notify_user(
        v_sp.created_by,
        'sparring_signup_cancelled',
        'Teilnehmer abgemeldet',
        COALESCE(v_name, 'Jemand') || ' hat sich von „' || COALESCE(v_sp.title, 'deinem Sparring') || '“ abgemeldet.',
        jsonb_build_object('sparring_id', p_sparring_id)
      );
    END IF;
  END IF;

  RETURN v_new;
END;
$$;

REVOKE EXECUTE ON FUNCTION cancel_sparring_signup(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION cancel_sparring_signup(uuid) TO authenticated;

-- ─── 6. mark_sparring_attendance ────────────────────────────────────────────────
-- Organizer (or staff of the sparring's studio) records presence from the start
-- of the sparring. Only confirmed participants; attended <-> no_show may be
-- corrected afterwards.

CREATE OR REPLACE FUNCTION mark_sparring_attendance(
  p_sparring_id uuid,
  p_user_id     uuid,
  p_present     boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_sp     record;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Nicht eingeloggt.';
  END IF;
  IF p_present IS NULL THEN
    RAISE EXCEPTION 'Bitte gib an, ob der Teilnehmer erschienen ist.';
  END IF;

  SELECT id, created_by, studio_id, scheduled_at, is_active
    INTO v_sp
    FROM open_sparrings
   WHERE id = p_sparring_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dieses Sparring gibt es nicht mehr.';
  END IF;
  IF v_sp.created_by <> v_uid
     AND NOT (v_sp.studio_id IS NOT NULL AND is_studio_staff(v_sp.studio_id)) THEN
    RAISE EXCEPTION 'Nur der Organisator kann die Anwesenheit erfassen.';
  END IF;
  IF p_user_id = v_uid THEN
    RAISE EXCEPTION 'Deine eigene Anwesenheit kannst du nicht erfassen.';
  END IF;
  IF NOT v_sp.is_active THEN
    RAISE EXCEPTION 'Dieses Sparring wurde abgesagt.';
  END IF;
  IF now() < v_sp.scheduled_at THEN
    RAISE EXCEPTION 'Die Anwesenheit kannst du erst ab Beginn des Sparrings erfassen.';
  END IF;

  SELECT status INTO v_status
    FROM sparring_signups
   WHERE sparring_id = p_sparring_id AND user_id = p_user_id
     FOR UPDATE;

  IF NOT FOUND OR v_status NOT IN ('confirmed','attended','no_show') THEN
    RAISE EXCEPTION 'Anwesenheit kann nur für bestätigte Teilnehmer erfasst werden.';
  END IF;

  UPDATE sparring_signups
     SET status        = CASE WHEN p_present THEN 'attended' ELSE 'no_show' END,
         checked_in_at = now()
   WHERE sparring_id = p_sparring_id AND user_id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION mark_sparring_attendance(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION mark_sparring_attendance(uuid, uuid, boolean) TO authenticated;

-- ─── 7. get_sparring_participants ───────────────────────────────────────────────
-- Everyone currently part of the sparring (slot holders, waitlist, recorded
-- attendance). Cancelled/expired rows are history and not listed.

CREATE OR REPLACE FUNCTION get_sparring_participants(p_sparring_id uuid)
RETURNS TABLE (
  user_id           uuid,
  name              text,
  avatar_url        text,
  gender            text,
  status            text,
  is_confirmed      boolean,
  signed_up_at      timestamptz,
  waitlist_position integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ss.user_id,
    p.name,
    p.avatar_url,
    p.gender,
    ss.status,
    ss.status IN ('confirmed','attended','no_show') AS is_confirmed,
    ss.signed_up_at,
    CASE WHEN ss.status = 'waitlisted' THEN
      (row_number() OVER (PARTITION BY ss.status = 'waitlisted' ORDER BY ss.signed_up_at, ss.id))::int
    END AS waitlist_position
  FROM sparring_signups ss
  LEFT JOIN profiles p ON p.id = ss.user_id
  WHERE auth.uid() IS NOT NULL
    AND ss.sparring_id = p_sparring_id
    AND ss.status IN ('pending','confirmed','waitlisted','attended','no_show')
  ORDER BY
    CASE ss.status
      WHEN 'confirmed' THEN 0
      WHEN 'attended'  THEN 0
      WHEN 'no_show'   THEN 1
      WHEN 'pending'   THEN 2
      ELSE 3
    END,
    ss.signed_up_at;
$$;

REVOKE EXECUTE ON FUNCTION get_sparring_participants(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION get_sparring_participants(uuid) TO authenticated;

-- ─── 8. get_reliability — the ONLY definition of the reliability sets ─────────
--   attended  = attended
--   committed = attended + no_show + cancelled_late
-- expired and in-time cancelled never count (spec 6.7 / 16.1).

CREATE OR REPLACE FUNCTION get_reliability(p_user_id uuid)
RETURNS TABLE (attended integer, committed integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (count(*) FILTER (WHERE ss.status = 'attended'))::int,
    (count(*) FILTER (WHERE ss.status IN ('attended','no_show','cancelled_late')))::int
  FROM sparring_signups ss
  WHERE auth.uid() IS NOT NULL
    AND ss.user_id = p_user_id;
$$;

REVOKE EXECUTE ON FUNCTION get_reliability(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION get_reliability(uuid) TO authenticated;

-- ─── 9. Signup chat system messages (trigger so far only existed in prod) ─────
-- Posts "hat sich angemeldet / abgesagt" on slot changes instead of on raw
-- INSERT/DELETE. Waitlist joins, confirmations and attendance stay silent.

ALTER TABLE sparring_group_messages
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION trg_sparring_signup_chat_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sid  uuid;
  v_uid  uuid;
  v_text text;
  v_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('pending','confirmed') THEN RETURN NULL; END IF;
    v_sid := NEW.sparring_id; v_uid := NEW.user_id;
    v_text := ' hat sich angemeldet';
  ELSIF TG_OP = 'UPDATE' THEN
    v_sid := NEW.sparring_id; v_uid := NEW.user_id;
    IF OLD.status NOT IN ('pending','confirmed') AND NEW.status IN ('pending','confirmed') THEN
      v_text := ' hat sich angemeldet';
    ELSIF OLD.status IN ('pending','confirmed') AND NEW.status IN ('cancelled','cancelled_late') THEN
      v_text := ' hat abgesagt';
    ELSIF OLD.status IN ('pending','confirmed') AND NEW.status = 'expired' THEN
      v_text := ' ist nicht mehr dabei';
    ELSE
      RETURN NULL;
    END IF;
  ELSE
    IF OLD.status NOT IN ('pending','confirmed') THEN RETURN NULL; END IF;
    v_sid := OLD.sparring_id; v_uid := OLD.user_id;
    v_text := ' hat abgesagt';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM sparring_chat_settings WHERE sparring_id = v_sid) THEN
    RETURN NULL;
  END IF;

  -- Cascading deletes (account deletion, sparring deletion): the referenced
  -- sparring/profile may already be gone, and the FK would abort the delete.
  IF NOT EXISTS (SELECT 1 FROM open_sparrings WHERE id = v_sid) THEN
    RETURN NULL;
  END IF;
  SELECT name INTO v_name FROM profiles WHERE id = v_uid;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  INSERT INTO sparring_group_messages (sparring_id, sender_id, content, is_system)
  VALUES (v_sid, v_uid, COALESCE(v_name, 'Jemand') || v_text, true);

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sparring_signup_chat ON sparring_signups;
CREATE TRIGGER trg_sparring_signup_chat
  AFTER INSERT OR UPDATE OF status OR DELETE ON sparring_signups
  FOR EACH ROW
  EXECUTE FUNCTION trg_sparring_signup_chat_notify();

-- A hard delete (account deletion cascade, admin cleanup) of a slot holder
-- frees the slot: let the waitlist move up.
CREATE OR REPLACE FUNCTION trg_sparring_signup_release_slot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IN ('pending','confirmed') THEN
    PERFORM promote_sparring_waitlist(OLD.sparring_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sparring_signup_release_slot ON sparring_signups;
CREATE TRIGGER trg_sparring_signup_release_slot
  AFTER DELETE ON sparring_signups
  FOR EACH ROW
  EXECUTE FUNCTION trg_sparring_signup_release_slot();

-- The organizer may raise max_slots at any time: fill the new slots from the
-- waitlist immediately instead of waiting for the next join.
CREATE OR REPLACE FUNCTION trg_open_sparring_capacity_raised()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.max_slots > OLD.max_slots THEN
    PERFORM promote_sparring_waitlist(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_open_sparring_capacity_raised ON open_sparrings;
CREATE TRIGGER trg_open_sparring_capacity_raised
  AFTER UPDATE OF max_slots ON open_sparrings
  FOR EACH ROW
  EXECUTE FUNCTION trg_open_sparring_capacity_raised();

REVOKE EXECUTE ON FUNCTION trg_sparring_signup_chat_notify()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION trg_sparring_signup_release_slot()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION trg_open_sparring_capacity_raised() FROM PUBLIC, anon, authenticated;

-- ─── 10. Chat access: only active members (+ organizer) ────────────────────────

DROP POLICY IF EXISTS "member reads settings" ON sparring_chat_settings;
CREATE POLICY "member reads settings" ON sparring_chat_settings
  FOR SELECT USING (is_sparring_member(sparring_id));

DROP POLICY IF EXISTS "member reads messages" ON sparring_group_messages;
CREATE POLICY "member reads messages" ON sparring_group_messages
  FOR SELECT USING (is_sparring_member(sparring_id));

DROP POLICY IF EXISTS "member inserts message" ON sparring_group_messages;
CREATE POLICY "member inserts message" ON sparring_group_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND is_sparring_member(sparring_id)
    AND (
      SELECT scheduled_at + (duration_min || ' minutes')::interval
      FROM open_sparrings WHERE id = sparring_id
    ) > now()
    AND (
      image_url IS NULL
      OR EXISTS (
        SELECT 1 FROM sparring_chat_settings
        WHERE sparring_id = sparring_group_messages.sparring_id
          AND media_enabled = true
      )
    )
  );

-- Legacy 1:1 sparring messages: same membership rule.
DROP POLICY IF EXISTS "Signed-up users can send" ON sparring_messages;
CREATE POLICY "Signed-up users can send" ON sparring_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND auth.uid() <> recipient_id
    AND is_sparring_member(sparring_id)
  );

-- ─── 11. Chat push fan-out: only active members ────────────────────────────────

CREATE OR REPLACE FUNCTION notify_sparring_group_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title  text;
  v_sender text;
  v_body   text;
  r        record;
BEGIN
  SELECT title INTO v_title
  FROM open_sparrings
  WHERE id = NEW.sparring_id;

  SELECT COALESCE(name, 'Jemand') INTO v_sender
  FROM profiles
  WHERE id = NEW.sender_id;

  IF NEW.is_system THEN
    v_body := left(COALESCE(NEW.content, ''), 120);
  ELSIF NEW.content IS NOT NULL AND length(NEW.content) > 0 THEN
    v_body := COALESCE(v_sender, 'Jemand') || ': ' || left(NEW.content, 120);
  ELSE
    v_body := COALESCE(v_sender, 'Jemand') || ' hat ein Bild gesendet.';
  END IF;

  -- Recipients: organizer + active members, minus the sender. System messages
  -- (joins/cancels) skip the organizer, who already got a feed notification.
  FOR r IN
    SELECT DISTINCT uid FROM (
      SELECT created_by AS uid FROM open_sparrings
      WHERE id = NEW.sparring_id AND NOT NEW.is_system
      UNION
      SELECT user_id AS uid FROM sparring_signups
      WHERE sparring_id = NEW.sparring_id
        AND status IN ('pending','confirmed','attended','no_show')
    ) members
    WHERE uid IS NOT NULL
      AND uid <> NEW.sender_id
  LOOP
    PERFORM send_push_notification(
      r.uid,
      COALESCE(v_title, 'Sparring-Chat'),
      v_body,
      jsonb_build_object('sparring_id', NEW.sparring_id, 'kind', 'sparring_message')
    );
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION notify_sparring_group_message() FROM PUBLIC, anon, authenticated;

-- ─── 12. deactivate_sparring: notify slot holders + waitlist only ─────────────

CREATE OR REPLACE FUNCTION deactivate_sparring(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title   text;
  v_creator uuid;
  r         record;
BEGIN
  UPDATE open_sparrings
  SET is_active = false
  WHERE id = p_id
    AND created_by = auth.uid()
  RETURNING title, created_by INTO v_title, v_creator;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sparring nicht gefunden oder keine Berechtigung';
  END IF;

  -- Fan out a cancellation notice to everyone still expecting the sparring
  FOR r IN
    SELECT user_id
    FROM sparring_signups
    WHERE sparring_id = p_id
      AND user_id <> v_creator
      AND status IN ('pending','confirmed','waitlisted')
  LOOP
    PERFORM notify_user(
      r.user_id,
      'sparring_cancelled',
      'Sparring abgesagt',
      '"' || COALESCE(v_title, 'Ein Sparring') || '" wurde vom Organisator abgesagt.',
      jsonb_build_object('sparring_id', p_id)
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION deactivate_sparring(uuid) TO authenticated;

-- ─── 13. Public share card (website sparrapp.com): slots_left counts slot holders ─

CREATE OR REPLACE FUNCTION public.get_public_sparring(p_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(
    'id',              os.id,
    'title',           os.title,
    'discipline',      os.discipline,
    'scheduled_at',    os.scheduled_at,
    'duration_min',    os.duration_min,
    'max_slots',       os.max_slots,
    'slots_left',      GREATEST(
                         0,
                         os.max_slots - (
                           SELECT count(*) FROM sparring_signups ss
                           WHERE ss.sparring_id = os.id
                             AND ss.status IN ('pending','confirmed')
                         )
                       )::int,
    -- Coarse location: studio name when at a studio, else a German "PLZ Stadt"
    -- label extracted from the address. Never emits raw coordinates or house
    -- numbers; falls back to a generic label otherwise.
    'area_label',      CASE
                         WHEN os.is_at_studio AND st.name IS NOT NULL THEN st.name
                         ELSE COALESCE(
                           NULLIF(
                             btrim(substring(os.address from '(?:^|\s)(\d{5}\s+[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß .-]*)')),
                             ''
                           ),
                           'Ort in der App'
                         )
                       END,
    'host_name',       p.name,
    'host_avatar_url', p.avatar_url
  )
  FROM open_sparrings os
  LEFT JOIN studios  st ON st.id = os.studio_id
  LEFT JOIN profiles p  ON p.id = os.created_by
  WHERE os.id = p_id
    AND os.is_active = true
    AND os.verified_only = false;
$$;

REVOKE ALL     ON FUNCTION public.get_public_sparring(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_public_sparring(uuid) TO anon, authenticated;

-- ─── 14. Chat lists: only chats the user is still an active member of ─────────
-- Bodies unchanged from 20260906120000 / 20260605160000 except the status filter.

CREATE OR REPLACE FUNCTION get_my_chats()
RETURNS TABLE (
  kind              text,
  chat_id           uuid,
  title             text,
  scheduled_at      timestamptz,
  duration_min      integer,
  is_organizer      boolean,
  last_message_text text,
  last_message_at   timestamptz,
  unread_count      integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_sparrings AS (
    SELECT s.id, s.title, s.scheduled_at, s.duration_min, s.created_by
    FROM open_sparrings s
    WHERE (
        s.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM sparring_signups ss
          WHERE ss.sparring_id = s.id AND ss.user_id = auth.uid()
            AND ss.status IN ('pending','confirmed','attended','no_show')
        )
      )
      AND EXISTS (
        SELECT 1 FROM sparring_chat_settings cs WHERE cs.sparring_id = s.id
      )
  ),
  sparring_reads AS (
    SELECT sparring_id, last_read_at
    FROM sparring_chat_reads
    WHERE user_id = auth.uid()
  ),
  sparring_last AS (
    SELECT DISTINCT ON (m.sparring_id)
      m.sparring_id, m.content, m.image_url, m.created_at
    FROM sparring_group_messages m
    WHERE m.sparring_id IN (SELECT id FROM my_sparrings)
    ORDER BY m.sparring_id, m.created_at DESC
  ),
  sparring_unread AS (
    SELECT m.sparring_id, count(*)::int AS cnt
    FROM sparring_group_messages m
    LEFT JOIN sparring_reads r ON r.sparring_id = m.sparring_id
    WHERE m.sparring_id IN (SELECT id FROM my_sparrings)
      AND m.sender_id <> auth.uid()
      AND m.created_at > COALESCE(r.last_read_at, '1970-01-01'::timestamptz)
    GROUP BY m.sparring_id
  ),
  my_events AS (
    SELECT e.id, e.title, e.scheduled_at, e.duration_min, e.created_by
    FROM events e
    WHERE e.created_by = auth.uid()
       OR EXISTS (
         SELECT 1 FROM event_signups es
         WHERE es.event_id = e.id AND es.user_id = auth.uid()
       )
  ),
  event_reads AS (
    SELECT event_id, last_read_at
    FROM event_chat_reads
    WHERE user_id = auth.uid()
  ),
  event_last AS (
    SELECT DISTINCT ON (m.event_id)
      m.event_id, m.body, m.created_at
    FROM event_messages m
    WHERE m.event_id IN (SELECT id FROM my_events)
    ORDER BY m.event_id, m.created_at DESC
  ),
  event_unread AS (
    SELECT m.event_id, count(*)::int AS cnt
    FROM event_messages m
    LEFT JOIN event_reads r ON r.event_id = m.event_id
    WHERE m.event_id IN (SELECT id FROM my_events)
      AND m.user_id <> auth.uid()
      AND m.created_at > COALESCE(r.last_read_at, '1970-01-01'::timestamptz)
    GROUP BY m.event_id
  )
  SELECT
    'sparring'::text AS kind,
    ms.id            AS chat_id,
    ms.title,
    ms.scheduled_at,
    ms.duration_min,
    (ms.created_by = auth.uid()) AS is_organizer,
    COALESCE(
      sl.content,
      CASE WHEN sl.image_url IS NOT NULL THEN 'Bild' ELSE NULL END
    ) AS last_message_text,
    sl.created_at        AS last_message_at,
    COALESCE(su.cnt, 0)  AS unread_count
  FROM my_sparrings ms
  LEFT JOIN sparring_last   sl ON sl.sparring_id = ms.id
  LEFT JOIN sparring_unread su ON su.sparring_id = ms.id

  UNION ALL

  SELECT
    'event'::text AS kind,
    me.id         AS chat_id,
    me.title,
    me.scheduled_at,
    me.duration_min,
    (me.created_by = auth.uid()) AS is_organizer,
    el.body             AS last_message_text,
    el.created_at       AS last_message_at,
    COALESCE(eu.cnt, 0) AS unread_count
  FROM my_events me
  LEFT JOIN event_last   el ON el.event_id = me.id
  LEFT JOIN event_unread eu ON eu.event_id = me.id

  -- Ordinals, not names: the output columns share their names with the
  -- RETURNS TABLE parameters, which is ambiguous in a UNION's ORDER BY.
  -- 8 = last_message_at, 4 = scheduled_at.
  ORDER BY 8 DESC NULLS LAST, 4 DESC;
$$;

GRANT EXECUTE ON FUNCTION get_my_chats() TO authenticated;

CREATE OR REPLACE FUNCTION get_my_chat_list()
RETURNS TABLE (
  sparring_id       uuid,
  sparring_title    text,
  scheduled_at      timestamptz,
  duration_min      integer,
  is_organizer      boolean,
  last_message_text text,
  last_message_at   timestamptz,
  unread_count      integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_sparrings AS (
    SELECT s.id, s.title, s.scheduled_at, s.duration_min, s.created_by
    FROM open_sparrings s
    WHERE (
        s.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM sparring_signups ss
          WHERE ss.sparring_id = s.id AND ss.user_id = auth.uid()
            AND ss.status IN ('pending','confirmed','attended','no_show')
        )
      )
      AND EXISTS (
        SELECT 1 FROM sparring_chat_settings cs WHERE cs.sparring_id = s.id
      )
      -- Only chats that actually have at least one message
      AND EXISTS (
        SELECT 1 FROM sparring_group_messages m WHERE m.sparring_id = s.id
      )
  ),
  my_reads AS (
    SELECT sparring_id, last_read_at
    FROM sparring_chat_reads
    WHERE user_id = auth.uid()
  ),
  last_msg AS (
    SELECT DISTINCT ON (m.sparring_id)
      m.sparring_id, m.content, m.image_url, m.created_at
    FROM sparring_group_messages m
    WHERE m.sparring_id IN (SELECT id FROM my_sparrings)
    ORDER BY m.sparring_id, m.created_at DESC
  ),
  unread AS (
    SELECT m.sparring_id, count(*)::int AS cnt
    FROM sparring_group_messages m
    LEFT JOIN my_reads r ON r.sparring_id = m.sparring_id
    WHERE m.sparring_id IN (SELECT id FROM my_sparrings)
      AND m.created_at > COALESCE(r.last_read_at, '1970-01-01'::timestamptz)
    GROUP BY m.sparring_id
  )
  SELECT
    ms.id,
    ms.title,
    ms.scheduled_at,
    ms.duration_min,
    (ms.created_by = auth.uid()) AS is_organizer,
    COALESCE(
      lm.content,
      CASE WHEN lm.image_url IS NOT NULL THEN 'Bild' ELSE NULL END
    ) AS last_message_text,
    lm.created_at AS last_message_at,
    COALESCE(u.cnt, 0) AS unread_count
  FROM my_sparrings ms
  LEFT JOIN last_msg lm ON lm.sparring_id = ms.id
  LEFT JOIN unread   u  ON u.sparring_id  = ms.id
  ORDER BY ms.scheduled_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_my_chat_list() TO authenticated;
