-- Private sparrings created under the subscription rule disappear when the
-- creator's subscription ends and come back when it is renewed.
--
-- * subscription_gated: set on INSERT for private sparrings (studio_id IS NULL)
--   while app_flags.sparring_creation_requires_sub is on. Sparrings created
--   before the rule stay false and are never touched (grandfathered).
-- * End of subscription (RevenueCat EXPIRATION / refund via the webhook, plus a
--   15-minute sweep as a fallback): every future, active, gated sparring of
--   that creator is deactivated (= cancelled for everyone) and marked with
--   suspended_for_subscription_at. Participants get the normal cancellation
--   push, the creator one summary push.
-- * New subscription (any grant): future suspended sparrings are reactivated.
--   Signups are left as they were, so participants are still in and get a
--   "findet wieder statt" push; the usual confirmation reminders still run.
-- * Cancellation of auto-renew (RevenueCat CANCELLATION, webhook): the creator
--   is told the end date and how many sparrings after it would be cancelled.

ALTER TABLE public.open_sparrings
  ADD COLUMN IF NOT EXISTS subscription_gated            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_for_subscription_at timestamptz;

-- ─── Mark new private sparrings as gated ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_open_sparring_subscription_gated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.subscription_gated := NEW.studio_id IS NULL
    AND COALESCE((SELECT enabled FROM app_flags WHERE key = 'sparring_creation_requires_sub'), false);
  NEW.suspended_for_subscription_at := NULL;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.trg_open_sparring_subscription_gated() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_open_sparring_subscription_gated ON public.open_sparrings;
CREATE TRIGGER trg_open_sparring_subscription_gated
  BEFORE INSERT ON public.open_sparrings
  FOR EACH ROW EXECUTE FUNCTION public.trg_open_sparring_subscription_gated();

-- ─── Helpers ────────────────────────────────────────────────────────────────

