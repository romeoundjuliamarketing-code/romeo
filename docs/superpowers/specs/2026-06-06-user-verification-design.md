# Design: Nutzer-Verifizierung (gestuftes Badge, kostenlos)

**Datum:** 2026-06-06
**Status:** Genehmigt (Design), bereit für Implementierungsplan
**Planung:** Opus · **Umsetzung:** Sonnet

---

## Ziel

Nutzer sollen sich verifizieren können, um zwei Probleme zu lösen:
1. **Trust & Safety** — Sparringspartner sollen sicher sein, dass sie sich mit echten Menschen treffen.
2. **Spam / Fake-Accounts verhindern.**

Harte Randbedingung (Projektregel): **keine laufenden Kosten.** Alle hier gewählten
Bausteine sind kostenlos. SMS/Telefon-Verifizierung wird nur *vorbereitet* (Schema + UI),
aber nicht aktiviert, weil SMS-Versand grundsätzlich kostenpflichtig ist.

## Nicht-Ziele (YAGNI)

- Kein SMS-Versand / kein Twilio (kostenpflichtig → bewusst nur vorbereitet).
- Kein KYC / Ausweis-Scan: bewusst geprüft und verworfen — kostenpflichtig (~1–1,50 €/Prüfung)
  *oder* erhebliche DSGVO/Personalausweisgesetz-Risiken bei Eigenbau. Mögliches optionales,
  kostenpflichtiges Top-Tier-Badge ("Ausweis-verifiziert") in ferner Zukunft, nicht jetzt.
- Keine Geräte-Attestierung (App Attest / Play Integrity) — bewusst ausgeklammert (Native-Aufwand).
- Keine Postversand-Adressprüfung.

---

## Entscheidungen (vom User bestätigt)

| Thema | Entscheidung |
|---|---|
| Ansatz | Gestuftes "Verifiziert"-Badge aus mehreren Gratis-Signalen |
| E-Mail-Flow | **6-stelliger OTP-Code** (kein Bestätigungs-Link, kein Deep-Link) |
| CAPTCHA | **Jetzt mitbauen** (Cloudflare Turnstile, gratis) |
| SMTP | **Resend von Anfang an** (gratis, zuverlässig) — Domain `sparrshop.de` bei Strato vorhanden |

### Mailversand: Resend (zuverlässig, gratis)
Der eingebaute Supabase-Default-SMTP ist stark rate-limitiert und nicht für Produktion
gedacht → bewusst **nicht** verwendet, da das Feature reibungslos funktionieren muss.
Stattdessen **Resend** (3000 Mails/Monat gratis) als Custom SMTP in Supabase.

**DNS liegt bei Strato** (Nameserver `docks09.rzone.de` / `shades05.rzone.de`), DNS-Zugriff
über Strato-Kundenlogin → Domains → `sparrshop.de` → DNS-Einstellungen.

Setup-Schritte (im Spec dokumentiert, manuell außerhalb des Codes):
1. Resend-Account anlegen (gratis).
2. In Resend Domain **`send.sparrshop.de`** (Subdomain) hinzufügen — isoliert die
   Sende-Reputation und kollidiert nicht mit dem bestehenden Strato-MX (`smtpin.rzone.de`).
3. Die von Resend angezeigten **DKIM-/SPF-Records (TXT/CNAME)** im Strato-DNS für die
   Subdomain setzen; Verifizierung in Resend abwarten (grün).
4. Resend-**SMTP-Zugangsdaten** in Supabase → Auth → SMTP Settings eintragen
   (Absender z.B. `noreply@send.sparrshop.de`).
5. Versand testen, bevor das Feature live geht.

⚠️ Bestehende Strato-Mail nicht stören: nur Records für die **Subdomain** `send.sparrshop.de`
hinzufügen, den Root-SPF/MX von `sparrshop.de` nicht überschreiben.

---

## Verifizierungs-Modell

Der Status wird **serverseitig berechnet** (nicht hart gespeichert → keine Drift) und über
eine `SECURITY DEFINER`-RPC `get_my_verification()` an den Client geliefert.

### Stufen

| Stufe | Bedingung |
|---|---|
| `unverified` | nichts bestätigt |
| `basic` | E-Mail verifiziert (`auth.users.email_confirmed_at IS NOT NULL`) |
| `verified` | `basic` **UND** mind. ein "echte-Person"-Signal: aktive Studio-Mitgliedschaft ODER Coach-Bestätigung ODER verifizierte Adresse |

Die `verified`-Regel liegt zentral in der puren Funktion `computeVerificationTier(flags)`
(siehe Testing) → später ohne Schema-Änderung justierbar.

### Rückgabe-Objekt der RPC

