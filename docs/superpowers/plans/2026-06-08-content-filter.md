# Wortfilter (Content Filter) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verhindern, dass Nutzer unangemessenen Freitext (Beleidigung, Hass, Gewaltandrohung, Sexuelles, Spam, Kontaktdaten) in Sparring-Erstellung, Gruppenchat, Profil-Bio und Team-Namen speichern — kostenlos, regelbasiert, client- und serverseitig.

**Architecture:** Eine Wortliste als Single Source of Truth in der DB-Tabelle `banned_words`. Server erzwingt sie via `is_text_clean()` + BEFORE-Trigger (echte Barriere). Client lädt die Liste einmal, cached sie in AsyncStorage und blockiert vor dem Absenden (sofortiges UX-Feedback). Bei Treffer wird hart blockiert mit deutscher Fehlermeldung.

**Tech Stack:** TypeScript (pure util + React-Hook), React Native, Supabase Postgres (plpgsql, RLS, Trigger), Jest.

---

## File Structure

- **Create** `src/utils/contentFilter.ts` — pure Logik: `normalize`, `checkText`, `filterErrorMessage`, Typen. Kein React, keine Wortliste hardcodiert (Liste wird injiziert → testbar).
- **Create** `src/utils/contentFilter.test.ts` — Unit-Tests.
- **Create** `src/hooks/useBannedWords.ts` — lädt + cached die Wortliste.
- **Modify** `src/types/database.types.ts` — `banned_words` Tabellentyp.
- **Modify** `src/components/sparring/CreateSparringSheet.tsx` — Titel/Notizen/Adresse-Check.
- **Modify** `src/screens/SparringGroupChatScreen.tsx` — Chat-Nachricht-Check.
- **Modify** `src/components/profil/ProfileDetailsForm.tsx` — Bio-Check (`allowContactInfo: true`).
- **Create** `supabase/migrations/20260608120000_add_content_filter.sql` — Tabelle, Seed, `normalize_text`, `is_text_clean`, Trigger.

Hinweis: Team-Namen werden ausschliesslich serverseitig (Trigger auf `studios`) geschützt — `createStudio` wird aus 3 Screens aufgerufen, der Trigger deckt alle ab.

---

## Task 1: contentFilter Util (pure TS, TDD)

**Files:**
- Create: `src/utils/contentFilter.ts`
- Test: `src/utils/contentFilter.test.ts`

- [ ] **Step 1: Write the failing test**

`src/utils/contentFilter.test.ts`:
```ts
import { normalize, checkText, filterErrorMessage } from './contentFilter';

const list = [
  { word: 'scheisse', category: 'profanity' as const },
  { word: 'arsch', category: 'profanity' as const },
  { word: 'ich bring dich um', category: 'violence' as const },
  { word: 'whatsapp', category: 'contact' as const },
];

describe('normalize', () => {
  it('lowercases and resolves ß', () => {
    expect(normalize('Scheiße')).toBe('scheisse');
  });
  it('reverses leetspeak', () => {
    expect(normalize('Sch3i55e')).toBe('scheisse');
  });
  it('strips diacritics', () => {
    expect(normalize('ärsch')).toBe('arsch');
  });
  it('collapses spaced-out single letters', () => {
    expect(normalize('s c h e i s s e')).toBe('scheisse');
  });
});

describe('checkText', () => {
  it('passes clean text', () => {
    expect(checkText('Lockeres Boxsparring heute Abend', list)).toEqual({ ok: true });
  });
  it('blocks a profanity word', () => {
    expect(checkText('du bist ein Arsch', list)).toEqual({ ok: false, category: 'profanity' });
  });
  it('blocks leetspeak evasion', () => {
    expect(checkText('so eine Sch3i55e', list)).toEqual({ ok: false, category: 'profanity' });
  });
  it('blocks a multi-word violence phrase', () => {
    expect(checkText('ich bring dich um', list)).toEqual({ ok: false, category: 'violence' });
  });
  it('does NOT false-positive on substrings', () => {
    expect(checkText('wir marschieren zum Studio', list)).toEqual({ ok: true });
  });
  it('blocks contact info by default', () => {
    expect(checkText('schreib mir auf WhatsApp', list)).toEqual({ ok: false, category: 'contact' });
  });
  it('allows contact info when allowContactInfo is set (Bio)', () => {
    expect(checkText('schreib mir auf WhatsApp', list, { allowContactInfo: true })).toEqual({ ok: true });
  });
  it('returns ok for empty text', () => {
    expect(checkText('   ', list)).toEqual({ ok: true });
  });
});

describe('filterErrorMessage', () => {
  it('returns a German message per category', () => {
    expect(filterErrorMessage('hate')).toContain('diskriminierende');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/utils/contentFilter.test.ts`
