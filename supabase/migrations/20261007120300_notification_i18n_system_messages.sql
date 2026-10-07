-- Follow-up to 20261007120100: English push text for the third system message
-- ("<name> ist nicht mehr dabei") and the server fallback name "Jemand".
-- An untranslatable system text sends NULL as English body, so push_i18n falls
-- back to German for title and body together (never mixed).

CREATE OR REPLACE FUNCTION pg_temp.patch(p_fn regprocedure, p_old text, p_new text)
RETURNS void LANGUAGE plpgsql AS $f$
DECLARE
  d text := pg_get_functiondef(p_fn);
BEGIN
  IF position(p_old IN d) = 0 THEN
    RAISE EXCEPTION 'i18n patch: snippet not found in %: %', p_fn, left(p_old, 80);
  END IF;
  EXECUTE replace(d, p_old, p_new);
END;
$f$;

SELECT pg_temp.patch('public.notify_sparring_group_message()', $o$    v_body_en := regexp_replace(regexp_replace(v_body,
      '^(.+) hat sich angemeldet$', '\1 signed up'), '^(.+) hat abgesagt$', '\1 cancelled');$o$, $n$    v_body_en := regexp_replace(regexp_replace(regexp_replace(regexp_replace(v_body,
      '^Jemand (hat sich angemeldet|hat abgesagt|ist nicht mehr dabei)$', 'Someone \1'),
      '^(.+) hat sich angemeldet$', '\1 signed up'),
      '^(.+) hat abgesagt$', '\1 cancelled'),
      '^(.+) ist nicht mehr dabei$', '\1 is no longer in');
    IF v_body_en = v_body THEN
      v_body_en := NULL;
    END IF;$n$);