```json
{
  "emailVerified": true,
  "addressVerified": false,
  "studioVerified": false,
  "coachVouched": false,
  "phoneVerified": false,        // immer false bis SMS später aktiviert wird
  "tier": "basic"                // 'unverified' | 'basic' | 'verified'
}
```

`emailVerified` wird aus `auth.users` gelesen (nur serverseitig zugänglich → daher
`SECURITY DEFINER`). `studioVerified` = existiert aktive Zeile in `studio_memberships`
(`status = 'active'`) für den User. `coachVouched` = `profiles.coach_verified_at IS NOT NULL`.
`addressVerified` = `profiles.address_lat IS NOT NULL` (erfolgreich geocodiert).

### Anti-Spam-Wall (separat vom Badge)

Cloudflare Turnstile (gratis) beim Registrieren. Der Token wird an
`supabase.auth.signUp({ options: { captchaToken } })` übergeben. Das ist ein **Gate für die
Account-Erstellung**, kein per-User-Badge. Erfordert Aktivierung des Captcha-Schutzes in den
Supabase-Auth-Einstellungen (Provider: Turnstile) + Turnstile-Site/Secret-Keys.
Keys über `.env` / `expo-constants` — **niemals im Code**.

---

## Komponenten & Datenfluss

### 1. E-Mail-Verifizierung (OTP)
- Registrierung: `supabase.auth.signUp({ email, password, options: { captchaToken } })`.
- Supabase verschickt 6-stelligen Code (Mailtyp "Confirm signup", Template auf Code statt Link).
- Neuer `VerifyEmailScreen`: Code-Eingabe → `supabase.auth.verifyOtp({ email, token, type: 'signup' })`.
- "Code erneut senden" → `supabase.auth.resend({ type: 'signup', email })` (Rate-Limit beachten).
- Navigation: nach `signUp` → `VerifyEmailScreen`; nach erfolgreichem `verifyOtp` → bestehender
  Onboarding-Flow.

### 2. Adresse (gratis, Geocoding)
- Eingabefeld in der Verifizierungs-Sektion.
- Bei Speichern: Geocoding via **Nominatim** (gleiche Gratis-Technik wie Studio-Karte,
  vgl. `useStudioAddress.ts` / `20260507120000_add_studio_address_geocoords.sql`).
- Erfolg → `address`, `address_lat`, `address_lng` in `profiles` speichern → `addressVerified = true`.
- Kein Postversand, keine kostenpflichtige Validierung.

### 3. Telefon (nur vorbereitet)
- Felder `phone`, `phone_verified_at` in `profiles`.
- UI: Telefon-Eingabe möglich (wird gespeichert), aber Status zeigt "Bald verfügbar".
- `phone_verified_at` bleibt `NULL`; `phoneVerified` immer `false`. Kein SMS-Code, keine Kosten.

### 4. Coach-Vouch (stärkstes Gratis-Signal)
- Neue Spalten `coach_verified_at`, `coach_verified_by` (FK → `profiles.id`).
- RPC `verify_member(p_user_id uuid)` — `SECURITY DEFINER`:
  - Aufrufer muss `is_coach = true` sein **und** demselben Studio angehören wie `p_user_id`.
  - Setzt `coach_verified_at = now()`, `coach_verified_by = auth.uid()`.
  - Selbst-Bestätigung blockiert (`p_user_id <> auth.uid()`).
  - `REVOKE EXECUTE ... FROM public/anon`, nur `authenticated`.
  - Rate-Limiting konsistent mit `20260427100000_add_rpc_rate_limiting.sql`.
- Optional spiegelbildliche RPC `unverify_member` (Coach kann zurücknehmen) — *nur falls trivial*,
  sonst Phase 2.
- UI: Auf dem Profil eines Mitglieds (betrachtet von Coach desselben Studios) Button
  **"Als echtes Mitglied bestätigen"**.

### 5. Badge & UI
- `VerifiedBadge`-Komponente: Häkchen-Icon (`@expo/vector-icons`), Farbe `colors.accentBlue`.
  Props: `tier` (steuert ob/wie angezeigt). Kein Emoji.
- Anzeigeorte: `ProfilScreen` (Name), `GroupMessageBubble`/Gruppenchat, `SparringChatListItem`/
  Sparring-Liste.
- **Verifizierungs-Sektion** (in `ProfilScreen` oder `SettingsScreen`, als eigene Komponente
  `< 150 Zeilen`): Checkliste mit Status + CTA pro Punkt:
  - E-Mail ✓ / "Verifizieren"
  - Adresse "Eingeben"
  - Telefon "Bald verfügbar" (disabled)
  - Studio-Bestätigung (Status: durch Coach/Mitgliedschaft)