Expected: FAIL — "Cannot find module './contentFilter'".

- [ ] **Step 3: Write minimal implementation**

`src/utils/contentFilter.ts`:
```ts
// Regelbasierter Wortfilter — pure logic, no React, no network.
// Word list is injected (loaded via useBannedWords) so this stays testable.

export type FilterCategory =
  | 'profanity'
  | 'hate'
  | 'violence'
  | 'sexual'
  | 'spam'
  | 'contact';

export type BannedWord = { word: string; category: FilterCategory };

export type FilterResult = { ok: true } | { ok: false; category: FilterCategory };

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  '$': 's',
};

// Normalize text to defeat common evasion tricks while keeping word tokens.
export function normalize(text: string): string {
  let s = text.toLowerCase();
  s = s.replace(/ß/g, 'ss'); // ß -> ss
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // strip diacritics
  s = s.replace(/[013457@$]/g, (c) => LEET[c] ?? c); // leetspeak
  s = s.replace(/[^a-z]+/g, ' ').trim(); // non-letters -> single space
  // collapse runs of single letters: "s c h e i s s e" -> "scheisse"
  let prev: string;
  do {
    prev = s;
    s = s.replace(/\b([a-z]) (?=[a-z]\b)/g, '$1');
  } while (s !== prev);
  return s;
}

// Whole-word (space-bounded) match avoids substring false positives.
export function checkText(
  text: string,
  bannedWords: BannedWord[],
  opts?: { allowContactInfo?: boolean },
): FilterResult {
  const normalized = normalize(text);
  if (normalized.length === 0) return { ok: true };
  const haystack = ` ${normalized} `;
  for (const bw of bannedWords) {
    if (opts?.allowContactInfo && bw.category === 'contact') continue;
    const needle = normalize(bw.word);
    if (needle.length === 0) continue;
    if (haystack.includes(` ${needle} `)) {
      return { ok: false, category: bw.category };
    }
  }
  return { ok: true };
}

const MESSAGES: Record<FilterCategory, string> = {
  profanity: 'Dein Text enthält unzulässige Wörter. Bitte formuliere ihn freundlicher.',
  hate: 'Dein Text enthält diskriminierende oder hasserfüllte Sprache.',
  violence: 'Dein Text enthält Gewaltandrohungen.',
  sexual: 'Dein Text enthält anstössige oder sexuelle Inhalte.',
  spam: 'Dein Text enthält unerlaubte Werbung oder Links.',
  contact: 'Bitte teile keine Kontaktdaten in diesem Feld.',
};

export function filterErrorMessage(category: FilterCategory): string {
  return MESSAGES[category];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/utils/contentFilter.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/utils/contentFilter.ts src/utils/contentFilter.test.ts
git commit -m "feat(content-filter): add pure word-filter util with tests"
```

---

## Task 2: useBannedWords Hook + DB type

**Files:**
- Create: `src/hooks/useBannedWords.ts`
- Modify: `src/types/database.types.ts`

- [ ] **Step 1: Add the `banned_words` table type**

In `src/types/database.types.ts`, inside the `Tables` object (alphabetical position near other tables), add:
```ts
      banned_words: {
        Row: {
          id: string;
          word: string;
          category: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          word: string;
          category: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          word?: string;
          category?: string;
          created_at?: string;
        };
        Relationships: [];
      };
```

- [ ] **Step 2: Write the hook**

