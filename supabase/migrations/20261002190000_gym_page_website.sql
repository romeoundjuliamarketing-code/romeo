-- Reduced gym page (additive, keeps all existing data and rights).
--
-- The gym page shows an optional website. Editing stays owner-only through
-- the existing policy "Studio owners can update their studio"
-- (owner_user_id = auth.uid()); a self-declared home gym
-- (profiles.home_gym_id) grants no rights on the row.

ALTER TABLE public.studios
  ADD COLUMN IF NOT EXISTS website_url text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'studios_website_url_format') THEN
    ALTER TABLE public.studios
      ADD CONSTRAINT studios_website_url_format
      CHECK (website_url IS NULL
             OR (char_length(website_url) <= 200 AND website_url ~* '^https?://[^\s/$.?#].[^\s]*$'));
  END IF;
END $$;
