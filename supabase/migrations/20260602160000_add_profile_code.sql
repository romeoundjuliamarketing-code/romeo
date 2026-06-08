-- Add unique alphanumeric profile code to every profile.
-- Format: 6 chars from ABCDEFGHJKLMNPQRSTUVWXYZ23456789 (no O/I/L/0/1).
-- Assigned automatically via trigger on INSERT; existing rows backfilled.

ALTER TABLE profiles
  ADD COLUMN profile_code text UNIQUE;

CREATE OR REPLACE FUNCTION generate_unique_profile_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars  text    := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code   text;
  exists boolean;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    SELECT COUNT(*) > 0 INTO exists FROM profiles WHERE profile_code = code;
    EXIT WHEN NOT exists;
  END LOOP;
  RETURN code;
END;
$$;

CREATE OR REPLACE FUNCTION assign_profile_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.profile_code IS NULL THEN
    NEW.profile_code := generate_unique_profile_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_profile_code
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION assign_profile_code();

UPDATE profiles SET profile_code = generate_unique_profile_code() WHERE profile_code IS NULL;

ALTER TABLE profiles ALTER COLUMN profile_code SET NOT NULL;
