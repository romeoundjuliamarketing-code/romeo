ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nickname      text,
  ADD COLUMN IF NOT EXISTS weight_class  text,
  ADD COLUMN IF NOT EXISTS weight_kg     numeric(5,2),
  ADD COLUMN IF NOT EXISTS nationality   text,
  ADD COLUMN IF NOT EXISTS hometown      text,
  ADD COLUMN IF NOT EXISTS bio           text CHECK (char_length(bio) <= 300),
  ADD COLUMN IF NOT EXISTS instagram_url text;