`src/hooks/useBannedWords.ts`:
```ts
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { BannedWord, FilterCategory } from '../utils/contentFilter';

const CACHE_KEY = 'banned_words_cache_v1';

// Loads the banned-words list once: seeds from AsyncStorage for instant
// availability, then refreshes from Supabase and re-caches. Falls back to an
// empty list when offline with no cache (server trigger remains the barrier).
export function useBannedWords(): { bannedWords: BannedWord[] } {
  const [bannedWords, setBannedWords] = useState<BannedWord[]>([]);

  useEffect(() => {
    let active = true;

    (async () => {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached && active) {
        try {
          setBannedWords(JSON.parse(cached) as BannedWord[]);
        } catch {
          // ignore corrupt cache
        }
      }

      const { data, error } = await supabase
        .from('banned_words')
        .select('word, category');
      if (error || data === null || !active) return;

      const list: BannedWord[] = data.map((r) => ({
        word: r.word,
        category: r.category as FilterCategory,
      }));
      setBannedWords(list);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(list));
    })();

    return () => {
      active = false;
    };
  }, []);

  return { bannedWords };
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useBannedWords.ts src/types/database.types.ts
git commit -m "feat(content-filter): add useBannedWords hook and DB type"
```

---

## Task 3: Client check in CreateSparringSheet

**Files:**
- Modify: `src/components/sparring/CreateSparringSheet.tsx` (imports; submit handler around line 233-269; error display)

- [ ] **Step 1: Add imports and hook**

At the top of `CreateSparringSheet.tsx`, add near the other imports:
```ts
import { checkText, filterErrorMessage } from '../../utils/contentFilter';
import { useBannedWords } from '../../hooks/useBannedWords';
```
Inside the component (near the other `useState` calls, e.g. after `const [notes, setNotes] = useState('');`):
```ts
  const { bannedWords } = useBannedWords();
  const [filterError, setFilterError] = useState<string | null>(null);
```

- [ ] **Step 2: Guard the submit handler**

In the submit handler (the function that currently validates `title.trim().length === 0` around line 233), immediately after that title-empty validation and before building `resolvedTitle`/calling the create RPC, insert:
```ts
    setFilterError(null);
    for (const field of [title, notes, address]) {
      const verdict = checkText(field, bannedWords);
      if (!verdict.ok) {
        setFilterError(filterErrorMessage(verdict.category));
        return;
      }
    }
```
Note: use the actual address state variable name present in the file (the TextInput around line 348-359). If the address field is only shown in coach mode, only include it in the loop when that mode is active. If there is no `address` state, check `[title, notes]` only.

- [ ] **Step 3: Show the error**

Add a `Text` element rendering `filterError` near the submit button (follow the existing error/validation text pattern in the file; use `colors` from the theme, no hardcoded hex, `StyleSheet`):
```tsx
        {filterError !== null && <Text style={styles.errorText}>{filterError}</Text>}
```
If no `errorText` style exists, add one to the StyleSheet:
```ts
  errorText: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: colors.danger,
    marginTop: 8,
  },
```
Use the existing error/danger color key from `src/theme/colors.ts` (check the file for the exact key, e.g. `colors.danger` or `colors.error`; do not hardcode).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/sparring/CreateSparringSheet.tsx
git commit -m "feat(content-filter): block banned words in sparring creation"
```

---

## Task 4: Client check in SparringGroupChatScreen

**Files:**
- Modify: `src/screens/SparringGroupChatScreen.tsx` (imports; the send handler that calls `sendText`)

- [ ] **Step 1: Add imports and hook**

Near the other imports in `SparringGroupChatScreen.tsx`:
```ts
import { checkText, filterErrorMessage } from '../utils/contentFilter';
import { useBannedWords } from '../hooks/useBannedWords';
```
Inside the component, near the existing `useState`/hook calls:
```ts
  const { bannedWords } = useBannedWords();
```

- [ ] **Step 2: Guard the send handler**

Find the handler that reads the input value and calls `sendText(...)`. At the start of that handler, before calling `sendText`, insert (replace `inputValue` with the actual input state variable in the file):
```ts
    const verdict = checkText(inputValue, bannedWords);
    if (!verdict.ok) {
      Alert.alert('Nachricht blockiert', filterErrorMessage(verdict.category));
      return;
    }
```
Ensure `Alert` is imported from `react-native` (add to the existing `react-native` import if missing). If the screen already surfaces send errors via an inline banner instead of `Alert`, reuse that pattern instead of `Alert`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/screens/SparringGroupChatScreen.tsx
git commit -m "feat(content-filter): block banned words in sparring group chat"
```

---

## Task 5: Client check in ProfileDetailsForm (Bio)

