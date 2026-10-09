#!/usr/bin/env bash
# Scenario tests for 20261009140000_sparring_notifications (3h reminder +
# feedback question) against a throwaway local Postgres, using the production
# notification chain (notification_chain_prod.sql). Needs postgresql@17 from
# Homebrew. Nothing touches the Supabase project.
#
#   supabase/tests/run_sparring_notifications.sh
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

PSQL=("$PG_BIN/psql" -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)

"${PSQL[@]}" <<'SQL'
-- Supabase stubs and production columns the job touches (checked 2026-10-09).
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA net;
CREATE TABLE public.test_push_log (id bigserial PRIMARY KEY, payload jsonb NOT NULL);
CREATE FUNCTION net.http_post(url text, body jsonb, headers jsonb) RETURNS bigint
LANGUAGE plpgsql AS $$ BEGIN INSERT INTO public.test_push_log (payload) VALUES (body); RETURN 1; END $$;
CREATE SCHEMA cron;
CREATE TABLE cron.job (jobname text PRIMARY KEY, schedule text, command text);
CREATE FUNCTION cron.schedule(p_name text, p_schedule text, p_command text) RETURNS bigint
LANGUAGE sql AS $$
  INSERT INTO cron.job VALUES (p_name, p_schedule, p_command)
  ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command
  RETURNING 1::bigint
$$;

CREATE TABLE profiles (
  id uuid PRIMARY KEY, name text, language text, expo_push_token text,
  sparring_intro_version smallint
);
CREATE TABLE open_sparrings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL, title text NOT NULL,
  scheduled_at timestamptz NOT NULL, duration_min integer NOT NULL DEFAULT 90,
  is_active boolean NOT NULL DEFAULT true, deactivated_at timestamptz,
  attendance_reminder_sent_at timestamptz
);
CREATE TABLE sparring_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sparring_id uuid NOT NULL REFERENCES open_sparrings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL, status text NOT NULL DEFAULT 'pending',
  signed_up_at timestamptz NOT NULL DEFAULT now(), slot_granted_at timestamptz,
  reminder_7d_sent_at timestamptz, reminder_24h_sent_at timestamptz, reminder_3h_sent_at timestamptz,
  UNIQUE (sparring_id, user_id)
);
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, type text, title text, body text,
  data jsonb DEFAULT '{}'::jsonb, read_at timestamptz, created_at timestamptz DEFAULT now()
);
CREATE TABLE sparring_meeting_feedback (
  sparring_id uuid NOT NULL REFERENCES open_sparrings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  answer text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sparring_id, user_id)
);
SQL

"${PSQL[@]}" -f "$HERE/notification_chain_prod.sql"
"${PSQL[@]}" <<'SQL'
CREATE TRIGGER trg_open_sparring_rescheduled
  BEFORE UPDATE OF scheduled_at ON open_sparrings
  FOR EACH ROW EXECUTE FUNCTION trg_open_sparring_rescheduled();
-- Test hook: make notify_user fail for one user while test.fail_user is set.
CREATE FUNCTION test_fail_notify() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id::text = current_setting('test.fail_user', true) THEN
    RAISE EXCEPTION 'simulated insert failure';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_test_fail_notify BEFORE INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION test_fail_notify();
SQL

"${PSQL[@]}" -f "$HERE/../migrations/20261009140000_sparring_notifications.sql"
"${PSQL[@]}" -f "$HERE/sparring_notifications.sql"

# Parallel run: a session holding the job lock makes a second run skip.
"${PSQL[@]}" -c "BEGIN; SELECT pg_advisory_xact_lock(hashtext('process_sparring_notifications')); SELECT pg_sleep(3); COMMIT;" >/dev/null &
HOLDER=$!
sleep 1
RESULT="$("${PSQL[@]}" -tA -c "SELECT process_sparring_notifications()->>'skipped'")"
wait "$HOLDER"
if [ "$RESULT" != "already_running" ]; then
  echo "FAIL parallel: second run did not skip (got '$RESULT')"; exit 1
fi

echo "sparring_notifications: all scenarios passed"
