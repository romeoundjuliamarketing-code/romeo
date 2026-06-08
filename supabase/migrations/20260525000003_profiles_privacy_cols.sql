-- Add privacy controls to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS show_fight_record boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_stats        boolean NOT NULL DEFAULT true;
