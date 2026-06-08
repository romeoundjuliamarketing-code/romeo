# Nutzer-Verifizierung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nutzer können sich kostenlos verifizieren (E-Mail-OTP, Adresse, Coach-Bestätigung) mit Bot-Schutz beim Registrieren; ein gestuftes "Verifiziert"-Badge zeigt den Status.

**Architecture:** Verifizierungs-Flags werden serverseitig in einer `SECURITY DEFINER`-RPC `get_my_verification()` ermittelt (E-Mail aus `auth.users`, Studio aus `studio_memberships`, Coach-Vouch + Adresse aus `profiles`). Die Stufe (`unverified`/`basic`/`verified`) wird client-seitig aus den Flags via der puren, getesteten Funktion `computeVerificationTier()` berechnet. Telefon-Felder werden angelegt, SMS bleibt deaktiviert.

**Tech Stack:** React Native + Expo SDK 55, Supabase (Postgres RPCs, Auth OTP), Cloudflare Turnstile (via `react-native-webview`), Nominatim-Geocoding (bestehend), TypeScript strict, Jest.

**Spec:** `docs/superpowers/specs/2026-06-06-user-verification-design.md`

**Konventionen (Projektregeln, in jedem Task einhalten):**
- Nach jeder Codeänderung `npx tsc --noEmit` — muss fehlerfrei sein.
- Keine Emojis, keine Hardcoded-Hex-Farben (nur `colors.*`), kein Inline-`style={{}}` (nur `StyleSheet.create`), Abstände in 8er-Vielfachen.
- UI-Texte Deutsch mit echten Umlauten (Ä/Ö/Ü/ä/ö/ü), Code-Kommentare Englisch.
- `any` verboten. Bestehende Hook-/RPC-Muster folgen.

---

## File Structure

**Neu:**
- `supabase/migrations/20260606143200_add_user_verification.sql` — Schema-Spalten + RPCs `get_my_verification`, `verify_member`.
- `src/utils/verificationTier.ts` — pure Funktion `computeVerificationTier(flags)` + Typen.
- `src/utils/verificationTier.test.ts` — Unit-Tests.
- `src/hooks/useVerification.ts` — lädt Flags, leitet Tier ab, bietet `updateAddress`/`updatePhone`/`refetch`.
- `src/screens/auth/VerifyEmailScreen.tsx` — OTP-Code-Eingabe.
- `src/components/auth/TurnstileWidget.tsx` — WebView-Wrapper für Cloudflare Turnstile.
- `src/components/common/VerifiedBadge.tsx` — Häkchen-Badge.
- `src/components/profil/VerificationSection.tsx` — Checkliste mit CTAs im Profil.

**Geändert:**
- `src/types/database.types.ts` — neue `profiles`-Spalten + RPC-Typen.
- `src/context/AuthContext.tsx` — `signUp` nimmt optionalen `captchaToken`.
- `src/navigation/types.ts` — `VerifyEmail`-Route in `AuthStackParamList`.
- `src/navigation/RootNavigator.tsx` — `VerifyEmail`-Screen registrieren.
- `src/screens/auth/RegisterScreen.tsx` — Turnstile-Token + Navigation zu `VerifyEmail`.
- `src/screens/ProfilScreen.tsx` — `VerificationSection` einbinden, Badge am Namen.
- `src/screens/PublicProfileScreen.tsx` — Coach-Vouch-Button + Badge.
- `.env` (lokal, nicht committen) — `EXPO_PUBLIC_TURNSTILE_SITE_KEY`.

**Manuelle Konfiguration (außerhalb Code, in Task 16 dokumentiert):** Supabase-Dashboard (Confirm email an, OTP-Template, Turnstile-Captcha, Resend-SMTP) + Strato-DNS für `send.sparrshop.de`.

---

## Phase 1 — Schema & Typen

### Task 1: Migration (Spalten + RPCs)

**Files:**
- Create: `supabase/migrations/20260606143200_add_user_verification.sql`

- [ ] **Step 1: Migration schreiben**

