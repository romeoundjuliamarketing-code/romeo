# i18n Grundgerüst (Teil 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die App kann zwischen Deutsch und Englisch umschalten (Einstellungen), die Wahl bleibt lokal und in `profiles.language` gespeichert, und es gibt typisierte Übersetzungs- und Datums-Helfer, auf die Teil 2 aufbaut.

**Architecture:** Reine Logik (Sprach-Ermittlung, Profil-Sync-Entscheidung, Datumsformat) liegt testbar in `src/utils/`. `src/i18n/` initialisiert i18next mit typisierten DE/EN-Objekten und enthält den Laufzeit-Teil (AsyncStorage, Supabase, Hooks). `App.tsx` wartet beim Start auf die gespeicherte Sprache; `<LanguageSync />` gleicht nach Login mit dem Profil ab.

**Tech Stack:** i18next, react-i18next, expo-localization, AsyncStorage, Supabase, Jest (node env).

**Spec:** `docs/superpowers/specs/2026-10-06-i18n-design.md`

## Global Constraints

- Sprachen: genau `'de' | 'en'`; Fallback `'de'`.
- Locale-Mapping für Formate: `de` → `de-DE`, `en` → `en-GB`.
- AsyncStorage-Key: `sparr.language.v1`.
- DB: `profiles.language text NULL CHECK (language IN ('de','en'))`; NULL = nicht gewählt.
- TypeScript strict, kein `any`; kein Inline-`style={{}}`; Farben nur aus `colors.ts`; Abstände 8er-Raster.
- In Test-Dateien kein `import type`.
- UI-Texte mit echten Umlauten; Code-Kommentare Englisch; keine Emojis.
- Nach jeder Codeänderung `npx tsc --noEmit`.
- `expo-localization` ist ein natives Modul → neuer Dev-Build (iOS + Android) nötig.

## Review Focus

1. Englisches Gerät, Nutzer wählt nie manuell, `profiles.language` ist NULL → nach Login wird `'en'` hochgeladen (Test in Task 1: `decideProfileSync(null, 'en')`).
2. Kaputter/fremder gespeicherter Wert (`'fr'`, `''`, `'EN '`) → ignoriert, Gerätesprache greift (Test in Task 1: `parseLanguage`).
3. Regionale Gerätesprachen (`de-AT`, `de-CH`, `en-US`, `tr-TR`, `undefined`) → `de`, `de`, `en`, `en`, `en` (Test in Task 1).
4. Account-Wechsel auf demselben Gerät: Profil von Nutzer B mit `'de'` überschreibt lokale `'en'` (Test in Task 1: `decideProfileSync('de', 'en')`).
5. Ungültiges Datum an `formatDate` → leerer String statt „Invalid Date“ (Test in Task 2).

---

### Task 1: Reine Sprach-Logik

**Files:**
- Create: `src/utils/language.ts`
- Test: `src/utils/language.test.ts`

**Interfaces:**
- Produces:
  - `type AppLanguage = 'de' | 'en'`
  - `const APP_LANGUAGES: readonly AppLanguage[]`
  - `parseLanguage(value: unknown): AppLanguage | null`
  - `languageFromDeviceTag(tag: string | null | undefined): AppLanguage`
  - `resolveStartupLanguage(stored: unknown, deviceTag: string | null | undefined): AppLanguage`
  - `decideProfileSync(profileLanguage: unknown, current: AppLanguage): { apply: AppLanguage | null; upload: AppLanguage | null }`
  - `localeFor(language: AppLanguage): 'de-DE' | 'en-GB'`

- [ ] **Step 1: Failing test**

