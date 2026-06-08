# Supabase

## Grundregeln

- Alle Tabellen haben **Row Level Security (RLS)** aktiv
- Sensible Business-Logik läuft in `SECURITY DEFINER` RPCs — nie im Client
- Kein `service_role` Key im Client-Code
- Typen: `src/types/database.types.ts` (manuell gepflegt, kein Codegen)

## Auth

Session wird über `SecureStore` (< 1800 Bytes) oder `AsyncStorage` (größere JWTs) persistiert.
Logik: `src/lib/supabase.ts`

## Wichtige RPCs

| RPC | Zweck |
|---|---|
| `get_my_entitlement()` | Gibt Abo-Status + Tier zurück |
| `add_workout_points(p_duration, p_points_per_30)` | Punkte gutschreiben |
| `deduct_workout_points(p_log_id)` | Punkte abziehen |
| `mark_attendance(p_log_id)` | Anwesenheit bestätigen |
| `create_studio_with_owner(p_name, p_city)` | Studio anlegen |
| `create_studio_invite(p_studio_id)` | Einladungscode generieren |
| `accept_studio_invite(p_code)` | Code einlösen |
| `delete_my_account()` | Account + alle Daten löschen |
| `self_demote_coach()` | Coach-Status abgeben |

## Migrations-Übersicht

| Datei | Inhalt |
|---|---|
| `20260408152000_add_subscription_and_entitlements.sql` | Subscriptions, Memberships |
| `20260410200000_add_studio_invite_rpcs.sql` | Einladungscode-RPCs |
| `20260410120000_add_training_frequency_to_profiles.sql` | Trainingspensum |
| `20260417100000_add_delete_my_account_rpc.sql` | Account-löschen |

## RLS-Besonderheit

Rekursive Policies vermeiden — Subqueries auf dieselbe Tabelle als `SECURITY DEFINER`-Funktion auslagern (Beispiel: `get_my_studio_id()`).
