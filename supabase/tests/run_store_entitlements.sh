#!/usr/bin/env bash
# Runs the store-entitlement scenario tests against a throwaway local Postgres.
# Needs postgresql@17 from Homebrew. Nothing touches the Supabase project.
#
#   supabase/tests/run_store_entitlements.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/sparr-pgtest.XXXXXX")"
PORT="${PGTEST_PORT:-54330}"

cleanup() {
  "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

"$PG_BIN/initdb" -D "$WORK/data" -U postgres -A trust --locale=C -E UTF8 >/dev/null
"$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

PSQL=("$PG_BIN/psql" -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

{
  cat "$HERE/base.sql"
  cat <<'SQL'
-- Supabase pieces the migration references but base.sql does not stub.
CREATE TABLE auth.users (id uuid PRIMARY KEY);
DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
SQL
} | "${PSQL[@]}"

"${PSQL[@]}" -f "$HERE/../migrations/20260929120000_store_entitlements.sql"
"${PSQL[@]}" -f "$HERE/store_entitlements.sql"