```ts
// src/utils/language.test.ts
import {
  parseLanguage, languageFromDeviceTag, resolveStartupLanguage, decideProfileSync, localeFor,
} from './language';

describe('parseLanguage', () => {
  it('accepts de and en', () => {
    expect(parseLanguage('de')).toBe('de');
    expect(parseLanguage('en')).toBe('en');
  });
  it('rejects anything else', () => {
    expect(parseLanguage('fr')).toBeNull();
    expect(parseLanguage('')).toBeNull();
    expect(parseLanguage('EN ')).toBeNull();
    expect(parseLanguage(null)).toBeNull();
    expect(parseLanguage(42)).toBeNull();
  });
});

describe('languageFromDeviceTag', () => {
  it('maps every German variant to de', () => {
    expect(languageFromDeviceTag('de')).toBe('de');
    expect(languageFromDeviceTag('de-AT')).toBe('de');
    expect(languageFromDeviceTag('de-CH')).toBe('de');
    expect(languageFromDeviceTag('DE-de')).toBe('de');
  });
  it('maps everything else to en', () => {
    expect(languageFromDeviceTag('en-US')).toBe('en');
    expect(languageFromDeviceTag('tr-TR')).toBe('en');
    expect(languageFromDeviceTag(undefined)).toBe('en');
    expect(languageFromDeviceTag(null)).toBe('en');
    expect(languageFromDeviceTag('')).toBe('en');
  });
});

describe('resolveStartupLanguage', () => {
  it('prefers a valid stored choice', () => {
    expect(resolveStartupLanguage('en', 'de-DE')).toBe('en');
  });
  it('falls back to the device when stored is invalid', () => {
    expect(resolveStartupLanguage('fr', 'de-DE')).toBe('de');
    expect(resolveStartupLanguage(null, 'en-US')).toBe('en');
  });
});

describe('decideProfileSync', () => {
  it('uploads the current language when the profile has none', () => {
    expect(decideProfileSync(null, 'en')).toEqual({ apply: null, upload: 'en' });
  });
  it('applies the profile language when it differs (account switch)', () => {
    expect(decideProfileSync('de', 'en')).toEqual({ apply: 'de', upload: null });
  });
  it('does nothing when both match', () => {
    expect(decideProfileSync('en', 'en')).toEqual({ apply: null, upload: null });
  });
  it('treats an invalid profile value like none', () => {
    expect(decideProfileSync('xx', 'de')).toEqual({ apply: null, upload: 'de' });
  });
});

describe('localeFor', () => {
  it('maps to the formatting locale', () => {
    expect(localeFor('de')).toBe('de-DE');
    expect(localeFor('en')).toBe('en-GB');
  });
});
```

- [ ] **Step 2:** `npx jest src/utils/language.test.ts` → FAIL („Cannot find module './language'“).

- [ ] **Step 3: Implementation**

```ts
// src/utils/language.ts
// Pure language helpers (no React Native imports, unit-tested in node).

export type AppLanguage = 'de' | 'en';

export const APP_LANGUAGES: readonly AppLanguage[] = ['de', 'en'];

export function parseLanguage(value: unknown): AppLanguage | null {
  return value === 'de' || value === 'en' ? value : null;
}

// Any German variant (de-AT, de-CH, ...) is German; everything else is English.
export function languageFromDeviceTag(tag: string | null | undefined): AppLanguage {
  return tag && tag.toLowerCase().startsWith('de') ? 'de' : 'en';
}

export function resolveStartupLanguage(
  stored: unknown,
  deviceTag: string | null | undefined,
): AppLanguage {
  return parseLanguage(stored) ?? languageFromDeviceTag(deviceTag);
}

// After login: the profile wins when set (cross-device choice); when unset the
// current app language is uploaded so server-side push texts match the UI.
export function decideProfileSync(
  profileLanguage: unknown,
  current: AppLanguage,
): { apply: AppLanguage | null; upload: AppLanguage | null } {
  const fromProfile = parseLanguage(profileLanguage);
  if (fromProfile === null) return { apply: null, upload: current };
  if (fromProfile !== current) return { apply: fromProfile, upload: null };
  return { apply: null, upload: null };
}

export function localeFor(language: AppLanguage): 'de-DE' | 'en-GB' {
  return language === 'de' ? 'de-DE' : 'en-GB';
}
```

- [ ] **Step 4:** `npx jest src/utils/language.test.ts` → PASS; `npx tsc --noEmit` → keine Fehler.

- [ ] **Step 5: Commit**

```bash
git add src/utils/language.ts src/utils/language.test.ts
git commit -m "feat(i18n): reine Sprach-Logik mit Tests"
```

---

### Task 2: Datums-Helfer

**Files:**
- Create: `src/utils/formatDate.ts`
- Test: `src/utils/formatDate.test.ts`

**Interfaces:**
- Consumes: `AppLanguage`, `localeFor` aus Task 1.
- Produces:
  - `type DateFormat = 'date' | 'dayMonth' | 'weekdayLong' | 'time' | 'dateTime'`
  - `formatDate(input: Date | string | number, format: DateFormat, language: AppLanguage): string`

