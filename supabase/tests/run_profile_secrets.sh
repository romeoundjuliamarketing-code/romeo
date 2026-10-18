#!/usr/bin/env bash
# Runs the scenario test for 20261017150000_profile_secrets against a throwaway
# local Postgres. Needs postgresql@17 from Homebrew. Nothing touches the
# Supabase project.
#
#   supabase/tests/run_profile_secrets.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/sparr-pgtest.XXXXXX")"
PORT="${PGTEST_PORT:-54334}"

cleanup() {
  "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

"$PG_BIN/initdb" -D "$WORK/data" -U postgres -A trust --locale=C -E UTF8 >/dev/null
"$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

PSQL=("$PG_BIN/psql" -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" <<'SQL'
-- Supabase stubs and the production state before the migration (checked 2026-10-17).
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email_confirmed_at timestamptz);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- pg_net stub: records the pushes instead of sending them.
CREATE SCHEMA net;
CREATE TABLE net.sent (body jsonb);
CREATE FUNCTION net.http_post(url text, body jsonb, headers jsonb) RETURNS bigint
  LANGUAGE sql AS $$ INSERT INTO net.sent VALUES (body) RETURNING 1::bigint $$;

CREATE TABLE profiles (
  id uuid PRIMARY KEY, name text, address text, address_lat double precision,
  address_lng double precision, phone text, expo_push_token text,
  coach_verified_at timestamptz
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_read ON profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY p_update ON profiles FOR UPDATE USING (auth.uid() = id);
GRANT SELECT, UPDATE ON profiles TO authenticated;
CREATE TABLE studio_memberships (user_id uuid, status text);
CREATE TABLE notifications (user_id uuid, read_at timestamptz);

CREATE FUNCTION get_my_verification() RETURNS json LANGUAGE sql AS $$ SELECT '{}'::json $$;
CREATE FUNCTION is_user_verified(p_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_uid AND u.email_confirmed_at IS NOT NULL)
    AND (EXISTS (SELECT 1 FROM profiles p WHERE p.id = p_uid AND (p.address_lat IS NOT NULL OR p.coach_verified_at IS NOT NULL))
         OR EXISTS (SELECT 1 FROM studio_memberships sm WHERE sm.user_id = p_uid AND sm.status = 'active'));
$$;
CREATE FUNCTION send_push_notification(p_user_id uuid, p_title text, p_body text, p_data jsonb)
  RETURNS void LANGUAGE sql AS $$ SELECT $$;
GRANT EXECUTE ON FUNCTION get_my_verification(), is_user_verified(uuid) TO authenticated;

-- Fixtures: A has address + token, B nothing, C is the attacker.
INSERT INTO auth.users VALUES
  ('00000000-0000-0000-0000-00000000000a', now()),
  ('00000000-0000-0000-0000-00000000000b', now()),
  ('00000000-0000-0000-0000-00000000000c', now());
INSERT INTO profiles (id, name, address, address_lat, address_lng, expo_push_token) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'A', 'Musterstr. 1, Berlin', 52.5, 13.4, 'ExponentPushToken[a]'),
  ('00000000-0000-0000-0000-00000000000b', 'B', NULL, NULL, NULL, NULL),
  ('00000000-0000-0000-0000-00000000000c', 'C', NULL, NULL, NULL, NULL);
SQL

"${PSQL[@]}" -f "$HERE/../migrations/20261017150000_profile_secrets.sql"
"${PSQL[@]}" -f "$HERE/profile_secrets.sql"

# Re-run guard: with the address rule already removed (20261015120000 applied
# first), the migration must not bring it back.
"${PSQL[@]}" <<'SQL'
DROP TABLE profile_secrets CASCADE;
DROP TRIGGER trg_redirect_profile_secrets ON profiles;
CREATE OR REPLACE FUNCTION is_user_verified(p_uid uuid) RETURNS boolean LANGUAGE sql STABLE
  AS $$ SELECT false $$;
SQL
"${PSQL[@]}" -f "$HERE/../migrations/20261017150000_profile_secrets.sql"
"${PSQL[@]}" <<'SQL'
DO $$ BEGIN
  IF (SELECT prosrc FROM pg_proc WHERE proname = 'is_user_verified') !~ 'SELECT false' THEN
    RAISE EXCEPTION 'FAIL 9: migration overwrote an already simplified is_user_verified';
  END IF;
END $$;
SQL
echo "profile_secrets: all scenarios passed"
