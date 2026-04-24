-- Table: studio_invite_codes
-- One shareable 6-char code per studio. Regenerating replaces the old code.
create table if not exists public.studio_invite_codes (
  id          uuid        primary key default gen_random_uuid(),
  studio_id   uuid        not null references public.studios(id) on delete cascade,
  code        text        not null,
  expires_at  timestamptz not null,
  created_by  uuid        not null,
  created_at  timestamptz not null default now(),
  constraint studio_invite_codes_studio_id_key unique (studio_id)
);

alter table public.studio_invite_codes enable row level security;

-- Only the studio owner can read or manage codes for their studio
create policy "studio_owner_manage_invite_codes"
  on public.studio_invite_codes
  for all
  using (
    exists (
      select 1 from public.studios
      where id = studio_invite_codes.studio_id
        and owner_user_id = auth.uid()
    )
  );

-- Ensure studio_memberships has a unique constraint so ON CONFLICT works
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'studio_memberships_sub_user_key'
  ) then
    alter table public.studio_memberships
      add constraint studio_memberships_sub_user_key
      unique (subscription_id, user_id);
  end if;
end;
$$;

-- create_studio_invite(p_studio_id) → text
-- Studio owner generates (or regenerates) a 6-char invite code for their studio.
create or replace function public.create_studio_invite(p_studio_id uuid)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not exists (
    select 1 from public.studios
    where id = p_studio_id and owner_user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  -- Generate 6 uppercase hex chars from random bytes
  v_code := upper(substring(encode(gen_random_bytes(4), 'hex') from 1 for 6));

  insert into public.studio_invite_codes (studio_id, code, expires_at, created_by)
  values (p_studio_id, v_code, now() + interval '7 days', auth.uid())
  on conflict (studio_id)
  do update set
    code       = excluded.code,
    expires_at = excluded.expires_at,
    created_by = excluded.created_by;

  return v_code;
end;
$$;

-- accept_studio_invite(p_code) → uuid
-- Any authenticated user redeems a valid code.
-- Inserts a studio_memberships row and updates profiles.studio_id.
-- Returns the studio_id so the client can update local state.
create or replace function public.accept_studio_invite(p_code text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_studio_id       uuid;
  v_subscription_id uuid;
begin
  select studio_id into v_studio_id
  from public.studio_invite_codes
  where upper(code) = upper(p_code) and expires_at > now();

  if v_studio_id is null then
    raise exception 'Ungültiger oder abgelaufener Code';
  end if;

  select sub.id into v_subscription_id
  from public.subscriptions sub
  join public.studios s on s.owner_user_id = sub.user_id
  where s.id = v_studio_id
    and sub.tier = 'studio'
    and sub.status in ('active', 'trialing')
  limit 1;

  if v_subscription_id is null then
    raise exception 'Studio hat kein aktives Abo';
  end if;

  insert into public.studio_memberships (subscription_id, user_id)
  values (v_subscription_id, auth.uid())
  on conflict (subscription_id, user_id) do nothing;

  update public.profiles
  set studio_id = v_studio_id
  where id = auth.uid();

  return v_studio_id;
end;
$$;