- [ ] **Step 1: Failing test** (lokale Zeit-Konstruktoren, damit die Zeitzone keine Rolle spielt)

```ts
// src/utils/formatDate.test.ts
import { formatDate } from './formatDate';

const d = new Date(2026, 9, 6, 14, 5); // Tue 6 Oct 2026, 14:05 local

describe('formatDate', () => {
  it('formats a numeric date', () => {
    expect(formatDate(d, 'date', 'de')).toBe('06.10.2026');
    expect(formatDate(d, 'date', 'en')).toBe('06/10/2026');
  });
  it('formats day + short month', () => {
    expect(formatDate(d, 'dayMonth', 'de')).toBe('6. Okt.');
    expect(formatDate(d, 'dayMonth', 'en')).toBe('6 Oct');
  });
  it('formats long weekday + day + month', () => {
    expect(formatDate(d, 'weekdayLong', 'de')).toBe('Dienstag, 6. Oktober');
    expect(formatDate(d, 'weekdayLong', 'en')).toBe('Tuesday 6 October');
  });
  it('formats 24h time in both languages', () => {
    expect(formatDate(d, 'time', 'de')).toBe('14:05');
    expect(formatDate(d, 'time', 'en')).toBe('14:05');
  });
  it('accepts ISO strings and timestamps', () => {
    expect(formatDate(d.toISOString(), 'time', 'de')).toBe('14:05');
    expect(formatDate(d.getTime(), 'time', 'en')).toBe('14:05');
  });
  it('returns an empty string for invalid input', () => {
    expect(formatDate('kaputt', 'date', 'de')).toBe('');
    expect(formatDate(Number.NaN, 'time', 'en')).toBe('');
  });
});
```

- [ ] **Step 2:** `npx jest src/utils/formatDate.test.ts` → FAIL (Modul fehlt).

- [ ] **Step 3: Implementation**

```ts
// src/utils/formatDate.ts
import { localeFor, type AppLanguage } from './language';

export type DateFormat = 'date' | 'dayMonth' | 'weekdayLong' | 'time' | 'dateTime';

const OPTIONS: Record<DateFormat, Intl.DateTimeFormatOptions> = {
  date: { day: '2-digit', month: '2-digit', year: 'numeric' },
  dayMonth: { day: 'numeric', month: 'short' },
  weekdayLong: { weekday: 'long', day: 'numeric', month: 'long' },
  time: { hour: '2-digit', minute: '2-digit', hour12: false },
  dateTime: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false },
};

// Single entry point for user-visible dates; returns '' for unparseable input
// so the UI never shows "Invalid Date".
export function formatDate(input: Date | string | number, format: DateFormat, language: AppLanguage): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(localeFor(language), OPTIONS[format]).format(date);
}
```

- [ ] **Step 4:** `npx jest src/utils/formatDate.test.ts` → PASS. Weicht eine ICU-Ausgabe ab (z. B. Komma nach Wochentag in `en-GB`), die Erwartung an die tatsächliche Node-Ausgabe anpassen, sofern sie sprachlich korrekt ist — nicht die Options verbiegen. `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/formatDate.ts src/utils/formatDate.test.ts
git commit -m "feat(i18n): Datums-Helfer formatDate für DE/EN"
```

---

### Task 3: i18next-Setup, Locale-Dateien, Paritäts-Test

**Files:**
- Modify: `package.json` / `package-lock.json` (via `npx expo install`)
- Create: `src/i18n/locales/de.ts`, `src/i18n/locales/en.ts`, `src/i18n/index.ts`, `src/i18n/i18next.d.ts`
- Modify: `jest.config.js` (testMatch um `src/i18n` erweitern)
- Test: `src/i18n/locales.test.ts`

**Interfaces:**
- Consumes: `AppLanguage` aus Task 1.
- Produces:
  - `i18n` (default export von `src/i18n/index.ts`, bereits initialisiert mit `lng: 'de'`)
  - `type LocaleShape<T>`
  - Keys: `settings.language`, `settings.languageGerman`, `settings.languageEnglish`

- [ ] **Step 1: Abhängigkeiten**

```bash
npx expo install i18next react-i18next expo-localization
```

- [ ] **Step 2: Locale-Dateien**

```ts
// src/i18n/locales/de.ts
// Source of truth for all translation keys. en.ts must mirror this shape.
const de = {
  settings: {
    language: 'Sprache',
    languageGerman: 'Deutsch',
    languageEnglish: 'English',
  },
} as const;

export default de;
```

