-- Allow 'switch' as a third fighting stance (orthodox / southpaw / switch).
alter table profiles drop constraint if exists profiles_stance_check;
alter table profiles add constraint profiles_stance_check
  check (stance in ('orthodox', 'southpaw', 'switch'));
