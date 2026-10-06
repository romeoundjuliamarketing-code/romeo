-- Sparring edit: organizers change a planned sparring after the fact.
--
-- Spec: docs/superpowers/specs/2026-09-27-sparring-edit-design.md
--
--   1. open_sparrings.edited_at / material_changed_at
--   2. sparring_format_berlin(): German date label for notification texts
--   3. update_sparring(): validated edit in one transaction; material changes
--      (time, location, duration, discipline) reset slot holders to pending and
--      notify every participant exactly once ('sparring_updated')
--   4. cancel_sparring_signup(): cancelling after a material change without
--      re-confirming is always 'cancelled', never 'cancelled_late'
--   5. No direct client UPDATEs any more: everything goes through RPCs
--
-- Lock order as everywhere: open_sparrings row first, then sparring_signups.
--
-- Lifecycle cron (step C) needs no change: a material change overwrites every
-- confirmation ask sent before it (reminder_24h_sent_at = now() inside the 24h
-- window, NULL before it). Step C only expires a slot whose ask came at least
-- sparring_reaction_time() before the confirm deadline, so nobody loses a slot
-- because of an ask about the old terms or without enough time to react.

-- ─── 1. Columns ─────────────────────────────────────────────────────────────────

ALTER TABLE open_sparrings
  ADD COLUMN IF NOT EXISTS edited_at           timestamptz,
  ADD COLUMN IF NOT EXISTS material_changed_at timestamptz;

COMMENT ON COLUMN open_sparrings.edited_at IS
  'Last edit via update_sparring() (any field). Shown as "Bearbeitet". Not touched by cancels, boosts or the cron.';
COMMENT ON COLUMN open_sparrings.material_changed_at IS
  'Last material edit (time, location, duration, discipline). A pending slot held since before this moment has not re-confirmed the new terms.';

-- ─── 2. German date label, Europe/Berlin ────────────────────────────────────────
-- Weekday from a fixed array: to_char(''Dy'') depends on lc_time.

CREATE OR REPLACE FUNCTION sparring_format_berlin(p_ts timestamptz)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (ARRAY['So','Mo','Di','Mi','Do','Fr','Sa'])[extract(dow FROM p_ts AT TIME ZONE 'Europe/Berlin')::int + 1]
      || ' ' || to_char(p_ts AT TIME ZONE 'Europe/Berlin', 'DD.MM., HH24:MI')
$$;

REVOKE EXECUTE ON FUNCTION sparring_format_berlin(timestamptz) FROM PUBLIC, anon, authenticated;

-- ─── 3. update_sparring ─────────────────────────────────────────────────────────
-- The client always sends the full set of editable fields; changes are detected
-- here. Returns { material, changed_fields, notified }.