```ts
// src/i18n/locales/en.ts
import type de from './de';

// Same keys as de, any string values. A missing key is a tsc error.
export type LocaleShape<T> = { [K in keyof T]: T[K] extends string ? string : LocaleShape<T[K]> };

const en: LocaleShape<typeof de> = {
  settings: {
    language: 'Language',
    languageGerman: 'Deutsch',
    languageEnglish: 'English',
  },
};

export default en;
```

Language names stay in their own language in both locales (standard for language pickers).

- [ ] **Step 3: Failing parity test** + jest-Config

`jest.config.js` testMatch:

```js
  testMatch: ['**/src/utils/*.test.ts', '**/src/lib/*.test.ts', '**/src/i18n/*.test.ts'],
```

```ts
// src/i18n/locales.test.ts
import de from './locales/de';
import en from './locales/en';

function flatten(obj: object, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

function placeholders(s: string): string[] {
  return (s.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map((p) => p.replace(/\s/g, '')).sort();
}

const flatDe = flatten(de);
const flatEn = flatten(en);

describe('locales', () => {
  it('have identical keys', () => {
    expect(Object.keys(flatEn).sort()).toEqual(Object.keys(flatDe).sort());
  });
  it('have no empty strings', () => {
    for (const [k, v] of [...Object.entries(flatDe), ...Object.entries(flatEn)]) {
      expect({ k, empty: v.trim() === '' }).toEqual({ k, empty: false });
    }
  });
  it('use the same placeholders per key', () => {
    for (const k of Object.keys(flatDe)) {
      expect({ k, p: placeholders(flatEn[k] ?? '') }).toEqual({ k, p: placeholders(flatDe[k]) });
    }
  });
});
```

Run: `npx jest src/i18n/locales.test.ts` → PASS sofort (die Dateien existieren schon). Gegenprobe: in `en.ts` einen Wert auf `''` setzen → Test FAIL, dann zurücksetzen.

- [ ] **Step 4: i18n-Init + Typen**

```ts
// src/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from './locales/de';
import en from './locales/en';

// Initialised synchronously with German; the stored/device language is applied
// by bootstrapLanguage() (src/i18n/language.ts) before the first real render.
void i18n.use(initReactI18next).init({
  resources: { de: { translation: de }, en: { translation: en } },
  lng: 'de',
  fallbackLng: 'de',
  interpolation: { escapeValue: false },
});

export default i18n;
```

```ts
// src/i18n/i18next.d.ts
import type de from './locales/de';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof de };
  }
}
```

- [ ] **Step 5:** `npx tsc --noEmit` → keine Fehler; `npx jest` → alles grün.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json jest.config.js src/i18n
git commit -m "feat(i18n): i18next mit typisierten DE/EN-Locales und Paritäts-Test"
```

---

### Task 4: Datenbank-Spalte `profiles.language`

**Files:**
- Create: `supabase/migrations/20261006130000_profile_language.sql`
- Modify: `src/types/database.types.ts` (profiles Row/Insert/Update)

**Interfaces:**
- Produces: `profiles.language: string | null` in Row; optional in Insert/Update.

- [ ] **Step 1: Migration**

```sql
-- Preferred app language (de/en). NULL = never chosen; server-side texts
-- default to German so old app versions are unaffected.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language text NULL
  CHECK (language IN ('de', 'en'));
```

- [ ] **Step 2: Typen** — in `src/types/database.types.ts` unter `profiles` neben `country_code` ergänzen: Row `language: string | null`, Insert/Update `language?: string | null` (alphabetisch einsortieren wie die Nachbarn).

- [ ] **Step 3:** `npx tsc --noEmit` → keine Fehler.

- [ ] **Step 4: Auf Prod anwenden** — nur nach Bestätigung durch Romeo: Supabase-MCP `apply_migration` (name `profile_language`, SQL aus Step 1). Danach per `execute_sql` prüfen: `select column_name, is_nullable from information_schema.columns where table_name='profiles' and column_name='language';`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261006130000_profile_language.sql src/types/database.types.ts
git commit -m "feat(i18n): profiles.language für Sprachwahl"
```

---

### Task 5: Laufzeit — Bootstrap, `useLanguage`, `LanguageSync`, App-Einbindung

**Files:**
- Create: `src/i18n/language.ts`
- Create: `src/components/common/LanguageSync.tsx`
- Modify: `App.tsx`

