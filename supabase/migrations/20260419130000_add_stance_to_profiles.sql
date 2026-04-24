alter table profiles
  add column if not exists stance text check (stance in ('orthodox', 'southpaw'));
