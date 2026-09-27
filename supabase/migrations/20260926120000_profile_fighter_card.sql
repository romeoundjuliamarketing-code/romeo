-- Fighter card (profile redesign 2026-09-26): optional personal card fields.
--
-- All columns are optional and additive — older app builds ignore them.
-- Write access is covered by the existing own-row policy "profile_aendern"
-- (auth.uid() = id); read access by "profile_lesen" (authenticated), like
-- every other public profile field.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS card_frame     text NOT NULL DEFAULT 'klassik',
  ADD COLUMN IF NOT EXISTS motto          text,
  ADD COLUMN IF NOT EXISTS favorite_move  text,
  ADD COLUMN IF NOT EXISTS training_focus text;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_card_frame_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_card_frame_check
  CHECK (card_frame IN ('klassik', 'blau', 'nacht'));

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_motto_length_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_motto_length_check
  CHECK (motto IS NULL OR char_length(motto) <= 60);

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_favorite_move_length_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_favorite_move_length_check
  CHECK (favorite_move IS NULL OR char_length(favorite_move) <= 40);

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_training_focus_length_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_training_focus_length_check
  CHECK (training_focus IS NULL OR char_length(training_focus) <= 60);

COMMENT ON COLUMN profiles.card_frame     IS 'Fighter card frame: klassik | blau | nacht (src/data/cardFrames.ts).';
COMMENT ON COLUMN profiles.motto          IS 'Optional short motto on the fighter card (max 60 chars).';
COMMENT ON COLUMN profiles.favorite_move  IS 'Optional favourite move on the fighter card (max 40 chars).';
COMMENT ON COLUMN profiles.training_focus IS 'Optional current training focus (max 60 chars).';