**Interfaces:**
- Consumes: `resolveStartupLanguage`, `decideProfileSync`, `parseLanguage`, `AppLanguage` (Task 1); `i18n` (Task 3); `profiles.language` (Task 4); `useAuth()` aus `src/context/AuthContext`.
- Produces:
  - `useLanguageBootstrap(): boolean` (true, sobald die Startsprache angewendet ist)
  - `useLanguage(): { language: AppLanguage; setLanguage: (next: AppLanguage) => Promise<void> }`
  - `syncLanguageWithProfile(userId: string): Promise<void>`
  - `<LanguageSync />` (rendert `null`)

Keine Unit-Tests (Laufzeit-Glue; die Entscheidungslogik ist in Task 1 getestet).

- [ ] **Step 1: `src/i18n/language.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { useTranslation } from 'react-i18next';
import i18n from './index';
import { supabase } from '../lib/supabase';
import {
  decideProfileSync, parseLanguage, resolveStartupLanguage, type AppLanguage,
} from '../utils/language';

// Device-level choice; survives sign-out like the welcome-intro flag.
const STORAGE_KEY = 'sparr.language.v1';

let bootstrapped = false;
let bootstrapPromise: Promise<void> | null = null;

function bootstrap(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = AsyncStorage.getItem(STORAGE_KEY)
      .catch(() => null)
      .then((stored) => {
        const deviceTag = getLocales()[0]?.languageTag ?? null;
        return i18n.changeLanguage(resolveStartupLanguage(stored, deviceTag));
      })
      .then(() => { bootstrapped = true; });
  }
  return bootstrapPromise;
}

export function useLanguageBootstrap(): boolean {
  const [ready, setReady] = useState(bootstrapped);
  useEffect(() => {
    if (ready) return;
    let alive = true;
    void bootstrap().finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [ready]);
  return ready;
}

async function applyLocally(next: AppLanguage): Promise<void> {
  await i18n.changeLanguage(next);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, next);
  } catch (e) {
    console.warn('[i18n] could not persist language', e);
  }
}

async function uploadLanguage(userId: string, next: AppLanguage): Promise<void> {
  const { error } = await supabase.from('profiles').update({ language: next }).eq('id', userId);
  if (error) console.warn('[i18n] could not save language to profile', error.message);
}

export async function syncLanguageWithProfile(userId: string): Promise<void> {
  const { data, error } = await supabase.from('profiles').select('language').eq('id', userId).maybeSingle();
  if (error || !data) return;
  const current = parseLanguage(i18n.language) ?? 'de';
  const { apply, upload } = decideProfileSync(data.language, current);
  if (apply) await applyLocally(apply);
  if (upload) await uploadLanguage(userId, upload);
}

export function useLanguage(): { language: AppLanguage; setLanguage: (next: AppLanguage) => Promise<void> } {
  const { i18n: instance } = useTranslation();
  const language = parseLanguage(instance.language) ?? 'de';
  const setLanguage = useCallback(async (next: AppLanguage): Promise<void> => {
    await applyLocally(next);
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (userId) await uploadLanguage(userId, next);
  }, []);
  return { language, setLanguage };
}
```

- [ ] **Step 2: `src/components/common/LanguageSync.tsx`**

```tsx
import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { syncLanguageWithProfile } from '../../i18n/language';

// Applies the profile language after login / account switch, or uploads the
// local one when the profile has none. Renders nothing.
export default function LanguageSync(): null {
  const { user } = useAuth();
  const userId = user?.id;
  useEffect(() => {
    if (userId) void syncLanguageWithProfile(userId);
  }, [userId]);
  return null;
}
```

- [ ] **Step 3: `App.tsx`**

Imports ergänzen:

```tsx
import './src/i18n';
import { useLanguageBootstrap } from './src/i18n/language';
import LanguageSync from './src/components/common/LanguageSync';
```

In `App()` nach `useFonts(...)`:

```tsx
  const languageReady = useLanguageBootstrap();

  if (!fontsLoaded || !languageReady) {
```

(ersetzt die Zeile `if (!fontsLoaded) {`; der vorhandene Lade-Screen bleibt unverändert.)

Innerhalb `<AuthProvider>` direkt vor `<NavigationContainer …>`:

```tsx
          <LanguageSync />
```