-- A failing push (e.g. recipient deleted) must never roll back the webhook.
CREATE OR REPLACE FUNCTION public.subscription_notify_safe(
  p_user_id uuid, p_type text,
  p_title_de text, p_body_de text, p_title_en text, p_body_en text,
  p_data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM notify_user_i18n(p_user_id, p_type, p_title_de, p_body_de, p_title_en, p_body_en, p_data);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'subscription sparrings: % for % failed: %', p_type, p_user_id, SQLERRM;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.subscription_notify_safe(uuid, text, text, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;

-- Creator entitlement still live, allowing p_grace after expiry.
-- With the subscription rule switched off everyone counts as live.
CREATE OR REPLACE FUNCTION public.creator_entitlement_live(p_user_id uuid, p_grace interval DEFAULT interval '0')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT COALESCE((SELECT enabled FROM app_flags WHERE key = 'sparring_creation_requires_sub'), false)
      OR EXISTS (
        SELECT 1 FROM store_entitlements
         WHERE user_id = p_user_id AND entitlement = 'creator' AND expires_at > now() - p_grace
      )
$$;
REVOKE EXECUTE ON FUNCTION public.creator_entitlement_live(uuid, interval) FROM PUBLIC, anon, authenticated;

-- ─── Suspend: subscription ended ────────────────────────────────────────────
-- p_user_id NULL = all creators (sweep). p_grace: how long after expires_at a
-- creator still counts as subscribed (the sweep waits for late renewals).
CREATE OR REPLACE FUNCTION public.suspend_unsubscribed_sparrings(
  p_user_id uuid     DEFAULT NULL,
  p_grace   interval DEFAULT interval '0'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer := 0;
  v_count integer;
  c       record;
  s       record;
  r       record;
BEGIN
  FOR c IN
    SELECT DISTINCT os.created_by AS user_id
      FROM open_sparrings os
     WHERE os.subscription_gated AND os.is_active AND os.studio_id IS NULL
       AND os.scheduled_at > now()
       AND (p_user_id IS NULL OR os.created_by = p_user_id)
  LOOP
    CONTINUE WHEN creator_entitlement_live(c.user_id, p_grace);

    v_count := 0;
    FOR s IN
      UPDATE open_sparrings
         SET is_active = false,
             suspended_for_subscription_at = now()
       WHERE created_by = c.user_id
         AND subscription_gated AND is_active AND studio_id IS NULL
         AND scheduled_at > now()
      RETURNING id, title
    LOOP
      v_count := v_count + 1;
      FOR r IN
        SELECT user_id FROM sparring_signups
         WHERE sparring_id = s.id
           AND user_id <> c.user_id
           AND status IN ('pending', 'confirmed', 'waitlisted')
      LOOP
        PERFORM subscription_notify_safe(
          r.user_id, 'sparring_cancelled',
          'Sparring abgesagt',
          '„' || COALESCE(s.title, 'Ein Sparring') || '“ wurde abgesagt.',
          'Sparring cancelled',
          '“' || COALESCE(sparring_title_for(s.title, 'en'), 'A sparring') || '” was cancelled.',
          jsonb_build_object('sparring_id', s.id)
        );
      END LOOP;
    END LOOP;

    IF v_count > 0 THEN
      PERFORM subscription_notify_safe(
        c.user_id, 'subscription_sparrings_suspended',
        'Dein Abo ist abgelaufen',
        CASE WHEN v_count = 1
          THEN 'Dein geplantes Sparring wurde abgesagt und ist nicht mehr sichtbar. Mit einem neuen Abo erscheint es wieder.'
          ELSE v_count || ' geplante Sparrings wurden abgesagt und sind nicht mehr sichtbar. Mit einem neuen Abo erscheinen sie wieder.'
        END,
        'Your subscription has ended',
        CASE WHEN v_count = 1
          THEN 'Your planned sparring was cancelled and is no longer visible. It comes back with a new subscription.'
          ELSE v_count || ' planned sparrings were cancelled and are no longer visible. They come back with a new subscription.'
        END,
        jsonb_build_object('count', v_count)
      );
    END IF;
    v_total := v_total + v_count;
  END LOOP;
  RETURN v_total;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.suspend_unsubscribed_sparrings(uuid, interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.suspend_unsubscribed_sparrings(uuid, interval) TO service_role;

-- ─── Restore: subscription is back ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.restore_subscription_sparrings(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  s       record;
  r       record;
BEGIN
  IF NOT creator_entitlement_live(p_user_id) THEN
    RETURN 0;
  END IF;

  FOR s IN
    UPDATE open_sparrings
       SET is_active = true,
           suspended_for_subscription_at = NULL
     WHERE created_by = p_user_id
       AND suspended_for_subscription_at IS NOT NULL
       AND NOT is_active
       AND scheduled_at > now()
    RETURNING id, title
  LOOP
    v_count := v_count + 1;
    FOR r IN
      SELECT user_id FROM sparring_signups
       WHERE sparring_id = s.id
         AND user_id <> p_user_id
         AND status IN ('pending', 'confirmed', 'waitlisted')
    LOOP
      PERFORM subscription_notify_safe(
        r.user_id, 'sparring_restored',
        'Sparring findet wieder statt',
        '„' || COALESCE(s.title, 'Ein Sparring') || '“ findet doch statt. Du bist weiter angemeldet – sag rechtzeitig ab, falls du nicht mehr kannst.',
        'Sparring is back on',
        '“' || COALESCE(sparring_title_for(s.title, 'en'), 'A sparring') || '” is happening after all. You are still signed up – cancel in time if you can no longer make it.',
        jsonb_build_object('sparring_id', s.id)
      );
    END LOOP;
  END LOOP;

  IF v_count > 0 THEN
    PERFORM subscription_notify_safe(
      p_user_id, 'subscription_sparrings_restored',
      'Deine Sparrings sind zurück',
      CASE WHEN v_count = 1
        THEN 'Dein Sparring ist wieder sichtbar. Angemeldete Teilnehmer wurden informiert.'
        ELSE v_count || ' Sparrings sind wieder sichtbar. Angemeldete Teilnehmer wurden informiert.'
      END,
      'Your sparrings are back',
      CASE WHEN v_count = 1
        THEN 'Your sparring is visible again. Signed-up participants were notified.'
        ELSE v_count || ' sparrings are visible again. Signed-up participants were notified.'
      END,
      jsonb_build_object('count', v_count)
    );
  END IF;
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.restore_subscription_sparrings(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_subscription_sparrings(uuid) TO service_role;

-- ─── Heads-up: auto-renew switched off ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_subscription_ending(p_user_id uuid, p_expires_at timestamptz)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count   integer;
  v_local   timestamp := p_expires_at AT TIME ZONE 'Europe/Berlin';
  v_date_de text;
  v_date_en text;
BEGIN
  SELECT count(*) INTO v_count
    FROM open_sparrings
   WHERE created_by = p_user_id
     AND subscription_gated AND is_active AND studio_id IS NULL
     AND scheduled_at > GREATEST(p_expires_at, now());
  IF v_count = 0 THEN
    RETURN 0;
  END IF;

  v_date_de := to_char(v_local, 'FMDD.MM.YYYY');
  v_date_en := to_char(v_local, 'FMMonth FMDD, YYYY');

  PERFORM subscription_notify_safe(
    p_user_id, 'subscription_ending',
    'Dein Abo endet am ' || v_date_de,
    CASE WHEN v_count = 1
      THEN 'Dein Sparring nach diesem Datum wird dann abgesagt – außer du verlängerst dein Abo.'
      ELSE v_count || ' geplante Sparrings nach diesem Datum werden dann abgesagt – außer du verlängerst dein Abo.'
    END,
    'Your subscription ends on ' || v_date_en,
    CASE WHEN v_count = 1
      THEN 'Your sparring after that date will then be cancelled – unless you renew.'
      ELSE v_count || ' planned sparrings after that date will then be cancelled – unless you renew.'
    END,
    jsonb_build_object('count', v_count, 'expires_at', p_expires_at)
  );
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_subscription_ending(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_subscription_ending(uuid, timestamptz) TO service_role;

-- ─── Webhook entry points: same bodies as 20260929120000 plus the hooks ─────

CREATE OR REPLACE FUNCTION public.apply_store_entitlement(
  p_user_id      uuid,
  p_entitlements text[],
  p_product_id   text,
  p_expires_at   timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_expires_at IS NULL THEN
    UPDATE store_entitlements
       SET expires_at = LEAST(expires_at, now()),
           updated_at = now()
     WHERE user_id = p_user_id
       AND entitlement = ANY (p_entitlements)
       AND product_id = p_product_id;
  ELSE
    INSERT INTO store_entitlements (user_id, entitlement, product_id, expires_at)
    SELECT p_user_id, e, p_product_id, p_expires_at
      FROM unnest(p_entitlements) AS e
    ON CONFLICT (user_id, entitlement) DO UPDATE
       SET product_id = EXCLUDED.product_id,
           expires_at = GREATEST(store_entitlements.expires_at, EXCLUDED.expires_at),
           updated_at = now();
  END IF;

  IF 'creator' = ANY (p_entitlements) THEN
    IF p_expires_at IS NULL THEN
      PERFORM suspend_unsubscribed_sparrings(p_user_id);
    ELSE
      PERFORM restore_subscription_sparrings(p_user_id);
    END IF;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_store_entitlement(uuid, text[], text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_store_entitlement(uuid, text[], text, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.transfer_store_entitlements(p_from uuid[], p_to uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from uuid;
BEGIN
  INSERT INTO store_entitlements (user_id, entitlement, product_id, expires_at)
  SELECT p_to, entitlement, product_id, expires_at
    FROM store_entitlements
   WHERE user_id = ANY (p_from) AND user_id <> p_to AND expires_at > now()
  ON CONFLICT (user_id, entitlement) DO UPDATE
     SET product_id = CASE WHEN EXCLUDED.expires_at > store_entitlements.expires_at
                           THEN EXCLUDED.product_id ELSE store_entitlements.product_id END,
         expires_at = GREATEST(store_entitlements.expires_at, EXCLUDED.expires_at),
         updated_at = now();
  DELETE FROM store_entitlements WHERE user_id = ANY (p_from) AND user_id <> p_to;

  FOREACH v_from IN ARRAY p_from LOOP
    IF v_from <> p_to THEN
      PERFORM suspend_unsubscribed_sparrings(v_from);
    END IF;
  END LOOP;
  PERFORM restore_subscription_sparrings(p_to);
END;
$$;
REVOKE ALL ON FUNCTION public.transfer_store_entitlements(uuid[], uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_store_entitlements(uuid[], uuid) TO service_role;

-- ─── Fallback sweep (missed webhook). 24 h grace so a late renewal webhook
-- never cancels and then restores a sparring. ───────────────────────────────
SELECT cron.schedule(
  'subscription-sparring-sweep',
  '*/15 * * * *',
  $$SELECT public.suspend_unsubscribed_sparrings(NULL, interval '24 hours')$$
);
