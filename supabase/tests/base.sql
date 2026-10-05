-- Minimal local stand-in for the Supabase schema the sparring RPCs touch.
-- Column lists mirror production (checked 2026-09-27). Supabase internals are
-- stubbed: auth.uid() reads a GUC, net.http_post logs instead of sending, the
-- content filter and verification check are permissive/test-driven.
-- The real function bodies are appended from the migrations by
-- run_sparring_edit.sh (extract_functions.py).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Supabase stubs ──────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;

CREATE TABLE public.test_push_log (
  id      bigserial PRIMARY KEY,
  payload jsonb NOT NULL
);

CREATE SCHEMA IF NOT EXISTS net;
CREATE OR REPLACE FUNCTION net.http_post(url text, body jsonb, headers jsonb)
RETURNS bigint LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.test_push_log (payload) VALUES (body);
  RETURN 1;
END;
$$;

-- ── Tables (production columns) ─────────────────────────────────────────────────

CREATE TABLE profiles (
  id              uuid PRIMARY KEY,
  name            text,
  expo_push_token text,
  is_verified     boolean NOT NULL DEFAULT false   -- test-only input for is_user_verified()
);

CREATE TABLE open_sparrings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_id uuid,
  created_by uuid NOT NULL,
  title text NOT NULL,
  discipline text NOT NULL,
  address text NOT NULL,
  lat double precision,
  lng double precision,
  scheduled_at timestamp with time zone NOT NULL,
  duration_min integer NOT NULL DEFAULT 90,
  max_slots integer NOT NULL DEFAULT 10,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_featured boolean NOT NULL DEFAULT false,
  is_at_studio boolean NOT NULL DEFAULT false,
  verified_only boolean NOT NULL DEFAULT false,
  attendance_reminder_sent_at timestamp with time zone
);

CREATE TABLE sparring_signups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sparring_id uuid NOT NULL REFERENCES open_sparrings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  signed_up_at timestamp with time zone NOT NULL DEFAULT now(),
  rules_version smallint NOT NULL,
  rules_accepted_at timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  slot_granted_at timestamp with time zone,
  confirmed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  checked_in_at timestamp with time zone,
  reminder_7d_sent_at timestamp with time zone,
  reminder_24h_sent_at timestamp with time zone,
  reminder_3h_sent_at timestamp with time zone,
  UNIQUE (sparring_id, user_id),
  CONSTRAINT sparring_signups_status_check
    CHECK (status IN ('pending','waitlisted','confirmed','attended',
                      'no_show','cancelled','cancelled_late','expired'))
);

CREATE TABLE notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE sparring_chat_settings (
  sparring_id uuid NOT NULL PRIMARY KEY,
  media_enabled boolean NOT NULL DEFAULT false
);

CREATE TABLE sparring_group_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sparring_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text,
  image_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_system boolean NOT NULL DEFAULT false
);

-- ── Permissive / test-driven stubs ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_text_clean(p_text text) RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT p_text NOT ILIKE '%verbotenwort%' $$;

CREATE OR REPLACE FUNCTION is_user_verified(p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_verified FROM profiles WHERE id = p_user_id), false)
$$;

-- ── Grants and RLS as in production (before this migration) ─────────────────────

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON open_sparrings, sparring_signups, notifications, profiles TO anon, authenticated;

ALTER TABLE open_sparrings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read active sparrings" ON open_sparrings
  FOR SELECT USING (is_active = true AND auth.uid() IS NOT NULL);
CREATE POLICY "users insert own sparrings" ON open_sparrings
  FOR INSERT WITH CHECK (auth.uid() = created_by AND studio_id IS NULL AND NOT is_featured);
CREATE POLICY "creator update sparrings" ON open_sparrings
  FOR UPDATE USING (created_by = auth.uid()) WITH CHECK (is_featured = false);
