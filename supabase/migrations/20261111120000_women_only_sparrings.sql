-- Frauen-Sparrings + Geschlecht (2026-11-11)
--
-- 1) profiles.gender: nur 'male' | 'female' | 'other' (oder NULL). Einmal
--    gesetzt, kann der Nutzer es nicht mehr ändern; Korrektur nur über Support
--    (service_role, auth.uid() IS NULL).
-- 2) open_sparrings.women_only: beim Veröffentlichen festgelegt, danach fix
--    (UPDATE ist für authenticated entzogen, update_sparring kennt die Spalte nicht).
-- 3) Sichtbarkeit: Frauen-Sparrings lesen nur Frauen und die Erstellerin (RLS).
-- 4) publish_sparring: neuer Parameter p_women_only (DEFAULT false, alte Builds
--    funktionieren unverändert); nur Frauen dürfen ihn setzen.
-- 5) sparring_trust_evaluate('join'): Frauen-Sparring + nicht weiblich -> 'women_only'.
--
-- Rückwärtskompatibel: alte Builds senden kein p_women_only und sehen keine
-- Frauen-Sparrings in ihren Listen, solange sie keine Frau sind.

-- ── 1) Geschlecht ───────────────────────────────────────────────────────────────

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_gender_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_gender_check
  CHECK (gender IS NULL OR gender IN ('male', 'female', 'other')) NOT VALID;
ALTER TABLE profiles VALIDATE CONSTRAINT profiles_gender_check;

CREATE OR REPLACE FUNCTION trg_profiles_lock_gender()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND OLD.gender IS NOT NULL
     AND NEW.gender IS DISTINCT FROM OLD.gender THEN
    RAISE EXCEPTION 'GENDER_LOCKED' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_lock_gender ON profiles;
CREATE TRIGGER trg_profiles_lock_gender
  BEFORE UPDATE OF gender ON profiles
  FOR EACH ROW EXECUTE FUNCTION trg_profiles_lock_gender();

-- SECURITY DEFINER: wird in der RLS von open_sparrings benutzt.
CREATE OR REPLACE FUNCTION is_female(p_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT gender = 'female' FROM profiles WHERE id = p_uid), false)
$$;
REVOKE ALL ON FUNCTION is_female(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_female(uuid) TO authenticated, service_role;

-- ── 2) Spalte ───────────────────────────────────────────────────────────────────

ALTER TABLE open_sparrings
  ADD COLUMN IF NOT EXISTS women_only boolean NOT NULL DEFAULT false;

-- ── 3) Sichtbarkeit ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "read active sparrings" ON open_sparrings;
CREATE POLICY "read active sparrings" ON open_sparrings
  FOR SELECT USING (
    is_active = true
    AND auth.uid() IS NOT NULL
    AND (
      NOT women_only
      OR created_by = auth.uid()
      OR (SELECT is_female(auth.uid()))
    )
  );

-- ── Patch-Helfer (wie 20261008120100) ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION pg_temp.patch(p_fn regprocedure, p_old text, p_new text)
RETURNS void LANGUAGE plpgsql AS $f$
DECLARE
  d text := pg_get_functiondef(p_fn);
BEGIN
  IF position(p_old IN d) = 0 THEN
    RAISE EXCEPTION 'women_only patch: snippet not found in %: %', p_fn, left(p_old, 80);
  END IF;
  EXECUTE replace(d, p_old, p_new);
END;
$f$;

-- ── 5) Beitritt ─────────────────────────────────────────────────────────────────

SELECT pg_temp.patch(
  'public.sparring_trust_evaluate(uuid,text,uuid,uuid,double precision,double precision,double precision,double precision,boolean)',
  $o$SELECT id, created_by, scheduled_at, duration_min, is_active, verified_only, lat, lng
      INTO v_sp$o$,
  $n$SELECT id, created_by, scheduled_at, duration_min, is_active, verified_only, women_only, lat, lng
      INTO v_sp$n$);

SELECT pg_temp.patch(
  'public.sparring_trust_evaluate(uuid,text,uuid,uuid,double precision,double precision,double precision,double precision,boolean)',
  $o$      RETURN v_base || jsonb_build_object('ok', false, 'reason', 'verified_only');
    END IF;$o$,
  $n$      RETURN v_base || jsonb_build_object('ok', false, 'reason', 'verified_only');
    END IF;
    IF v_sp.women_only AND NOT is_female(p_uid) THEN
      RETURN v_base || jsonb_build_object('ok', false, 'reason', 'women_only');
    END IF;$n$);

-- ── 4) Veröffentlichen ──────────────────────────────────────────────────────────
-- Neue Signatur mit p_women_only am Ende; die alte wird danach entfernt, damit
-- PostgREST nicht zwischen zwei Überladungen wählen muss.

SELECT pg_temp.patch(
  'public.publish_sparring(uuid,uuid,text,text,text,timestamptz,integer,integer,boolean,boolean,double precision,double precision,double precision,double precision,uuid,uuid,text,text)',
  $o$p_place_label text DEFAULT NULL::text)$o$,
  $n$p_place_label text DEFAULT NULL::text, p_women_only boolean DEFAULT false)$n$);

DROP FUNCTION public.publish_sparring(uuid,uuid,text,text,text,timestamptz,integer,integer,boolean,boolean,double precision,double precision,double precision,double precision,uuid,uuid,text,text);

SELECT pg_temp.patch(
  'public.publish_sparring(uuid,uuid,text,text,text,timestamptz,integer,integer,boolean,boolean,double precision,double precision,double precision,double precision,uuid,uuid,text,text,boolean)',
  $o$  IF p_permission_confirmed IS NOT TRUE THEN$o$,
  $n$  IF COALESCE(p_women_only, false) AND NOT is_female(v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'women_only_creator');
  END IF;

  IF p_permission_confirmed IS NOT TRUE THEN$n$);

SELECT pg_temp.patch(
  'public.publish_sparring(uuid,uuid,text,text,text,timestamptz,integer,integer,boolean,boolean,double precision,double precision,double precision,double precision,uuid,uuid,text,text,boolean)',
  $o$      gym_id, access_note
    ) VALUES ($o$,
  $n$      gym_id, access_note, women_only
    ) VALUES ($n$);

SELECT pg_temp.patch(
  'public.publish_sparring(uuid,uuid,text,text,text,timestamptz,integer,integer,boolean,boolean,double precision,double precision,double precision,double precision,uuid,uuid,text,text,boolean)',
  $o$      v_access
    )
    RETURNING id INTO v_id;$o$,
  $n$      v_access, COALESCE(p_women_only, false)
    )
    RETURNING id INTO v_id;$n$);

REVOKE ALL ON FUNCTION public.publish_sparring(uuid,uuid,text,text,text,timestamptz,integer,integer,boolean,boolean,double precision,double precision,double precision,double precision,uuid,uuid,text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_sparring(uuid,uuid,text,text,text,timestamptz,integer,integer,boolean,boolean,double precision,double precision,double precision,double precision,uuid,uuid,text,text,boolean) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
