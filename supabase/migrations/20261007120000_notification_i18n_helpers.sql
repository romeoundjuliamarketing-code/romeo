-- Language-aware notification helpers. Callers build title/body in both
-- languages; the recipient's profiles.language (NULL = German) picks one.
-- Existing notify_user / notify_studio_staff / sparring_notify_safe stay as-is
-- so older call paths keep working unchanged.

CREATE OR REPLACE FUNCTION public.notification_lang(p_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT language FROM profiles WHERE id = p_user_id), 'de');
$$;

CREATE OR REPLACE FUNCTION public.notify_user_i18n(
  p_user_id uuid, p_type text,
  p_title_de text, p_body_de text, p_title_en text, p_body_en text, p_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  -- Both English parts must exist, otherwise German for both (never mixed).
  v_en boolean := notification_lang(p_user_id) = 'en'
                  AND NULLIF(p_title_en, '') IS NOT NULL AND NULLIF(p_body_en, '') IS NOT NULL;
BEGIN
  PERFORM notify_user(
    p_user_id, p_type,
    CASE WHEN v_en THEN p_title_en ELSE p_title_de END,
    CASE WHEN v_en THEN p_body_en ELSE p_body_de END,
    p_data);
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_studio_staff_i18n(
  p_studio_id uuid, p_type text,
  p_title_de text, p_body_de text, p_title_en text, p_body_en text,
  p_data jsonb, p_exclude_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_recipient uuid;
BEGIN
  FOR v_recipient IN
    SELECT DISTINCT recipient
    FROM (
      SELECT owner_user_id AS recipient FROM studios
      WHERE id = p_studio_id AND owner_user_id IS NOT NULL
      UNION
      SELECT id AS recipient FROM profiles
      WHERE studio_id = p_studio_id AND is_coach = true
    ) AS staff
    WHERE recipient IS DISTINCT FROM p_exclude_user
  LOOP
    PERFORM notify_user_i18n(v_recipient, p_type, p_title_de, p_body_de, p_title_en, p_body_en, p_data);
  END LOOP;
END;
$$;

-- Same swallow-errors contract as sparring_notify_safe.
CREATE OR REPLACE FUNCTION public.sparring_notify_safe_i18n(
  p_user_id uuid, p_type text,
  p_title_de text, p_body_de text, p_title_en text, p_body_en text, p_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM notify_user_i18n(p_user_id, p_type, p_title_de, p_body_de, p_title_en, p_body_en, p_data);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sparring lifecycle: % for % failed: %', p_type, p_user_id, SQLERRM;
END;
$$;

-- Chat pushes have no notifications row.
CREATE OR REPLACE FUNCTION public.push_i18n(
  p_user_id uuid, p_title_de text, p_body_de text, p_title_en text, p_body_en text, p_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_en boolean := notification_lang(p_user_id) = 'en'
                  AND NULLIF(p_title_en, '') IS NOT NULL AND NULLIF(p_body_en, '') IS NOT NULL;
BEGIN
  PERFORM send_push_notification(
    p_user_id,
    CASE WHEN v_en THEN p_title_en ELSE p_title_de END,
    CASE WHEN v_en THEN p_body_en ELSE p_body_de END,
    p_data);
END;
$$;

-- Stored discipline values are German. Mirror of src/utils/disciplineLabel.ts.
CREATE OR REPLACE FUNCTION public.discipline_label(p_value text, p_lang text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p_lang <> 'en' OR p_value IS NULL THEN p_value
    ELSE COALESCE((
      SELECT m.en FROM (VALUES
        ('Boxen', 'Boxing'), ('Kickboxen', 'Kickboxing'), ('K1 / Kickboxen', 'K1 / Kickboxing'),
        ('Ringen', 'Wrestling'), ('Sonstiges', 'Other')
      ) AS m(de, en) WHERE m.de = p_value), p_value)
  END;
$$;

-- Default titles are "<discipline> – Sparring". Mirror of src/utils/sparringDisplayTitle.ts.
CREATE OR REPLACE FUNCTION public.sparring_title_for(p_title text, p_lang text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v_disc text;
BEGIN
  IF p_lang <> 'en' OR p_title IS NULL OR p_title !~ ' – Sparring$' THEN
    RETURN p_title;
  END IF;
  v_disc := regexp_replace(p_title, ' – Sparring$', '');
  IF v_disc = 'Sonstiges' THEN RETURN 'Sparring'; END IF;
  IF v_disc IN ('Boxen','Kickboxen','K1 / Kickboxen','Ringen','BJJ','MMA','Muay Thai','Wrestling') THEN
    RETURN discipline_label(v_disc, p_lang) || ' – Sparring';
  END IF;
  RETURN p_title;
END;
$$;

CREATE OR REPLACE FUNCTION public.notif_time(p_ts timestamptz, p_lang text, p_with_date boolean)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p_lang = 'en' AND p_with_date THEN to_char(p_ts AT TIME ZONE 'Europe/Berlin', 'DD/MM "at" HH24:MI')
    WHEN p_lang = 'en'                 THEN to_char(p_ts AT TIME ZONE 'Europe/Berlin', 'HH24:MI')
    WHEN p_with_date                   THEN to_char(p_ts AT TIME ZONE 'Europe/Berlin', 'DD.MM. "um" HH24:MI') || ' Uhr'
    ELSE                                    to_char(p_ts AT TIME ZONE 'Europe/Berlin', 'HH24:MI') || ' Uhr'
  END;
$$;

-- English counterpart of sparring_format_berlin ("Mo 07.10., 18:00").
CREATE OR REPLACE FUNCTION public.sparring_format_berlin_en(p_ts timestamptz)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT (ARRAY['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])[extract(dow FROM p_ts AT TIME ZONE 'Europe/Berlin')::int + 1]
      || ' ' || to_char(p_ts AT TIME ZONE 'Europe/Berlin', 'DD/MM, HH24:MI')
$$;

REVOKE ALL ON FUNCTION public.notification_lang(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_user_i18n(uuid,text,text,text,text,text,jsonb) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_studio_staff_i18n(uuid,text,text,text,text,text,jsonb,uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.sparring_notify_safe_i18n(uuid,text,text,text,text,text,jsonb) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.push_i18n(uuid,text,text,text,text,jsonb) FROM public, anon, authenticated;
