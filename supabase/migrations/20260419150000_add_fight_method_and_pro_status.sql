-- Add method column to fight_records, replacing is_ko boolean
alter table fight_records
  add column method text check (method in ('ko', 'tko', 'submission', 'decision'));

-- Migrate existing KO flags to method
update fight_records set method = 'ko' where is_ko = true;

alter table fight_records drop column is_ko;

-- Add professional status to profiles
alter table profiles
  add column is_professional boolean;
