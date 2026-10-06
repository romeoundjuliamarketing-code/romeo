-- Preferred app language (de/en). NULL = never chosen; server-side texts
-- default to German so old app versions are unaffected.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language text NULL
  CHECK (language IN ('de', 'en'));
