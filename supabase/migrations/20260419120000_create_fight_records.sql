create table fight_records (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references profiles(id) on delete cascade,
  result        text        not null check (result in ('win', 'loss', 'draw')),
  is_ko         boolean     not null default false,
  opponent_name text,
  organization  text,
  fight_date    date,
  created_at    timestamptz not null default now()
);

alter table fight_records enable row level security;

create policy "Users manage own fight records"
  on fight_records
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
