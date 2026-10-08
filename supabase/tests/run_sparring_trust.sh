#!/usr/bin/env bash
# Runs the reliable-sparrings scenario tests (radius, slot, rate limit, QR
# check-in, confirmation/unlock, lockdown) against a throwaway local Postgres.
# Needs postgresql@17 from Homebrew. Nothing touches the Supabase project.
#
#   supabase/tests/run_sparring_trust.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/sparr-pgtest.XXXXXX")"
PORT="${PGTEST_PORT:-54331}"

cleanup() {
  "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

"$PG_BIN/initdb" -D "$WORK/data" -U postgres -A trust --locale=C -E UTF8 >/dev/null
"$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

PSQL=("$PG_BIN/psql" -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

# Production function bodies before this change.
FUNCS=send_push_notification,notify_user,sparring_notify_safe,notification_lang,notify_user_i18n,sparring_notify_safe_i18n,sparring_cancel_deadline,sparring_confirm_deadline,sparring_confirm_window,sparring_reaction_time,sparring_is_last_minute_slot,promote_sparring_waitlist,join_sparring,confirm_sparring,cancel_sparring_signup,deactivate_sparring,update_sparring,set_sparring_gym,can_create_sparring,trg_sparring_signup_chat_notify,trg_sparring_signup_release_slot,trg_open_sparring_capacity_raised,trg_open_sparring_rescheduled,enforce_clean_open_sparring,notify_sparring_group_message,trg_sparring_signup_legacy_insert,trg_sparring_signup_legacy_notify

{
  cat "$HERE/base.sql"
  cat <<'SQL'
-- Production state the trust migrations build on (beyond base.sql).
ALTER TABLE profiles
  ADD COLUMN avatar_url text,
  ADD COLUMN is_coach   boolean NOT NULL DEFAULT false,
  ADD COLUMN studio_id  uuid,
  ADD COLUMN language   text;
CREATE TABLE studios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, city text, address text,
  lat double precision, lng double precision,
  owner_user_id uuid, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE open_sparrings
  ADD COLUMN gym_id uuid REFERENCES studios(id) ON DELETE SET NULL,
  ADD COLUMN access_note text,
  ADD COLUMN edited_at timestamptz,
  ADD COLUMN material_changed_at timestamptz;
CREATE TABLE app_flags (key text PRIMARY KEY, enabled boolean NOT NULL);
CREATE TABLE store_entitlements (
  user_id uuid NOT NULL, entitlement text NOT NULL, product_id text NOT NULL,
  expires_at timestamptz NOT NULL, PRIMARY KEY (user_id, entitlement)
);
-- Production policies/grants (20260530, 20260924, 20260927, 20260929).
DROP POLICY "creator update sparrings" ON open_sparrings;
REVOKE UPDATE ON open_sparrings FROM anon, authenticated;
DROP POLICY "users insert own sparrings" ON open_sparrings;
CREATE POLICY "users insert own sparrings" ON open_sparrings
  FOR INSERT WITH CHECK (auth.uid() = created_by AND studio_id IS NULL AND NOT is_featured);
CREATE POLICY "coaches insert sparrings" ON open_sparrings
  FOR INSERT WITH CHECK (auth.uid() = created_by AND studio_id IS NOT NULL AND NOT is_featured);
ALTER TABLE sparring_signups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read sparring signups" ON sparring_signups FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "legacy insert own signup" ON sparring_signups
  FOR INSERT WITH CHECK (auth.uid() = user_id AND rules_version = 0 AND status = 'pending');
CREATE POLICY "legacy delete own signup" ON sparring_signups
  FOR DELETE USING (auth.uid() = user_id);
-- Supabase grants API roles access to new tables/functions by default; mirror it
-- so the REVOKEs in the new migrations are what is actually tested.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
SQL
  python3 "$HERE/extract_functions.py" 20261007999999 "$FUNCS"
  cat <<'SQL'
CREATE TRIGGER trg_clean_open_sparring BEFORE INSERT OR UPDATE ON open_sparrings
  FOR EACH ROW EXECUTE FUNCTION enforce_clean_open_sparring();
CREATE TRIGGER trg_open_sparring_capacity_raised AFTER UPDATE OF max_slots ON open_sparrings
  FOR EACH ROW EXECUTE FUNCTION trg_open_sparring_capacity_raised();
CREATE TRIGGER trg_open_sparring_rescheduled BEFORE UPDATE OF scheduled_at ON open_sparrings
  FOR EACH ROW EXECUTE FUNCTION trg_open_sparring_rescheduled();
CREATE TRIGGER trg_notify_sparring_group_message AFTER INSERT ON sparring_group_messages
  FOR EACH ROW EXECUTE FUNCTION notify_sparring_group_message();
CREATE TRIGGER trg_sparring_signup_chat AFTER INSERT OR DELETE OR UPDATE OF status ON sparring_signups
  FOR EACH ROW EXECUTE FUNCTION trg_sparring_signup_chat_notify();
CREATE TRIGGER trg_sparring_signup_legacy_insert BEFORE INSERT ON sparring_signups
  FOR EACH ROW EXECUTE FUNCTION trg_sparring_signup_legacy_insert();
CREATE TRIGGER trg_sparring_signup_legacy_notify AFTER INSERT ON sparring_signups
  FOR EACH ROW EXECUTE FUNCTION trg_sparring_signup_legacy_notify();
CREATE TRIGGER trg_sparring_signup_release_slot AFTER DELETE ON sparring_signups
  FOR EACH ROW EXECUTE FUNCTION trg_sparring_signup_release_slot();
SQL
} | "${PSQL[@]}"

# The three new migrations, in deploy order.
for m in 20261008120000_sparring_trust_schema 20261008120100_sparring_trust_rpcs 20261008120150_sparring_trust_search_path 20261008120200_sparring_trust_lockdown; do
  "${PSQL[@]}" -f "$HERE/../migrations/$m.sql"
done
"${PSQL[@]}" -f "$HERE/sparring_trust.sql"

# ── Concurrency: two sessions, same user, different devices ────────────────────
# psql prints t_as()'s empty result first; the first non-empty line is the answer.
# Session A publishes and holds its transaction open; session B publishes a second
# sparring meanwhile. B must wait for A's per-user lock and then see the slot taken.
CONC_USER="00000000-0000-0000-0000-0000000000c1"
conc_publish() {
  "${PSQL[@]}" -At <<SQL
BEGIN;
SELECT t_as('$CONC_USER');
SELECT publish_sparring(gen_random_uuid(), t_place(53.08, 8.80), 'Sparring', 'Boxen', NULL,
  now() + interval '2 days', 90, 4, false, true, 53.08, 8.80, 20, 5)->>'$2';
SELECT pg_sleep($1);
COMMIT;
SQL
}
conc_publish 2 ok > "$WORK/a.out" &
sleep 0.5
conc_publish 0 reason > "$WORK/b.out"
wait
A="$(grep -v '^$' "$WORK/a.out" | sed -n 1p)"
B="$(grep -v '^$' "$WORK/b.out" | sed -n 1p)"
[[ "$A" == "true" ]] || { echo "concurrency: first publish expected ok, got '$A'"; exit 1; }
[[ "$B" == "slot_taken" ]] || { echo "concurrency: second publish expected slot_taken, got '$B'"; exit 1; }
echo "ok concurrency: parallel publish of the same user -> second gets slot_taken"

# Parallel join of two different sparrings by one user.
CONC_JOINER="00000000-0000-0000-0000-0000000000c2"
conc_join() {
  "${PSQL[@]}" -At <<SQL
BEGIN;
SELECT t_as('$CONC_JOINER');
SELECT join_sparring_v2((SELECT id FROM open_sparrings WHERE title = '$1'), 1::smallint, 53.08, 8.80, 20, 5)->>'$3';
SELECT pg_sleep($2);
COMMIT;
SQL
}
conc_join 'conc-1' 2 ok > "$WORK/c.out" &
sleep 0.5
conc_join 'conc-2' 0 reason > "$WORK/d.out"
wait
C="$(grep -v '^$' "$WORK/c.out" | sed -n 1p)"
D="$(grep -v '^$' "$WORK/d.out" | sed -n 1p)"
[[ "$C" == "true" ]] || { echo "concurrency: first join expected ok, got '$C'"; exit 1; }
[[ "$D" == "slot_taken" ]] || { echo "concurrency: second join expected slot_taken, got '$D'"; exit 1; }
echo "ok concurrency: parallel join of two sparrings -> second gets slot_taken"

echo "all sparring trust scenarios passed"
