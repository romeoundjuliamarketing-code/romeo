-- Profile flag (2026-10-06): a fighter can pick a country whose flag is shown
-- under their name. Stored as ISO 3166-1 alpha-2 code, plus the UK home
-- nations as ISO 3166-2 (GB-ENG, GB-SCT, GB-WLS, GB-NIR); list in
-- src/utils/countries.ts.
--
-- Additive and optional — older app builds ignore it. The free-text column
-- "nationality" stays for those builds. Write access via the existing own-row
-- policy, read access like every other public profile field.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS country_code text;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_country_code_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_country_code_check
  CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}(-[A-Z]{3})?$');

COMMENT ON COLUMN profiles.country_code IS 'Flag shown under the profile name: ISO 3166-1 alpha-2 or GB-ENG/GB-SCT/GB-WLS/GB-NIR (src/utils/countries.ts).';
