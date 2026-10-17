#!/usr/bin/env bash
# Runs the 2026-10-17 security scenario tests (coach nominations/votes, studio
# insert, sparring ratings) against a throwaway local Postgres. Needs
# postgresql@17 from Homebrew. Nothing touches the Supabase project.
#
#   supabase/tests/run_security_coach.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/sparr-pgtest.XXXXXX")"
PORT="${PGTEST_PORT:-54332}"

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
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
-- auth.role() stub
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_user::text $$;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated;

CREATE TABLE studios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 's', owner_user_id uuid, created_by uuid
);
CREATE TABLE profiles (id uuid PRIMARY KEY, studio_id uuid, is_coach boolean NOT NULL DEFAULT false);
CREATE TABLE coach_nominations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES studios(id), nominator_id uuid NOT NULL REFERENCES profiles(id),
  nominee_id uuid NOT NULL REFERENCES profiles(id),
  type text NOT NULL DEFAULT 'promote' CHECK (type IN ('promote','demote')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE coach_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomination_id uuid NOT NULL REFERENCES coach_nominations(id), voter_id uuid NOT NULL,
  UNIQUE (nomination_id, voter_id)
);
CREATE TABLE sparring_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id uuid NOT NULL, rated_user_id uuid NOT NULL, stars int NOT NULL
);
ALTER TABLE studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sparring_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_read ON profiles FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY studios_lesen ON studios FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create studios" ON studios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY studios_eintragen ON studios FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY insert_coach_nominations ON coach_nominations FOR INSERT
  WITH CHECK (auth.uid() = nominator_id AND EXISTS (SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.studio_id = coach_nominations.team_id));
CREATE POLICY update_coach_nominations ON coach_nominations FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND profiles.studio_id = coach_nominations.team_id));
CREATE POLICY view_team_coach_nominations ON coach_nominations FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
    AND profiles.studio_id = coach_nominations.team_id));
CREATE POLICY insert_coach_votes ON coach_votes FOR INSERT WITH CHECK (auth.uid() = voter_id);
CREATE POLICY "Own ratings readable" ON sparring_ratings FOR SELECT USING (auth.uid() = rater_id);
CREATE POLICY "Ratings for user readable" ON sparring_ratings FOR SELECT USING (true);
GRANT SELECT, INSERT, UPDATE ON studios, coach_nominations, coach_votes, sparring_ratings TO anon, authenticated;
GRANT SELECT ON profiles TO anon, authenticated;


-- Pre-migration RPC stubs so CREATE OR REPLACE / REVOKE match production.
CREATE FUNCTION cast_coach_vote(p_nomination_id uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION reject_coach_nomination(p_nomination_id uuid) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
SQL

"${PSQL[@]}" -f "$HERE/../migrations/20261017120000_security_coach_studio_ratings.sql"
"${PSQL[@]}" -f "$HERE/security_coach.sql"
echo "security_coach: all scenarios passed"
