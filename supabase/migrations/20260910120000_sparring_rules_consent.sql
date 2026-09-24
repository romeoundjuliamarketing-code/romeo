-- Sparring rules consent
--
-- Every sparring signup must record which version of the Sparr-Grundregeln the
-- user accepted. The columns are NOT NULL *without* a default on purpose: a
-- client that forgets to pass the consent cannot silently insert a signup.
--
-- Rows that predate the rules keep rules_version = 0 ("joined before the rules
-- existed"); the insert policy below requires >= 1 for anything new.

ALTER TABLE sparring_signups
  ADD COLUMN IF NOT EXISTS rules_version     smallint,
  ADD COLUMN IF NOT EXISTS rules_accepted_at timestamptz;

UPDATE sparring_signups
   SET rules_version     = 0,
       rules_accepted_at = signed_up_at
 WHERE rules_version IS NULL;

ALTER TABLE sparring_signups
  ALTER COLUMN rules_version     SET NOT NULL,
  ALTER COLUMN rules_accepted_at SET NOT NULL;

ALTER TABLE sparring_signups
  DROP CONSTRAINT IF EXISTS sparring_signups_rules_version_check;
ALTER TABLE sparring_signups
  ADD CONSTRAINT sparring_signups_rules_version_check CHECK (rules_version >= 0);

-- Re-create the insert policy with the consent requirement bolted on. Keeps the
-- verified_only check from 20260614120000_sparring_verified_only.sql.
DROP POLICY IF EXISTS "insert own signup" ON sparring_signups;
CREATE POLICY "insert own signup" ON sparring_signups
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND rules_version >= 1
    AND rules_accepted_at IS NOT NULL
    AND (
      is_user_verified(auth.uid())
      OR NOT EXISTS (
        SELECT 1 FROM open_sparrings os
        WHERE os.id = sparring_id AND os.verified_only = true
      )
    )
  );

COMMENT ON COLUMN sparring_signups.rules_version IS
  'Version of the Sparr-Grundregeln accepted at signup (SPARRING_RULES_VERSION in src/data/sparringRules.ts). 0 = signup predates the rules.';
COMMENT ON COLUMN sparring_signups.rules_accepted_at IS
  'Timestamp the user confirmed the Sparr-Grundregeln for this signup.';