```sql
-- User verification: free, layered "verified" badge.
-- Adds nullable profile columns (address/phone/coach-vouch) and two SECURITY DEFINER RPCs.

-- ── Profile columns (all nullable, non-breaking) ──────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS address           text,
  ADD COLUMN IF NOT EXISTS address_lat       double precision,
  ADD COLUMN IF NOT EXISTS address_lng       double precision,
  ADD COLUMN IF NOT EXISTS phone             text,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS coach_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS coach_verified_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- ── get_my_verification: returns raw flags for the calling user ────────────────
-- Tier is computed client-side from these flags (see src/utils/verificationTier.ts).
CREATE OR REPLACE FUNCTION get_my_verification()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid             uuid := auth.uid();
  v_email_verified  boolean;
  v_address_verified boolean;
  v_studio_verified boolean;
  v_coach_vouched   boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT (email_confirmed_at IS NOT NULL)
    INTO v_email_verified
    FROM auth.users WHERE id = v_uid;

  SELECT (address_lat IS NOT NULL), (coach_verified_at IS NOT NULL)
    INTO v_address_verified, v_coach_vouched
    FROM profiles WHERE id = v_uid;

  SELECT EXISTS (
    SELECT 1 FROM studio_memberships
    WHERE user_id = v_uid AND status = 'active'
  ) INTO v_studio_verified;

  RETURN json_build_object(
    'email_verified',   COALESCE(v_email_verified, false),
    'address_verified', COALESCE(v_address_verified, false),
    'studio_verified',  COALESCE(v_studio_verified, false),
    'coach_vouched',    COALESCE(v_coach_vouched, false),
    'phone_verified',   false  -- SMS not enabled (cost); always false for now
  );
END;
$$;

-- ── verify_member: a coach vouches that a member is a real person ──────────────
-- Caller must be a coach in the same studio as the target. Self-vouch blocked.
CREATE OR REPLACE FUNCTION verify_member(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_is_coach     boolean;
  v_coach_studio uuid;
  v_target_studio uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_user_id = v_uid THEN
    RAISE EXCEPTION 'cannot_verify_self';
  END IF;

  SELECT is_coach, studio_id INTO v_is_coach, v_coach_studio
    FROM profiles WHERE id = v_uid;
  IF v_is_coach IS NOT TRUE THEN
    RAISE EXCEPTION 'not_a_coach';
  END IF;

  SELECT studio_id INTO v_target_studio FROM profiles WHERE id = p_user_id;
  IF v_coach_studio IS NULL OR v_target_studio IS NULL OR v_coach_studio <> v_target_studio THEN
    RAISE EXCEPTION 'not_same_studio';
  END IF;

  UPDATE profiles
     SET coach_verified_at = now(),
         coach_verified_by = v_uid
   WHERE id = p_user_id;

  RETURN json_build_object('ok', true);
END;
$$;

-- ── Permissions: authenticated only, never anon/public ────────────────────────
REVOKE EXECUTE ON FUNCTION get_my_verification()      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION verify_member(uuid)        FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION get_my_verification()      TO authenticated;
GRANT  EXECUTE ON FUNCTION verify_member(uuid)        TO authenticated;
```

- [ ] **Step 2: Migration anwenden**

Über Supabase MCP `apply_migration` (Name `add_user_verification`) ODER `supabase db push`.
Erwartung: erfolgreich, keine Fehler. Prüfen: `select get_my_verification();` als eingeloggter User gibt JSON mit 5 Flags zurück.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260606143200_add_user_verification.sql
git commit -m "feat(verification): add profile columns + get_my_verification/verify_member RPCs"
```

---

### Task 2: TypeScript-Typen nachziehen

**Files:**
- Modify: `src/types/database.types.ts` (profiles Row/Insert/Update + Functions)

- [ ] **Step 1: profiles-Spalten ergänzen**

In `profiles.Row` die neuen Felder hinzufügen (neben den bestehenden wie `profile_code`):

```ts
          address: string | null
          address_lat: number | null
          address_lng: number | null
          phone: string | null
          phone_verified_at: string | null
          coach_verified_at: string | null
          coach_verified_by: string | null
```

Dieselben Felder in `profiles.Insert` und `profiles.Update` jeweils als optional ergänzen:

```ts
          address?: string | null
          address_lat?: number | null
          address_lng?: number | null
          phone?: string | null
          phone_verified_at?: string | null
          coach_verified_at?: string | null
          coach_verified_by?: string | null