### 6. Hook
- `useVerification(refetchTrigger = 0)` — ruft `get_my_verification()`, gibt Flags + `tier` +
  `refetch` zurück. Folgt bestehendem Hook-Muster (`refetchTrigger` aus `useFocusEffect`).

---

## Schema-Änderungen (1 Migration)

`profiles` neue Spalten (alle nullable, keine Breaking Changes):
- `address text`
- `address_lat double precision`
- `address_lng double precision`
- `phone text`
- `phone_verified_at timestamptz`
- `coach_verified_at timestamptz`
- `coach_verified_by uuid` (FK → `profiles.id`)

Neue RPCs (`SECURITY DEFINER`, `REVOKE` von public/anon):
- `get_my_verification()` → `json`
- `verify_member(p_user_id uuid)` → `void`

RLS: keine neuen rekursiven Policies; Studio-Zugehörigkeit über bestehende Helper
(`get_my_studio_id()`-Muster) prüfen. TypeScript-Typen in `src/types/database.types.ts`
manuell nachziehen (kein Codegen).

---

## Betroffene / neue Dateien

**Neu:**
- `supabase/migrations/20260606xxxxxx_add_user_verification.sql`
- `src/screens/auth/VerifyEmailScreen.tsx`
- `src/components/common/VerifiedBadge.tsx`
- `src/components/profil/VerificationSection.tsx`
- `src/components/auth/TurnstileWidget.tsx` (WebView-Wrapper für Turnstile)
- `src/hooks/useVerification.ts`

**Geändert:**
- `src/context/AuthContext.tsx` — `signUp` nimmt `captchaToken`
- `src/screens/auth/RegisterScreen.tsx` — Turnstile + Navigation zu `VerifyEmailScreen`
- `src/navigation/RootNavigator.tsx` + `src/navigation/types.ts` — `VerifyEmailScreen` route
- `src/screens/ProfilScreen.tsx` — VerificationSection + Coach-Vouch-Button
- `src/components/chat/GroupMessageBubble.tsx`, `src/components/chat/SparringChatListItem.tsx`
  — Badge
- `src/types/database.types.ts` — neue Spalten/RPCs
- `.env` / `app.config` — Turnstile-Keys (Site-Key client, Secret in Supabase-Dashboard)

---

## Konfiguration (Supabase-Dashboard, manuell)
1. Auth → "Confirm email" aktivieren.
2. Auth → E-Mail-Template "Confirm signup" auf **OTP-Code** (`{{ .Token }}`) statt Link umstellen.
3. Auth → Attack Protection → Captcha → **Turnstile**, Secret-Key eintragen.
4. Auth → SMTP Settings → **Resend** Custom SMTP (Absender `noreply@send.sparrshop.de`).
   DNS-Records für `send.sparrshop.de` im Strato-Panel setzen (DKIM/SPF), Resend-Verifizierung
   abwarten, Versand testen — **vor** Go-Live des Features.

---

## Testing
- `nutritionEngine`-Muster: reine Logik bekommt Unit-Tests. Hier:
  - **Pure Helper** für Tier-Berechnung (`computeVerificationTier(flags)`) als testbare Funktion
    in `src/utils/` auslagern → Unit-Test (`computeVerificationTier.test.ts`) mit allen
    Stufen-Kombinationen.
  - RPC-Logik (`verify_member` Berechtigung) — manuell/SQL geprüft, keine UI-Tests.
- Keine Tests für reine UI-Screens (Projektregel).
- Nach jeder Änderung `npx tsc --noEmit`.

---

## Phasen (Reihenfolge für Implementierungsplan)
1. **Migration + Typen** (Schema, RPCs) — Fundament.
2. **`computeVerificationTier` + Test**, `useVerification`-Hook.
3. **E-Mail-OTP-Flow** (`VerifyEmailScreen`, AuthContext, Register-Navigation).
4. **Turnstile** (Widget + signUp-Integration + Dashboard-Config).
5. **Adresse** (Geocoding-Reuse) + **Telefon-Felder** (vorbereitet).
6. **Coach-Vouch** (RPC + Button).
7. **Badge + VerificationSection** (UI-Anzeige überall).

---

## Obsidian-Doku (nach Umsetzung)
- `Funktionen.md` — neues Verifizierungs-Feature.
- `Offene-Punkte.md` — SMS/Telefon deaktiviert (Kosten), Resend-Domain-Verifizierung vor Go-Live grün.
- `Architektur/ADR-00X-nutzer-verifizierung.md` — Entscheidung gestuftes Gratis-Badge statt SMS.
- `Dev-Log/2026-06-06.md`.
