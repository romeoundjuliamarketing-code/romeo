#!/usr/bin/env bash
# Runs the release-1.2.7 security scenario tests (event signup counts, invite
# code lockout) against a throwaway local Postgres. Needs postgresql@17 from
# Homebrew. Nothing touches the Supabase project.
#
#   supabase/tests/run_security_release.sh
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

"${PSQL[@]}" <<'SQL'
-- Supabase stubs and the production columns these migrations touch (checked 2026-10-09).
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

CREATE TABLE profiles (id uuid PRIMARY KEY, studio_id uuid);
CREATE TABLE studios (id uuid PRIMARY KEY, owner_user_id uuid);
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid, tier text, status text, current_period_end timestamptz
);
CREATE TABLE studio_invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL, code text NOT NULL, expires_at timestamptz NOT NULL,
  created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE studio_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL, user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active',
  assigned_at timestamptz NOT NULL DEFAULT now(), released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX studio_memberships_sub_user_key ON studio_memberships (subscription_id, user_id);
CREATE FUNCTION entitlement_allows(p_tier text, p_feature text) RETURNS boolean
  LANGUAGE sql IMMUTABLE AS $$ SELECT p_tier = 'studio' $$;

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL, title text NOT NULL DEFAULT 'e',
  is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE event_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id), user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE event_signups ENABLE ROW LEVEL SECURITY;
-- Production state before the migration: policy for role public.
CREATE POLICY "read signups of active events" ON event_signups
  FOR SELECT USING (EXISTS (SELECT 1 FROM events e WHERE e.id = event_id
                            AND (e.is_active OR e.created_by = auth.uid())));
GRANT SELECT ON events, event_signups TO anon, authenticated;
SQL

"${PSQL[@]}" -f "$HERE/../migrations/20261009130000_event_signup_counts.sql"
"${PSQL[@]}" -f "$HERE/../migrations/20261009130100_accept_studio_invite_v2.sql"
"${PSQL[@]}" -f "$HERE/security_release.sql"
echo "security_release: all scenarios passed"