- [ ] **Step 4:** `npx tsc --noEmit` → keine Fehler; `npx jest` → grün.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/language.ts src/components/common/LanguageSync.tsx App.tsx
git commit -m "feat(i18n): Sprach-Bootstrap, useLanguage und Profil-Sync"
```

---

### Task 6: Sprachwahl in den Einstellungen

**Files:**
- Create: `src/components/settings/LanguageSection.tsx`
- Modify: `src/screens/SettingsScreen.tsx` (Abschnitt vor „Konto“ einfügen)

**Interfaces:**
- Consumes: `useLanguage()` (Task 5), `APP_LANGUAGES`, `AppLanguage` (Task 1), Keys `settings.*` (Task 3).
- Produces: `<LanguageSection />` (Karte mit zwei Auswahlzeilen, ohne Header).

- [ ] **Step 1: Komponente**

```tsx
// src/components/settings/LanguageSection.tsx
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/language';
import { APP_LANGUAGES, type AppLanguage } from '../../utils/language';

const LABEL_KEY = {
  de: 'settings.languageGerman',
  en: 'settings.languageEnglish',
} as const satisfies Record<AppLanguage, string>;

export default function LanguageSection(): React.ReactElement {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();

  return (
    <View style={styles.card}>
      {APP_LANGUAGES.map((lang, i) => (
        <React.Fragment key={lang}>
          {i > 0 && <View style={styles.divider} />}
          <TouchableOpacity
            style={styles.row}
            onPress={() => { void setLanguage(lang); }}
            activeOpacity={0.7}
            accessibilityRole="radio"
            accessibilityState={{ checked: language === lang }}
          >
            <MaterialCommunityIcons name="translate" size={20} color={colors.text} />
            <Text style={styles.rowLabel}>{t(LABEL_KEY[lang])}</Text>
            {language === lang && <MaterialCommunityIcons name="check" size={20} color={colors.accentBlue} />}
          </TouchableOpacity>
        </React.Fragment>
      ))}
    </View>
  );
}

// Mirrors the card/row styles of SettingsScreen.
const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 48 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, gap: 16 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.text },
});
```

- [ ] **Step 2: SettingsScreen** — Imports:

```tsx
import { useTranslation } from 'react-i18next';
import LanguageSection from '../components/settings/LanguageSection';
```

In der Komponente: `const { t } = useTranslation();`. Vor `{/* ── Konto ── */}` einfügen:

```tsx
        {/* ── Sprache ── */}
        <SectionHeader title={t('settings.language')} />
        <LanguageSection />

```

(Übrige Settings-Texte bleiben in Teil 1 deutsch — Umstellung in Teil 2.)

- [ ] **Step 3:** `npx tsc --noEmit` → keine Fehler.

- [ ] **Step 4: Manuell (Dev-Build neu, da `expo-localization` nativ):** `npx expo run:ios` und `npx expo run:android`. Prüfen: Einstellungen → Sprache → English → Header „Language“ sofort; App killen und neu starten → bleibt English; in Supabase `profiles.language = 'en'`; Ausloggen/Einloggen mit anderem Account mit `language='de'` → wechselt auf Deutsch. Android: Back-Button aus Einstellungen funktioniert normal.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/LanguageSection.tsx src/screens/SettingsScreen.tsx
git commit -m "feat(i18n): Sprachwahl in den Einstellungen"
```

---

### Task 7: Dokumentation

**Files:**
- Modify (Vault): `02 Projekte/Sparr/Supabase-Contract (Shared).md`, `Funktionen.md` bzw. `Features/Mehrsprachigkeit.md`, `Offene-Punkte.md`, `Dev-Log/2026-10-06.md`
- Modify: `CLAUDE.md` Feature-Map (eine Zeile: i18n, Regel „neue Texte nur über `t()`“)

- [ ] **Step 1:** Contract-Note: `profiles.language` (text NULL, CHECK de|en), Migration `20261006130000_profile_language`, Website nicht betroffen.
- [ ] **Step 2:** `Features/Mehrsprachigkeit.md` anlegen (Teile 1–5, Status) + Zeile in `Funktionen.md`; offene Teile 2–5 in `Offene-Punkte.md`.
- [ ] **Step 3:** Dev-Log-Eintrag (Format aus CLAUDE.md; bei bestehendem Tageseintrag `---`-Trenner).
- [ ] **Step 4:** CLAUDE.md-Zeile ergänzen; commit `docs(i18n): Feature-Map`.
