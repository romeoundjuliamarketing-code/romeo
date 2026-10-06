#!/usr/bin/env bash
# Runs the sparring-edit scenario tests against a throwaway local Postgres.
# Needs postgresql@17 from Homebrew. Nothing touches the Supabase project.
#
#   supabase/tests/run_sparring_edit.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/sparr-pgtest.XXXXXX")"
PORT="${PGTEST_PORT:-54329}"

cleanup() {
  "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

"$PG_BIN/initdb" -D "$WORK/data" -U postgres -A trust --locale=C -E UTF8 >/dev/null
"$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

PSQL=("$PG_BIN/psql" -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

# Function bodies as they were before this change (production state) ...
FUNCS=send_push_notification,notify_user,sparring_notify_safe,sparring_cancel_deadline,sparring_confirm_deadline,sparring_confirm_window,sparring_reaction_time,sparring_is_last_minute_slot,promote_sparring_waitlist,join_sparring,confirm_sparring,cancel_sparring_signup,deactivate_sparring,trg_sparring_signup_chat_notify,trg_sparring_signup_release_slot,trg_open_sparring_capacity_raised,trg_open_sparring_rescheduled,process_sparring_lifecycle,enforce_clean_open_sparring,notify_sparring_group_message,trg_sparring_signup_legacy_insert,trg_sparring_signup_legacy_notify

{
  cat "$HERE/base.sql"
  python3 "$HERE/extract_functions.py" 20260926999999 "$FUNCS"
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

# Optional: print md5 of the loaded pre-change functions to compare with prod.
if [[ "${PRINT_HASHES:-0}" == "1" ]]; then
  # Comment- and whitespace-insensitive, so it matches bodies applied without comments.
  "${PSQL[@]}" -At -c "select p.proname||' '||md5(regexp_replace(regexp_replace(p.prosrc, '--[^\n]*', '', 'g'), '\s+', '', 'g')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname not like 'pgp%' and p.proname not in ('armor','dearmor','crypt','decrypt','decrypt_iv','digest','encrypt','encrypt_iv','gen_random_bytes','gen_random_uuid','gen_salt','hmac') order by 1"
fi

[[ "${HASHES_ONLY:-0}" == "1" ]] && exit 0

# ... then the new migration, then the scenarios.
"${PSQL[@]}" -f "$HERE/../migrations/20260927120000_sparring_edit.sql"
"${PSQL[@]}" -f "$HERE/sparring_edit.sql"