**Files:**
- Modify: `src/components/profil/ProfileDetailsForm.tsx` (imports; save handler around line 127-141; error display). The `instagram_url` field is NOT checked. Bio uses `allowContactInfo: true`.

- [ ] **Step 1: Add imports and hook**

Near the other imports in `ProfileDetailsForm.tsx`:
```ts
import { checkText, filterErrorMessage } from '../../utils/contentFilter';
import { useBannedWords } from '../../hooks/useBannedWords';
```
Inside the component, near the existing `useState` calls (e.g. after `const [bio, setBio] = useState(...)`):
```ts
  const { bannedWords } = useBannedWords();
  const [filterError, setFilterError] = useState<string | null>(null);
```

- [ ] **Step 2: Guard the save handler**

In the save handler (around line 127, the function that calls `updateProfile({...})`), before the `await updateProfile(...)` call, insert:
```ts
    setFilterError(null);
    const bioVerdict = checkText(bio, bannedWords, { allowContactInfo: true });
    if (!bioVerdict.ok) {
      setFilterError(filterErrorMessage(bioVerdict.category));
      return;
    }
```
Do NOT check `instagramUrl` — the Instagram field is intentionally exempt.

- [ ] **Step 3: Show the error**

Near the Bio field (around line 331-341) or the save button, render the error following the file's existing text/style conventions:
```tsx
        {filterError !== null && <Text style={styles.filterError}>{filterError}</Text>}
```
Add the style if none fits:
```ts
  filterError: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: colors.danger,
    marginTop: 8,
  },
```
Use the actual danger/error color key from `src/theme/colors.ts`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/profil/ProfileDetailsForm.tsx
git commit -m "feat(content-filter): block banned words in profile bio"
```

---

## Task 6: Server migration — table, seed, functions, triggers

**Files:**
- Create: `supabase/migrations/20260608120000_add_content_filter.sql`

This is the real barrier and the single source of truth for the word list. It mirrors the TS normalization closely enough to catch the same obvious cases.

- [ ] **Step 1: Write the migration**

`supabase/migrations/20260608120000_add_content_filter.sql`:
```sql
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
```

- [ ] **Step 2: Apply the migration**

Apply via the Supabase MCP `apply_migration` tool (name: `add_content_filter`) OR, if using the Supabase CLI locally, `supabase db push`. Confirm with the user which path to use before applying — applying writes directly to the remote project. After applying, verify the table exists:
```sql
select category, count(*) from public.banned_words group by category;
```
Expected: rows for profanity, hate, violence, sexual, spam, contact.

- [ ] **Step 3: Smoke-test the server function**

Run via SQL:
```sql
select public.is_text_clean('Lockeres Boxsparring');          -- true
select public.is_text_clean('du bist ein Arsch');             -- false
select public.is_text_clean('Sch3i55e');                      -- false
select public.is_text_clean('wir marschieren zum Studio');    -- true
select public.is_text_clean('schreib mir auf whatsapp');      -- false
select public.is_text_clean('schreib mir auf whatsapp', true);-- true (bio)
```
Expected results as commented.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260608120000_add_content_filter.sql
git commit -m "feat(content-filter): add banned_words table, functions, triggers and seed"
```

---

## Final verification

- [ ] `npx tsc --noEmit` — no errors
- [ ] `npx jest src/utils/contentFilter.test.ts` — all pass
- [ ] Manual smoke test in app: verbotenes Wort in Sparring-Titel → blockiert; im Chat → blockiert; in Bio → blockiert; IG-Handle im `instagram_url`-Feld → erlaubt; "Massage"/"marschieren" → erlaubt.
- [ ] Update Obsidian: `Funktionen.md` (neues Feature Wortfilter) + Dev-Log `2026-06-08.md` per CLAUDE.md-Regeln.

## Notes for the implementer

- Keine Hardcoded-Hex-Farben — immer `colors.*` aus `src/theme/colors.ts`. Den exakten Danger/Error-Key im File nachschlagen.
- Kein Inline-Styling — `StyleSheet.create`.
- Abstände in 8er-Vielfachen.
- UI-Texte Deutsch, Umlaute echt (ä ö ü), keine Emojis.
- `any` ist verboten.
- Die exakten State-Variablennamen (z.B. Adresse in CreateSparringSheet, Input-Variable im Chat) im jeweiligen File verifizieren statt raten.
```
