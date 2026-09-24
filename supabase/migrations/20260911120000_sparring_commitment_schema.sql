-- Sparring commitment (1/3): schema
--
-- Turns sparring_signups from a binary "row exists = signed up" table into a
-- status-driven commitment lifecycle (spec docs/superpowers/specs/
-- sparring-verbindlichkeit.md, section 4/5):
--
--   pending        committed, 24h confirmation still outstanding  (holds a slot)
--   waitlisted     committed while full                            (no slot)
--   confirmed      final confirmation given                        (holds a slot)
--   attended       organizer confirmed presence                    (reliability +)
--   no_show        confirmed but did not show up                   (reliability -)
--   cancelled      cancelled in time, no consequence
--   cancelled_late cancelled after the deadline                    (reliability -)
--   expired        never confirmed, slot released, NOT a no-show
--
-- Cancelling no longer deletes the row (history is kept); re-joining flips the
-- status back. All mutations go through SECURITY DEFINER RPCs (migration 2), so
-- the direct client insert/delete policies are dropped here.
--
-- Requires 20260910120000_sparring_rules_consent.sql (rules_version columns).

-- ─── 1. Lifecycle columns ───────────────────────────────────────────────────────

ALTER TABLE sparring_signups
  ADD COLUMN IF NOT EXISTS status               text        NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS slot_granted_at      timestamptz,          -- when the row last got a slot (pending/confirmed)
  ADD COLUMN IF NOT EXISTS confirmed_at         timestamptz,          -- final confirmation
  ADD COLUMN IF NOT EXISTS cancelled_at         timestamptz,
  ADD COLUMN IF NOT EXISTS checked_in_at        timestamptz,          -- attendance recorded
  ADD COLUMN IF NOT EXISTS reminder_7d_sent_at  timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamptz;

ALTER TABLE sparring_signups
  DROP CONSTRAINT IF EXISTS sparring_signups_status_check;
ALTER TABLE sparring_signups
  ADD CONSTRAINT sparring_signups_status_check
  CHECK (status IN ('pending','waitlisted','confirmed','attended',
                    'no_show','cancelled','cancelled_late','expired'));

-- Existing rows: "row exists = signed up" maps to 'pending' (the column default
-- already backfilled them). They held their slot since signing up.
UPDATE sparring_signups
   SET slot_granted_at = signed_up_at
 WHERE slot_granted_at IS NULL
   AND status IN ('pending','confirmed');

-- ─── 2. Indexes for capacity counts and the lifecycle cron ─────────────────────

CREATE INDEX IF NOT EXISTS sparring_signups_status_idx      ON sparring_signups (sparring_id, status);
CREATE INDEX IF NOT EXISTS sparring_signups_user_status_idx ON sparring_signups (user_id, status);

-- ─── 3. RLS: no direct client mutations any more ───────────────────────────────
-- Join / confirm / cancel / attendance run through SECURITY DEFINER RPCs.
-- The SELECT policy "read sparring signups" stays (participant lists, counts).
-- No UPDATE policy: status changes only via RPC.

DROP POLICY IF EXISTS "insert own signup" ON sparring_signups;
DROP POLICY IF EXISTS "delete own signup" ON sparring_signups;

COMMENT ON COLUMN sparring_signups.status IS
  'Commitment lifecycle: pending | waitlisted | confirmed | attended | no_show | cancelled | cancelled_late | expired. Slots are held by pending + confirmed.';
COMMENT ON COLUMN sparring_signups.slot_granted_at IS
  'When the row last received a slot (join as pending/confirmed or waitlist promotion). Slots granted after the confirm deadline never expire.';
