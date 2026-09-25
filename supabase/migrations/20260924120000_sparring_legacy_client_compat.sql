-- Sparring commitment: TEMPORARY compatibility with store builds <= 1.2.6
--
-- Lets the commitment backend (20260910 + 20260911*) go live before the new app
-- is released. Builds up to 1.2.6 still write sparring_signups directly:
--   join   = INSERT (sparring_id, user_id)   -- no rules_version, no status
--   cancel = DELETE own row
-- Without this migration those inserts fail (rules_version NOT NULL, insert
-- policy dropped) and deletes are silently refused.
--
-- What it does:
--   1. Legacy INSERT: a BEFORE trigger fills the lifecycle fields of a direct
--      insert (rules_version 0 = "joined without the rules consent", status
--      pending); the policy only admits exactly such legacy rows, so the new
--      app keeps going through join_sparring().
--   2. Legacy INSERT notifies the organizer like the old trigger did (the RPC
--      does this for new-app joins).
--   3. Legacy DELETE: own row may be deleted again. The existing delete triggers
--      already move the waitlist up and post "hat abgesagt" in the chat.
--   4. The lifecycle cron is paused: old builds cannot confirm, so the 24h ask
--      would expire their slots. Reminders/expiry start with the release.
--
-- REMOVE once 1.2.7+ is the minimum in use (cleanup SQL in
-- docs/superpowers/specs/sparring-verbindlichkeit.md, "Legacy-Kompatibilitaet").

-- ─── 1. Legacy insert: fill lifecycle fields ───────────────────────────────────

CREATE OR REPLACE FUNCTION trg_sparring_signup_legacy_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- join_sparring() always passes a rules_version >= 1; only old clients omit it.
  IF NEW.rules_version IS NULL THEN
    NEW.rules_version        := 0;
    NEW.rules_accepted_at    := now();
    NEW.signed_up_at         := now();
    NEW.status               := 'pending';
    NEW.slot_granted_at      := now();
    NEW.confirmed_at         := NULL;
    NEW.cancelled_at         := NULL;
    NEW.checked_in_at        := NULL;
    NEW.reminder_7d_sent_at  := NULL;
    NEW.reminder_24h_sent_at := NULL;
    NEW.reminder_3h_sent_at  := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sparring_signup_legacy_insert ON sparring_signups;
CREATE TRIGGER trg_sparring_signup_legacy_insert
  BEFORE INSERT ON sparring_signups
  FOR EACH ROW
  EXECUTE FUNCTION trg_sparring_signup_legacy_insert();

REVOKE EXECUTE ON FUNCTION trg_sparring_signup_legacy_insert() FROM PUBLIC, anon, authenticated;

-- Only legacy rows may be inserted directly (RLS WITH CHECK runs after the
-- BEFORE trigger). Keeps the verified_only rule of the old policy.
DROP POLICY IF EXISTS "legacy insert own signup" ON sparring_signups;
CREATE POLICY "legacy insert own signup" ON sparring_signups
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND rules_version = 0
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM open_sparrings os
       WHERE os.id = sparring_id
         AND os.is_active
         AND os.scheduled_at > now()
         AND (NOT os.verified_only OR is_user_verified(auth.uid()))
    )
  );

-- ─── 2. Legacy insert: notify the organizer ───────────────────────────────────

CREATE OR REPLACE FUNCTION trg_sparring_signup_legacy_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sp   record;
  v_name text;
BEGIN
  IF NEW.rules_version <> 0 OR NEW.status <> 'pending' THEN
    RETURN NULL;
  END IF;
  SELECT title, created_by INTO v_sp FROM open_sparrings WHERE id = NEW.sparring_id;
  IF NOT FOUND OR v_sp.created_by = NEW.user_id THEN
    RETURN NULL;
  END IF;
  SELECT name INTO v_name FROM profiles WHERE id = NEW.user_id;
  BEGIN
    PERFORM notify_user(
      v_sp.created_by,
      'sparring_signup',
      'Neue Sparring-Anmeldung',
      COALESCE(v_name, 'Jemand') || ' hat sich für „' || COALESCE(v_sp.title, 'dein Sparring') || '“ angemeldet.',
      jsonb_build_object('sparring_id', NEW.sparring_id)
    );
  EXCEPTION WHEN OTHERS THEN
    -- A failed notification must never block the signup itself.
    RAISE WARNING 'legacy signup notify failed: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sparring_signup_legacy_notify ON sparring_signups;
CREATE TRIGGER trg_sparring_signup_legacy_notify
  AFTER INSERT ON sparring_signups
  FOR EACH ROW
  EXECUTE FUNCTION trg_sparring_signup_legacy_notify();

REVOKE EXECUTE ON FUNCTION trg_sparring_signup_legacy_notify() FROM PUBLIC, anon, authenticated;

-- ─── 3. Legacy delete ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "legacy delete own signup" ON sparring_signups;
CREATE POLICY "legacy delete own signup" ON sparring_signups
  FOR DELETE USING (auth.uid() = user_id);

-- ─── 4. Pause the lifecycle cron until the release ────────────────────────────

SELECT cron.unschedule('sparring-lifecycle')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sparring-lifecycle');
