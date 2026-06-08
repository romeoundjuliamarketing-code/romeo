ALTER TABLE public.fight_records
  ADD COLUMN IF NOT EXISTS is_amateur boolean NOT NULL DEFAULT false;
