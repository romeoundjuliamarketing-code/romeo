-- Add training_frequency column to profiles.
-- Allowed values: 'low', 'medium', 'high' (enforced by app, not DB constraint).
-- null = not yet set; app defaults to 'low' in that case.
alter table public.profiles
  add column if not exists training_frequency text default null;