CREATE OR REPLACE FUNCTION update_sparring(
  p_id            uuid,
  p_title         text,
  p_notes         text,
  p_discipline    text,
  p_address       text,
  p_lat           double precision,
  p_lng           double precision,
  p_scheduled_at  timestamptz,
  p_duration_min  integer,
  p_max_slots     integer,
  p_verified_only boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_sp         open_sparrings%ROWTYPE;
  v_title      text := btrim(COALESCE(p_title, ''));
  v_notes      text := NULLIF(btrim(COALESCE(p_notes, '')), '');
  v_discipline text := btrim(COALESCE(p_discipline, ''));
  v_address    text := btrim(COALESCE(p_address, ''));
  v_taken      integer;
  v_changed    text[] := '{}';
  v_material   boolean;
  v_recipients uuid[];
  v_lines      text[] := '{}';
  v_intro      text;
  v_body       text;
  v_notified   integer := 0;
  r            record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Nicht eingeloggt.';
  END IF;

  SELECT * INTO v_sp FROM open_sparrings WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_sp.created_by <> v_uid THEN
    RAISE EXCEPTION 'Sparring nicht gefunden oder keine Berechtigung';
  END IF;
  IF NOT v_sp.is_active OR v_sp.scheduled_at <= now() THEN
    RAISE EXCEPTION 'Abgesagte oder begonnene Sparrings können nicht mehr bearbeitet werden.';
  END IF;

  -- ── Validation ──────────────────────────────────────────────────────────────
  IF p_scheduled_at IS NULL OR p_scheduled_at <= now() THEN
    RAISE EXCEPTION 'Der neue Termin muss in der Zukunft liegen.';
  END IF;
  IF p_duration_min IS NULL OR p_duration_min < 15 OR p_duration_min > 600 THEN
    RAISE EXCEPTION 'Die Dauer muss zwischen 15 und 600 Minuten liegen.';
  END IF;
  IF p_max_slots IS NULL OR p_max_slots < 1 THEN
    RAISE EXCEPTION 'Es muss mindestens einen Platz geben.';
  END IF;
  IF v_title = '' THEN
    RAISE EXCEPTION 'Bitte gib einen Titel an.';
  END IF;
  IF v_discipline = '' THEN
    RAISE EXCEPTION 'Bitte wähle eine Disziplin.';
  END IF;
  IF v_address = '' THEN
    RAISE EXCEPTION 'Bitte gib einen Ort an.';
  END IF;
  IF (p_lat IS NULL) <> (p_lng IS NULL) THEN
    RAISE EXCEPTION 'Ungültige Koordinaten.';
  END IF;

  -- ── Diff ────────────────────────────────────────────────────────────────────
  IF p_scheduled_at IS DISTINCT FROM v_sp.scheduled_at THEN
    v_changed := v_changed || 'scheduled_at'::text;
  END IF;
  IF v_address IS DISTINCT FROM btrim(v_sp.address)
     OR p_lat IS DISTINCT FROM v_sp.lat
     OR p_lng IS DISTINCT FROM v_sp.lng THEN
    -- The studio is the location of a studio sparring.
    IF v_sp.studio_id IS NOT NULL THEN
      RAISE EXCEPTION 'Der Ort eines Studio-Sparrings ist das Studio und kann nicht geändert werden.';
    END IF;
    v_changed := v_changed || 'location'::text;
  END IF;
  IF p_duration_min IS DISTINCT FROM v_sp.duration_min THEN
    v_changed := v_changed || 'duration_min'::text;
  END IF;
  IF v_discipline IS DISTINCT FROM v_sp.discipline THEN
    v_changed := v_changed || 'discipline'::text;
  END IF;
  IF v_title IS DISTINCT FROM btrim(v_sp.title) THEN
    v_changed := v_changed || 'title'::text;
  END IF;
  IF v_notes IS DISTINCT FROM NULLIF(btrim(COALESCE(v_sp.notes, '')), '') THEN
    v_changed := v_changed || 'notes'::text;
  END IF;
  IF p_max_slots IS DISTINCT FROM v_sp.max_slots THEN
    v_changed := v_changed || 'max_slots'::text;
  END IF;
  IF p_verified_only IS DISTINCT FROM v_sp.verified_only THEN
    v_changed := v_changed || 'verified_only'::text;
  END IF;

  IF cardinality(v_changed) = 0 THEN
    RETURN jsonb_build_object('material', false, 'changed_fields', '[]'::jsonb, 'notified', 0);
  END IF;

  v_material := v_changed && ARRAY['scheduled_at','location','duration_min','discipline'];

  -- Slots may not drop below the current commitments (the sparring lock
  -- serialises this against joins and cancels).
  IF 'max_slots' = ANY(v_changed) THEN
    SELECT count(*) INTO v_taken
      FROM sparring_signups
     WHERE sparring_id = p_id
       AND status IN ('pending','confirmed');
    IF p_max_slots < v_taken THEN
      RAISE EXCEPTION 'Es haben bereits % Personen zugesagt. Die Plätze können nicht unter % sinken.', v_taken, v_taken;
    END IF;
  END IF;

  -- Recipients are fixed BEFORE the update, so people promoted from the
  -- waitlist by a raised max_slots in this same save are included.
  IF v_material THEN
    SELECT COALESCE(array_agg(user_id), '{}')
      INTO v_recipients
      FROM (
        SELECT user_id
          FROM sparring_signups
         WHERE sparring_id = p_id
           AND status IN ('pending','confirmed','waitlisted')
           AND user_id <> v_uid
           FOR UPDATE
      ) s;
  END IF;

  -- Triggers run here: content filter, reschedule flag reset, waitlist
  -- promotion on raised capacity.
  UPDATE open_sparrings
     SET title               = CASE WHEN 'title' = ANY(v_changed)    THEN v_title      ELSE title END,
         notes               = CASE WHEN 'notes' = ANY(v_changed)    THEN v_notes      ELSE notes END,
         discipline          = v_discipline,
         address             = CASE WHEN 'location' = ANY(v_changed) THEN v_address    ELSE address END,
         lat                 = p_lat,
         lng                 = p_lng,
         scheduled_at        = p_scheduled_at,
         duration_min        = p_duration_min,
         max_slots           = p_max_slots,
         verified_only       = p_verified_only,
         edited_at           = now(),
         material_changed_at = CASE WHEN v_material THEN now() ELSE material_changed_at END
   WHERE id = p_id;

  IF NOT v_material THEN
    RETURN jsonb_build_object('material', false, 'changed_fields', to_jsonb(v_changed), 'notified', 0);
  END IF;

  -- ── Material change: everyone re-confirms the new terms ─────────────────────
  -- The change notice replaces the 7-day check-in and, inside the 24h window,
  -- is the confirmation ask itself (same pattern as promote_sparring_waitlist).
  -- slot_granted_at stays: the slot still belongs to the person.
  UPDATE sparring_signups
     SET status               = 'pending',
         confirmed_at         = NULL,
         reminder_7d_sent_at  = now(),
         reminder_24h_sent_at = CASE
                                  WHEN now() >= p_scheduled_at - sparring_confirm_window() THEN now()
                                  ELSE NULL
                                END
   WHERE sparring_id = p_id
     AND status IN ('pending','confirmed')
     AND user_id <> v_uid;

  IF 'scheduled_at' = ANY(v_changed) THEN
    v_lines := v_lines || ('Neue Zeit: ' || sparring_format_berlin(p_scheduled_at)
      || ' (vorher ' || sparring_format_berlin(v_sp.scheduled_at) || ')');
  END IF;
  IF 'location' = ANY(v_changed) THEN
    v_lines := v_lines || ('Neuer Ort: ' || v_address);
  END IF;
  IF 'duration_min' = ANY(v_changed) THEN
    v_lines := v_lines || ('Neue Dauer: ' || p_duration_min || ' Min. (vorher ' || v_sp.duration_min || ' Min.)');
  END IF;
  IF 'discipline' = ANY(v_changed) THEN
    v_lines := v_lines || ('Neue Disziplin: ' || v_discipline || ' (vorher ' || v_sp.discipline || ')');
  END IF;

  v_intro := '„' || CASE WHEN 'title' = ANY(v_changed) THEN v_title ELSE v_sp.title END || '“ wurde geändert.'
    || E'\n' || array_to_string(v_lines, E'\n');

  FOR r IN
    SELECT user_id, status, slot_granted_at, signed_up_at, reminder_24h_sent_at
      FROM sparring_signups
     WHERE sparring_id = p_id
       AND user_id = ANY(v_recipients)
  LOOP
    IF r.status = 'waitlisted' THEN
      v_body := v_intro || E'\n' || 'Du stehst weiterhin auf der Warteliste.';
    ELSIF r.status = 'pending' THEN
      v_body := v_intro || E'\n' || 'Bitte bestätige den neuen Termin in der App';
      -- Announce the expiry only where step C will actually apply.
      IF r.reminder_24h_sent_at IS NOT NULL
         AND now() < p_scheduled_at - sparring_confirm_deadline() - sparring_reaction_time()
         AND NOT sparring_is_last_minute_slot(COALESCE(r.slot_granted_at, r.signed_up_at), p_scheduled_at) THEN
        v_body := v_body || ', sonst wird dein Platz am '
          || to_char((p_scheduled_at - sparring_confirm_deadline()) AT TIME ZONE 'Europe/Berlin', 'DD.MM. "um" HH24:MI')
          || ' Uhr freigegeben.';
      ELSE
        v_body := v_body || '.';
      END IF;
    ELSE
      -- Status changed concurrently (not expected under the locks): no notice.
      CONTINUE;
    END IF;

    -- Never lets a failing notification abort the edit.
    PERFORM sparring_notify_safe(
      r.user_id,
      'sparring_updated',
      'Sparring geändert',
      v_body,
      jsonb_build_object('sparring_id', p_id, 'changed_fields', to_jsonb(v_changed))
    );
    v_notified := v_notified + 1;
  END LOOP;

  RETURN jsonb_build_object('material', true, 'changed_fields', to_jsonb(v_changed), 'notified', v_notified);
END;
$$;

REVOKE EXECUTE ON FUNCTION update_sparring(uuid, text, text, text, text, double precision, double precision, timestamptz, integer, integer, boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION update_sparring(uuid, text, text, text, text, double precision, double precision, timestamptz, integer, integer, boolean) TO authenticated;

-- ─── 4. cancel_sparring_signup: no penalty before re-confirming a change ───────
-- Identical to 20260911120100 except the material-change branch.

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

  SELECT id, title, created_by, scheduled_at, is_active, material_changed_at
    INTO v_sp
    FROM open_sparrings
   WHERE id = p_sparring_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dieses Sparring gibt es nicht mehr.';
  END IF;

  SELECT id, status, slot_granted_at, signed_up_at
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
  ELSIF v_row.status = 'pending'
    AND v_sp.material_changed_at IS NOT NULL
    AND COALESCE(v_row.slot_granted_at, v_row.signed_up_at) <= v_sp.material_changed_at THEN
    -- The organizer changed the terms and this slot has not re-confirmed them
    -- yet (<= includes promotions within the same edit).
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

-- ─── 5. Direct client UPDATEs ───────────────────────────────────────────────────
-- The app mutates open_sparrings only through RPCs (update_sparring,
-- deactivate_sparring). The old policy let the creator change any column
-- directly (reschedule without notifications, reactivate, slots below the
-- commitments) and blocked boosted sparrings entirely. No working client path
-- depends on it: even the pre-RPC direct deactivate of the earliest builds
-- fails on the "read active sparrings" SELECT policy (the reason
-- deactivate_sparring exists, see 20260507130000).
-- SECURITY DEFINER functions, triggers, the cron and the boost webhook
-- (service_role) are unaffected. The website never writes this table.

DROP POLICY IF EXISTS "creator update sparrings" ON open_sparrings;
REVOKE UPDATE ON open_sparrings FROM anon, authenticated;
