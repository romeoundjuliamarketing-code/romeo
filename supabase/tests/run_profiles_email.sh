#!/usr/bin/env bash
# Runs the scenario test for 20261017130000_profiles_drop_email_copy against a
# throwaway local Postgres. Needs postgresql@17 from Homebrew. Nothing touches
# the Supabase project.
#
#   supabase/tests/run_profiles_email.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/sparr-pgtest.XXXXXX")"
PORT="${PGTEST_PORT:-54333}"

cleanup() {
  "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

"$PG_BIN/initdb" -D "$WORK/data" -U postgres -A trust --locale=C -E UTF8 >/dev/null
"$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

PSQL=("$PG_BIN/psql" -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" <<'SQL'
-- Production state before the migration (checked 2026-10-17).
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE TABLE profiles (id uuid PRIMARY KEY, email text, credits int NOT NULL DEFAULT 0);
CREATE FUNCTION handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public' AS $$
begin
  insert into public.profiles (id, email, credits) values (new.id, new.email, 20)
  on conflict (id) do nothing;
  return new;
end; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-00000000000a', 'old@example.com');
SQL

"${PSQL[@]}" -f "$HERE/../migrations/20261017130000_profiles_drop_email_copy.sql"

"${PSQL[@]}" <<'SQL'
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-00000000000b', 'new@example.com');
DO $$ BEGIN
  IF (SELECT count(*) FROM profiles WHERE email IS NOT NULL) <> 0 THEN
    RAISE EXCEPTION 'FAIL 1: profiles still hold e-mail copies';
  END IF;
  IF (SELECT credits FROM profiles WHERE id = '00000000-0000-0000-0000-00000000000b') <> 20 THEN
    RAISE EXCEPTION 'FAIL 2: new user profile not created with 20 credits';
  END IF;
  IF (SELECT count(*) FROM auth.users WHERE email IS NOT NULL) <> 2 THEN
    RAISE EXCEPTION 'FAIL 3: auth.users e-mails touched';
  END IF;
END $$;
SQL
echo "profiles_email: all scenarios passed"