```

- [ ] **Step 2: RPC-Typen ergänzen**

Im `Functions: {` Block hinzufügen:

```ts
      get_my_verification: {
        Args: Record<string, never>
        Returns: {
          email_verified: boolean
          address_verified: boolean
          studio_verified: boolean
          coach_vouched: boolean
          phone_verified: boolean
        }
      }
      verify_member: {
        Args: { p_user_id: string }
        Returns: Json
      }
```

- [ ] **Step 3: tsc prüfen**

Run: `npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/types/database.types.ts
git commit -m "feat(verification): add db types for verification columns + RPCs"
```

---

## Phase 2 — Pure Logik & Hook

### Task 3: computeVerificationTier (TDD)

**Files:**
- Create: `src/utils/verificationTier.ts`
- Test: `src/utils/verificationTier.test.ts`

- [ ] **Step 1: Failing test schreiben**

`src/utils/verificationTier.test.ts` (kein `import type` — Babel-Regel; `as const` nutzen):

```ts
import { computeVerificationTier } from './verificationTier';

const base = {
  email_verified: false,
  address_verified: false,
  studio_verified: false,
  coach_vouched: false,
  phone_verified: false,
};

describe('computeVerificationTier', () => {
  it('unverified when nothing is set', () => {
    expect(computeVerificationTier(base)).toBe('unverified');
  });

  it('basic when only email is verified', () => {
    expect(computeVerificationTier({ ...base, email_verified: true })).toBe('basic');
  });

  it('stays unverified without email even if studio is verified', () => {
    expect(computeVerificationTier({ ...base, studio_verified: true })).toBe('unverified');
  });

  it('verified when email + studio', () => {
    expect(computeVerificationTier({ ...base, email_verified: true, studio_verified: true })).toBe('verified');
  });

  it('verified when email + coach vouch', () => {
    expect(computeVerificationTier({ ...base, email_verified: true, coach_vouched: true })).toBe('verified');
  });

  it('verified when email + address', () => {
    expect(computeVerificationTier({ ...base, email_verified: true, address_verified: true })).toBe('verified');
  });
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag bestätigen**

Run: `npx jest src/utils/verificationTier.test.ts`
Expected: FAIL — `computeVerificationTier` nicht gefunden.

- [ ] **Step 3: Implementierung schreiben**

`src/utils/verificationTier.ts`:

```ts
export interface VerificationFlags {
  email_verified: boolean;
  address_verified: boolean;
  studio_verified: boolean;
  coach_vouched: boolean;
  phone_verified: boolean;
}

export type VerificationTier = 'unverified' | 'basic' | 'verified';

// Central tier rule (adjust here without touching the DB):
// basic    = email verified
// verified = basic AND at least one "real person" signal
//            (active studio membership OR coach vouch OR verified address)
export function computeVerificationTier(flags: VerificationFlags): VerificationTier {
  if (!flags.email_verified) return 'unverified';
  const realPerson =
    flags.studio_verified || flags.coach_vouched || flags.address_verified || flags.phone_verified;
  return realPerson ? 'verified' : 'basic';
}
```

- [ ] **Step 4: Test ausführen, Erfolg bestätigen**

Run: `npx jest src/utils/verificationTier.test.ts`
Expected: PASS (6 Tests grün).

- [ ] **Step 5: tsc + Commit**

```bash
npx tsc --noEmit
git add src/utils/verificationTier.ts src/utils/verificationTier.test.ts
git commit -m "feat(verification): add computeVerificationTier pure function with tests"
```

---

### Task 4: useVerification Hook

**Files:**
- Create: `src/hooks/useVerification.ts`

- [ ] **Step 1: Hook schreiben**

`src/hooks/useVerification.ts`:

```ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { geocodeAddress } from '../utils/geocoding';
import { computeVerificationTier, type VerificationFlags, type VerificationTier } from '../utils/verificationTier';

const EMPTY_FLAGS: VerificationFlags = {
  email_verified: false,
  address_verified: false,
  studio_verified: false,
  coach_vouched: false,
  phone_verified: false,
};

export function useVerification(refetchTrigger = 0): {
  flags: VerificationFlags;
  tier: VerificationTier;
  loading: boolean;
  refetch: () => void;
  updateAddress: (address: string) => Promise<{ error: string | null }>;
  updatePhone: (phone: string) => Promise<{ error: string | null }>;
} {
  const [flags, setFlags] = useState<VerificationFlags>(EMPTY_FLAGS);
  const [loading, setLoading] = useState(true);
  const [localTrigger, setLocalTrigger] = useState(0);

  const refetch = useCallback(() => setLocalTrigger(v => v + 1), []);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_my_verification');
      if (active) {
        if (error === null && data !== null) {
          setFlags(data as VerificationFlags);
        }
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [refetchTrigger, localTrigger]);

  const updateAddress = useCallback(async (address: string): Promise<{ error: string | null }> => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (uid === undefined) return { error: 'not_authenticated' };
    const trimmed = address.trim();
    const coords = await geocodeAddress(trimmed);
    const { error } = await supabase
      .from('profiles')
      .update({ address: trimmed, address_lat: coords?.lat ?? null, address_lng: coords?.lng ?? null })
      .eq('id', uid);
    if (error === null) refetch();
    return { error: error?.message ?? null };
  }, [refetch]);

  const updatePhone = useCallback(async (phone: string): Promise<{ error: string | null }> => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (uid === undefined) return { error: 'not_authenticated' };
    // Phone is stored but NOT verified (SMS disabled, cost). phone_verified_at stays null.
    const { error } = await supabase.from('profiles').update({ phone: phone.trim() }).eq('id', uid);
    if (error === null) refetch();
    return { error: error?.message ?? null };
  }, [refetch]);

  return { flags, tier: computeVerificationTier(flags), loading, refetch, updateAddress, updatePhone };
}
```

- [ ] **Step 2: tsc + Commit**

```bash
npx tsc --noEmit
git add src/hooks/useVerification.ts
git commit -m "feat(verification): add useVerification hook"
```

---

## Phase 3 — E-Mail-OTP-Flow

### Task 5: AuthContext signUp + captchaToken + Navigation-Typ

**Files:**
- Modify: `src/context/AuthContext.tsx:10`, `:40-43`
- Modify: `src/navigation/types.ts:3-6`

- [ ] **Step 1: signUp-Signatur erweitern**

In `src/context/AuthContext.tsx` die Interface-Zeile ersetzen:

```ts
  signUp: (email: string, password: string, captchaToken?: string) => Promise<{ error: AuthError | null }>;
```

und die Implementierung:

```ts
  const signUp = async (email: string, password: string, captchaToken?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: captchaToken !== undefined ? { captchaToken } : undefined,
    });
    return { error };
  };
```

- [ ] **Step 2: Navigation-Typ ergänzen**

In `src/navigation/types.ts` `AuthStackParamList` erweitern:

```ts
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmail: { email: string };
};
```

- [ ] **Step 3: tsc + Commit**

```bash
npx tsc --noEmit
git add src/context/AuthContext.tsx src/navigation/types.ts
git commit -m "feat(verification): signUp accepts captchaToken, add VerifyEmail route type"
```

---

### Task 6: VerifyEmailScreen

**Files:**
- Create: `src/screens/auth/VerifyEmailScreen.tsx`

- [ ] **Step 1: Screen schreiben**

`src/screens/auth/VerifyEmailScreen.tsx`:

```tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import type { AuthStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'VerifyEmail'>;
type Rt = RouteProp<AuthStackParamList, 'VerifyEmail'>;

export default function VerifyEmailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { email } = route.params;

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const handleVerify = async () => {
    if (code.trim().length !== 6) {
      setError('Bitte gib den 6-stelligen Code ein.');
      return;
    }
    setError(null);
    setLoading(true);
    const { error: otpError } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'signup',
    });
    setLoading(false);
    if (otpError) {
      setError('Code ungültig oder abgelaufen. Bitte erneut versuchen.');
    }
    // On success the auth state listener establishes the session and navigates onward.
  };

  const handleResend = async () => {
    setError(null);
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email });
    if (resendError) {
      setError('Code konnte nicht erneut gesendet werden. Bitte kurz warten.');
    } else {
      setResent(true);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={colors.headerTextPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>E-Mail bestätigen</Text>
          <Text style={styles.subtitle}>Wir haben einen 6-stelligen Code an {email} geschickt.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Bestätigungscode</Text>
            <View style={styles.inputRow}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.inactive} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                placeholderTextColor={colors.inactive}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
            </View>
          </View>

          {error !== null && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={15} color={colors.deleteRed} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleVerify}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={colors.headerTextPrimary} />
              : <Text style={styles.buttonText}>Bestätigen</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleResend} style={styles.resendButton}>
            <Text style={styles.resendText}>{resent ? 'Code erneut gesendet' : 'Code erneut senden'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.headerBg },
  flex: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40 },
  backButton: { marginBottom: 16, alignSelf: 'flex-start' },
  title: { fontSize: 28, fontWeight: '800', color: colors.headerTextPrimary, letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 15, color: colors.headerTextSecondary, lineHeight: 22 },
  card: {
    flex: 1, backgroundColor: colors.background,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingTop: 32, paddingBottom: 48,
  },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 18, color: colors.text, letterSpacing: 4 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  errorText: { fontSize: 13, color: colors.deleteRed, flex: 1 },
  button: {
    backgroundColor: colors.headerBg, borderRadius: 12, height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.headerTextPrimary, fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  resendButton: { alignItems: 'center', paddingVertical: 8 },
  resendText: { fontSize: 14, color: colors.accentBlue, fontWeight: '600' },
});
```

- [ ] **Step 2: tsc + Commit**

```bash
npx tsc --noEmit
git add src/screens/auth/VerifyEmailScreen.tsx
git commit -m "feat(verification): add VerifyEmailScreen (OTP code entry)"
```

---

### Task 7: Register-Navigation + Route registrieren

**Files:**
- Modify: `src/navigation/RootNavigator.tsx:71-78` (AuthNavigator)
- Modify: `src/screens/auth/RegisterScreen.tsx` (Erfolg → Navigation statt Success-State)

- [ ] **Step 1: VerifyEmail-Screen registrieren**

In `src/navigation/RootNavigator.tsx` Import ergänzen (bei den anderen auth-Imports):

```ts
import VerifyEmailScreen from '../screens/auth/VerifyEmailScreen';
```

und im `AuthStack.Navigator`:

```tsx
      <AuthStack.Screen name="Login"    component={LoginScreen}    />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
```

- [ ] **Step 2: RegisterScreen nach signUp navigieren**

In `src/screens/auth/RegisterScreen.tsx` den Erfolgszweig in `handleRegister` (Zeile ~59-61) ändern:

```ts
    } else {
      navigation.navigate('VerifyEmail', { email: email.trim() });
    }
```

Den `success`-State, das `setSuccess(true)` und den kompletten `if (success) { ... }`-Block (Zeilen ~33, 60, 64-81) sowie die zugehörigen Styles `successContainer/successIcon/successTitle/successText` entfernen (werden durch den neuen Screen ersetzt).

- [ ] **Step 3: tsc prüfen**

Run: `npx tsc --noEmit`
Expected: keine Fehler (insb. keine ungenutzten `success`-Referenzen).

- [ ] **Step 4: Commit**

```bash
git add src/navigation/RootNavigator.tsx src/screens/auth/RegisterScreen.tsx
git commit -m "feat(verification): route to VerifyEmailScreen after signup"
```

---

## Phase 4 — Turnstile Bot-Wall

### Task 8: react-native-webview + TurnstileWidget

**Files:**
- Modify: `package.json` (via expo install)
- Create: `src/components/auth/TurnstileWidget.tsx`
- Modify: `.env` (lokal) — `EXPO_PUBLIC_TURNSTILE_SITE_KEY`

- [ ] **Step 1: WebView installieren**

Run: `npx expo install react-native-webview`
Expected: Eintrag in `package.json`. (Native Modul → Dev-Build nötig, siehe Task 16.)

- [ ] **Step 2: .env-Eintrag (lokal, NICHT committen)**

In `.env` ergänzen (Wert aus Cloudflare-Turnstile-Dashboard, Task 16):

```
EXPO_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAA...
```

- [ ] **Step 3: TurnstileWidget schreiben**

`src/components/auth/TurnstileWidget.tsx`:

```tsx
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

const SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '';

interface TurnstileWidgetProps {
  onToken: (token: string) => void;
}

// Renders Cloudflare Turnstile inside a WebView and posts the token back to RN.
export default function TurnstileWidget({ onToken }: TurnstileWidgetProps) {
  const html = useMemo(
    () => `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<style>html,body{margin:0;padding:0;background:transparent;display:flex;justify-content:center}</style>
</head><body>
<div class="cf-turnstile" data-sitekey="${SITE_KEY}"
     data-callback="onTok" data-theme="light"></div>
<script>
function onTok(t){ if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(t); } }
</script>
</body></html>`,
    [],
  );

  const handleMessage = (e: WebViewMessageEvent) => {
    const token = e.nativeEvent.data;
    if (token.length > 0) onToken(token);
  };

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://send.sparrshop.de' }}
        onMessage={handleMessage}
        scrollEnabled={false}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 72, marginBottom: 16 },
  webview: { backgroundColor: 'transparent', flex: 1 },
});
```

- [ ] **Step 4: tsc + Commit**

```bash
npx tsc --noEmit
git add package.json package-lock.json src/components/auth/TurnstileWidget.tsx
git commit -m "feat(verification): add Turnstile WebView widget"
```

---

### Task 9: Turnstile in RegisterScreen einbinden

**Files:**
- Modify: `src/screens/auth/RegisterScreen.tsx`

- [ ] **Step 1: Token-State + Widget einbauen**

Import ergänzen:

```ts
import TurnstileWidget from '../../components/auth/TurnstileWidget';
```

State ergänzen (bei den anderen `useState`):

```ts
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
```

In `handleRegister` vor dem `signUp`-Aufruf prüfen und Token mitgeben:

```ts
    if (captchaToken === null) {
      setError('Bitte bestätige, dass du kein Roboter bist.');
      return;
    }
    setError(null);
    setLoading(true);
    const { error: authError } = await signUp(email.trim(), password, captchaToken);
```

Im JSX direkt vor dem "Registrieren-Button" das Widget rendern:

```tsx
            <TurnstileWidget onToken={setCaptchaToken} />
```

- [ ] **Step 2: tsc prüfen**

Run: `npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/screens/auth/RegisterScreen.tsx
git commit -m "feat(verification): require Turnstile token on signup"
```

---

## Phase 5 — Badge-UI & Verifizierungs-Sektion

### Task 10: VerifiedBadge-Komponente

**Files:**
- Create: `src/components/common/VerifiedBadge.tsx`

- [ ] **Step 1: Komponente schreiben**

`src/components/common/VerifiedBadge.tsx`:

```tsx
import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { VerificationTier } from '../../utils/verificationTier';

interface VerifiedBadgeProps {
  tier: VerificationTier;
  showLabel?: boolean;
  size?: number;
}

// Shows a checkmark for the 'verified' tier. Renders nothing otherwise.
export default function VerifiedBadge({ tier, showLabel = false, size = 16 }: VerifiedBadgeProps) {
  if (tier !== 'verified') return null;
  return (
    <View style={styles.row}>
      <Ionicons name="checkmark-circle" size={size} color={colors.accentBlue} />
      {showLabel && <Text style={styles.label}>Verifiziert</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: colors.accentBlue },
});
```

- [ ] **Step 2: tsc + Commit**

```bash
npx tsc --noEmit
git add src/components/common/VerifiedBadge.tsx
git commit -m "feat(verification): add VerifiedBadge component"
```

---

### Task 11: VerificationSection (Checkliste + CTAs)

**Files:**
- Create: `src/components/profil/VerificationSection.tsx`

- [ ] **Step 1: Komponente schreiben**

`src/components/profil/VerificationSection.tsx`:

```tsx
import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useVerification } from '../../hooks/useVerification';
import VerifiedBadge from '../common/VerifiedBadge';

interface RowProps {
  label: string;
  done: boolean;
  hint: string;
}

function StatusRow({ label, done, hint }: RowProps) {
  return (
    <View style={styles.row}>
      <Ionicons
        name={done ? 'checkmark-circle' : 'ellipse-outline'}
        size={20}
        color={done ? colors.accentBlue : colors.inactive}
      />
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
    </View>
  );
}

export function VerificationSection({ refetchTrigger = 0 }: { refetchTrigger?: number }) {
  const { flags, tier, loading, updateAddress, updatePhone } = useVerification(refetchTrigger);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSaveAddress = async () => {
    if (address.trim().length === 0) return;
    setSaving(true);
    await updateAddress(address);
    setSaving(false);
    setAddress('');
  };

  const handleSavePhone = async () => {
    if (phone.trim().length === 0) return;
    setSaving(true);
    await updatePhone(phone);
    setSaving(false);
    setPhone('');
  };

  if (loading) {
    return <View style={styles.card}><ActivityIndicator color={colors.accentBlue} /></View>;
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Verifizierung</Text>
        <VerifiedBadge tier={tier} showLabel />
      </View>

      <StatusRow label="E-Mail" done={flags.email_verified} hint={flags.email_verified ? 'Bestätigt' : 'Noch nicht bestätigt'} />
      <StatusRow label="Adresse" done={flags.address_verified} hint={flags.address_verified ? 'Bestätigt' : 'Adresse eingeben'} />
      <StatusRow label="Studio / Coach" done={flags.studio_verified || flags.coach_vouched} hint={flags.studio_verified || flags.coach_vouched ? 'Bestätigt' : 'Durch Studio oder Coach'} />
      <StatusRow label="Telefon" done={flags.phone_verified} hint="Bald verfügbar" />

      {!flags.address_verified && (
        <View style={styles.inputGroup}>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Strasse, PLZ, Ort"
            placeholderTextColor={colors.inactive}
          />
          <TouchableOpacity style={styles.saveButton} onPress={handleSaveAddress} disabled={saving}>
            <Text style={styles.saveText}>Speichern</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputGroup}>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="Telefonnummer (optional)"
          placeholderTextColor={colors.inactive}
          keyboardType="phone-pad"
        />
        <TouchableOpacity style={styles.saveButton} onPress={handleSavePhone} disabled={saving}>
          <Text style={styles.saveText}>Speichern</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: 16, padding: 16,
    marginHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  rowHint: { fontSize: 12, color: colors.textSecondary },
  inputGroup: { flexDirection: 'row', gap: 8, marginTop: 8 },
  input: {
    flex: 1, height: 48, backgroundColor: colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, fontSize: 14, color: colors.text,
  },
  saveButton: {
    height: 48, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.headerBg,
    alignItems: 'center', justifyContent: 'center',
  },
  saveText: { color: colors.headerTextPrimary, fontSize: 14, fontWeight: '700' },
});
```

- [ ] **Step 2: tsc + Commit**

```bash
npx tsc --noEmit
git add src/components/profil/VerificationSection.tsx
git commit -m "feat(verification): add VerificationSection (checklist + address/phone input)"
```

---

### Task 12: VerificationSection in ProfilScreen einbinden

**Files:**
- Modify: `src/screens/ProfilScreen.tsx`

- [ ] **Step 1: Section rendern**

Import ergänzen:

```ts
import { VerificationSection } from '../components/profil/VerificationSection';
```

`VerificationSection` an passender Stelle im ScrollView von `ProfilScreen` einsetzen (z.B. unter den bestehenden Profil-Karten). Falls der Screen bereits einen `refetchTrigger`/Focus-Trigger nutzt, diesen als Prop durchreichen, sonst ohne Prop verwenden:

```tsx
        <VerificationSection />
```

- [ ] **Step 2: tsc prüfen**

Run: `npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/screens/ProfilScreen.tsx
git commit -m "feat(verification): show VerificationSection in ProfilScreen"
```

---

## Phase 6 — Coach-Vouch & Badge-Anzeige bei anderen Nutzern

### Task 13: Coach-Vouch-Button + Badge in PublicProfileScreen

**Files:**
- Modify: `src/screens/PublicProfileScreen.tsx`

- [ ] **Step 1: Aktuellen Aufbau lesen**

Run: `sed -n '1,80p' src/screens/PublicProfileScreen.tsx`
Ziel: verstehen, wie das Profil geladen wird (Hook/Query), ob `is_coach`/`studio_id` des aktuellen Users verfügbar sind und wo `coach_verified_at` des betrachteten Users herkommt. Den Select um `coach_verified_at, studio_id` erweitern, falls nötig.

- [ ] **Step 2: Vouch-Handler + Button**

State + Handler ergänzen (Typen explizit, kein `any`):

```ts
  const [vouching, setVouching] = useState(false);
  const [vouched, setVouched] = useState(false);

  const handleVouch = async () => {
    setVouching(true);
    const { error } = await supabase.rpc('verify_member', { p_user_id: userId });
    setVouching(false);
    if (error === null) setVouched(true);
  };
```

Button nur anzeigen, wenn der aktuelle User Coach desselben Studios ist und das Zielprofil noch nicht bestätigt wurde (Bedingung an die im Screen vorhandenen Daten anpassen). Beispiel-JSX:

```tsx
      {canVouch && !vouched && (
        <TouchableOpacity style={styles.vouchButton} onPress={handleVouch} disabled={vouching} activeOpacity={0.8}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.headerTextPrimary} />
          <Text style={styles.vouchText}>Als echtes Mitglied bestätigen</Text>
        </TouchableOpacity>
      )}
```

Styles ergänzen:

```ts
  vouchButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: 12, backgroundColor: colors.headerBg, marginHorizontal: 16, marginTop: 16,
  },
  vouchText: { color: colors.headerTextPrimary, fontSize: 14, fontWeight: '700' },
```

`canVouch` aus vorhandenen Daten ableiten (aktueller User `is_coach === true` && `currentStudioId === profileStudioId` && `userId !== currentUserId`).

- [ ] **Step 3: Badge am Namen zeigen**

Wenn das betrachtete Profil `coach_verified_at !== null` ODER aktive Studio-Mitgliedschaft hat, neben dem Namen einen Badge zeigen. Für diesen fremden Nutzer die `verified`-Stufe direkt aus den geladenen Profildaten ableiten (kein eigener RPC für fremde User):

```tsx
      <View style={styles.nameRow}>
        <Text style={styles.name}>{profile.name}</Text>
        {profile.coach_verified_at !== null && (
          <Ionicons name="checkmark-circle" size={18} color={colors.accentBlue} />
        )}
      </View>
```

(`nameRow` als flexDirection row mit gap 4 ergänzen, falls noch nicht vorhanden.)

- [ ] **Step 4: tsc prüfen**

Run: `npx tsc --noEmit`
Expected: keine Fehler.

- [ ] **Step 5: Commit**

```bash
git add src/screens/PublicProfileScreen.tsx
git commit -m "feat(verification): coach vouch button + verified badge on public profile"
```

---

## Phase 7 — Verifizierung testen & dokumentieren

### Task 14: Voller Testlauf der Suite

- [ ] **Step 1: Alle Tests + tsc**

Run: `npx jest && npx tsc --noEmit`
Expected: Alle Tests grün (inkl. `verificationTier.test.ts`), keine TS-Fehler.

- [ ] **Step 2: Commit (falls offene Änderungen)**

```bash
git status
# nur committen, falls noch etwas offen ist
```

---

### Task 15: Manuelle End-to-End-Verifizierung (Dev-Build)

Voraussetzung: Dashboard-Konfiguration (Task 16) erledigt + Dev-Build mit `react-native-webview`
(`npx expo run:ios` / `run:android` — wegen neuem Native-Modul `--no-build-cache` bei Bedarf).

- [ ] **Step 1: Signup-Flow**
  - Neues Konto registrieren → Turnstile erscheint → nach Lösung Button aktiv → `VerifyEmail` öffnet sich.
  - OTP-Mail kommt an (Resend), Code eingeben → eingeloggt.
- [ ] **Step 2: Adresse**
  - Profil → Verifizierung → Adresse eingeben → speichern → Status "Adresse: Bestätigt", Badge erscheint.
- [ ] **Step 3: Coach-Vouch**
  - Als Coach ein Studio-Mitglied öffnen → "Als echtes Mitglied bestätigen" → Badge beim Mitglied.
- [ ] **Step 4:** Beobachtungen notieren; bei Fehlern Task-spezifisch nacharbeiten.

---

### Task 16: Dashboard- & DNS-Konfiguration (manuell, dokumentieren)

Diese Schritte sind Voraussetzung für den Live-Betrieb und werden vom User (Romeo) im
Browser ausgeführt. In der Doku festhalten, welche Schritte erledigt sind.

- [ ] **Step 1: Cloudflare Turnstile**
  - Turnstile-Site (Domain `sparrshop.de`) anlegen → Site-Key in `.env` (`EXPO_PUBLIC_TURNSTILE_SITE_KEY`), Secret-Key notieren.
  - Supabase → Auth → Attack Protection → Captcha → Provider **Turnstile**, Secret-Key eintragen, aktivieren.
- [ ] **Step 2: E-Mail-Bestätigung als OTP**
  - Supabase → Auth → "Confirm email" aktivieren.
  - Auth → Email Templates → "Confirm signup" auf **Code** umstellen (`{{ .Token }}` statt `{{ .ConfirmationURL }}`).
- [ ] **Step 3: Resend-SMTP**
  - Resend-Account, Domain `send.sparrshop.de` hinzufügen.
  - DKIM/SPF-Records (von Resend angezeigt) im Strato-DNS für die Subdomain setzen; Resend-Verifizierung grün abwarten.
  - Supabase → Auth → SMTP Settings → Resend-Zugangsdaten (Absender `noreply@send.sparrshop.de`).
  - Test-Mail senden, Zustellung prüfen.

---

### Task 17: Obsidian-Doku

Pflicht nach Session (siehe CLAUDE.md / Vault-Regeln). Vor jedem Schreiben `_VAULT_SYSTEM.md`
lesen, Ziel-Notiz prüfen (existiert? → append, sonst neu), nie überschreiben.

- [ ] **Step 1:** `Funktionen.md` — Verifizierungs-Feature (E-Mail-OTP, Adresse, Coach-Vouch, Badge, Turnstile) appendieren.
- [ ] **Step 2:** `Offene-Punkte.md` — Telefon/SMS bewusst deaktiviert (Kosten); Resend-Domain-Verifizierung vor Go-Live grün; Ausweis-Verifizierung als mögliches kostenpflichtiges Top-Tier später.
- [ ] **Step 3:** `Architektur/ADR-00X-nutzer-verifizierung.md` — Entscheidung: gestuftes Gratis-Badge statt SMS-KYC (Format laut CLAUDE.md, Nummer aufsteigend).
- [ ] **Step 4:** `Dev-Log/2026-06-06.md` — Was/Warum/Offene Punkte/Nächste Schritte (Format laut CLAUDE.md; falls Eintrag existiert, mit `---` appendieren).

---

## Self-Review (vom Plan-Autor durchgeführt)

- **Spec-Abdeckung:** E-Mail-OTP (Task 6/7/16), CAPTCHA/Turnstile (Task 8/9/16), Adresse-Geocoding (Task 4/11), Telefon vorbereitet/SMS aus (Task 1/4/11), Coach-Vouch (Task 1/13), Badge + Section (Task 10/11/12/13), `verified`-Regel zentral + getestet (Task 3), Resend-SMTP (Task 16). Alle Spec-Punkte haben Tasks.
- **Telefon-Konsistenz:** `phone_verified` immer `false` (RPC Task 1), `updatePhone` setzt nur `phone` (Task 4), UI zeigt "Bald verfügbar" (Task 11) — konsistent.
- **Typen-Konsistenz:** `VerificationFlags` (Task 3) = RPC-Return-Shape (Task 1/2) = Hook-State (Task 4); `computeVerificationTier`/`VerificationTier` einheitlich in Task 3/4/10 verwendet.
- **Keine Platzhalter:** Logik-/Schema-Code vollständig. Task 13 (PublicProfile) bewusst adaptiv gehalten, da der Screen unbekannte Datenstruktur hat — Step 1 liest erst, dann konkrete Snippets; das ist Anpassung an Bestandscode, kein Platzhalter.
```
