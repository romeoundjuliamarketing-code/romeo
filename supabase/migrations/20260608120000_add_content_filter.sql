-- Content filter: single source of truth for banned words + server enforcement.

create table if not exists public.banned_words (
  id          uuid primary key default gen_random_uuid(),
  word        text not null,
  category    text not null check (category in
                ('profanity','hate','violence','sexual','spam','contact')),
  created_at  timestamptz not null default now()
);

alter table public.banned_words enable row level security;

-- Authenticated clients may read the list (to cache it); nobody writes via API.
drop policy if exists "banned_words_read" on public.banned_words;
create policy "banned_words_read" on public.banned_words
  for select to authenticated using (true);

-- Mirror of the TS normalize(): lowercase, ß->ss, strip accents, leetspeak,
-- non-letters -> spaces, collapse single-letter runs.
create or replace function public.normalize_text(p_text text)
returns text language plpgsql immutable as $$
declare
  s text;
  prev text;
begin
  if p_text is null then return ''; end if;
  s := lower(p_text);
  s := replace(s, 'ß', 'ss');
  s := translate(s,
        'àáâãäåèéêëìíîïòóôõöùúûüçñ',
        'aaaaaaeeeeiiiioooooouuuucn');
  s := translate(s, '013457', 'oieast');
  s := replace(s, '@', 'a');
  s := replace(s, '$', 's');
  s := regexp_replace(s, '[^a-z]+', ' ', 'g');
  s := btrim(s);
  -- collapse runs of single letters: "s c h e i s s e" -> "scheisse"
  loop
    prev := s;
    s := regexp_replace(s, '(^| )([a-z]) ([a-z])($| )', '\1\2\3\4', 'g');
    exit when s = prev;
  end loop;
  return s;
end;
$$;

create or replace function public.is_text_clean(
  p_text text,
  p_allow_contact boolean default false
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_norm text;
  v_word text;
  rec record;
begin
  if p_text is null or btrim(p_text) = '' then return true; end if;
  v_norm := ' ' || public.normalize_text(p_text) || ' ';
  for rec in select word, category from public.banned_words loop
    if p_allow_contact and rec.category = 'contact' then continue; end if;
    v_word := public.normalize_text(rec.word);
    if v_word = '' then continue; end if;
    if position(' ' || v_word || ' ' in v_norm) > 0 then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

-- Enforcement triggers (raise on hit; client validates pre-submit, this guards
-- direct API access).
create or replace function public.enforce_clean_open_sparring()
returns trigger language plpgsql as $$
begin
  if not public.is_text_clean(coalesce(new.title, '')) or
     not public.is_text_clean(coalesce(new.notes, '')) then
    raise exception 'CONTENT_FILTER_BLOCKED';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_clean_open_sparring on public.open_sparrings;
create trigger trg_clean_open_sparring
  before insert or update on public.open_sparrings
  for each row execute function public.enforce_clean_open_sparring();

create or replace function public.enforce_clean_group_message()
returns trigger language plpgsql as $$
begin
  if not public.is_text_clean(coalesce(new.content, '')) then
    raise exception 'CONTENT_FILTER_BLOCKED';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_clean_group_message on public.sparring_group_messages;
create trigger trg_clean_group_message
  before insert or update on public.sparring_group_messages
  for each row execute function public.enforce_clean_group_message();

create or replace function public.enforce_clean_profile_bio()
returns trigger language plpgsql as $$
begin
  -- Bio allows contact info (own profile); instagram_url is never checked.
  if not public.is_text_clean(coalesce(new.bio, ''), true) then
    raise exception 'CONTENT_FILTER_BLOCKED';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_clean_profile_bio on public.profiles;
create trigger trg_clean_profile_bio
  before insert or update on public.profiles
  for each row execute function public.enforce_clean_profile_bio();

create or replace function public.enforce_clean_studio_name()
returns trigger language plpgsql as $$
begin
  if not public.is_text_clean(coalesce(new.name, '')) then
    raise exception 'CONTENT_FILTER_BLOCKED';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_clean_studio_name on public.studios;
create trigger trg_clean_studio_name
  before insert or update on public.studios
  for each row execute function public.enforce_clean_studio_name();

-- Initial conservative seed. Extend later by inserting rows (no deploy needed).
insert into public.banned_words (word, category) values
  -- profanity (DE)
  ('arschloch','profanity'),('arsch','profanity'),('scheisse','profanity'),
  ('wichser','profanity'),('hurensohn','profanity'),('fotze','profanity'),
  ('missgeburt','profanity'),('schlampe','profanity'),('hure','profanity'),
  -- profanity (EN)
  ('fuck','profanity'),('shit','profanity'),('bitch','profanity'),
  ('asshole','profanity'),('motherfucker','profanity'),('cunt','profanity'),
  -- hate
  ('neger','hate'),('nigger','hate'),('kanake','hate'),('judensau','hate'),
  ('schwuchtel','hate'),('faggot','hate'),('untermensch','hate'),
  ('heil hitler','hate'),('sieg heil','hate'),
  -- violence (real threats, not sport talk)
  ('ich bring dich um','violence'),('ich toete dich','violence'),
  ('ich stech dich ab','violence'),('bring dich um','violence'),
  ('i kill you','violence'),('ich mach dich kalt','violence'),
  -- sexual
  ('schwanz','sexual'),('moese','sexual'),('penis','sexual'),
  ('titten','sexual'),('nutte','sexual'),('porno','sexual'),
  ('sex treffen','sexual'),
  -- spam
  ('kaufen sie','spam'),('jetzt kaufen','spam'),('gratis geld','spam'),
  ('http','spam'),('https','spam'),('www','spam'),('rabattcode','spam'),
  -- contact (blocked everywhere except Bio)
  ('whatsapp','contact'),('telegram','contact'),('snapchat','contact'),
  ('schreib mir auf','contact'),('meine nummer','contact'),
  ('ruf mich an','contact');
