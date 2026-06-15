// rc-boost-webhook/index.ts
// Receives RevenueCat purchase webhooks and activates map boosts.
//
// Required secrets (Supabase Dashboard → Settings → Edge Functions):
//   REVENUECAT_WEBHOOK_SECRET — from RC Dashboard → Project Settings → Webhooks
//   SUPABASE_SERVICE_ROLE_KEY — from Supabase Dashboard → Settings → API

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BOOST_PRODUCT_ID   = 'com.deinebundle.sparr.mapbadge_30d';
const BOOST_DURATION_DAYS = 30;
// One-time consumable that unlocks creating a public-viewing event.
const EVENT_PRODUCT_ID   = 'com.deinebundle.sparr.event_create';

// RC webhook payload shapes (minimal — only fields we consume).
interface RcSubscriberAttribute {
  value:          string;
  updated_at_ms?: number;
}

interface RcEvent {
  type:                  string;
  product_id:            string;
  app_user_id:           string;
  subscriber_attributes?: Record<string, RcSubscriberAttribute>;
}

interface RcWebhookPayload {
  event:       RcEvent;
  api_version: string;
}

// HMAC-SHA256 verification against the X-RevenueCat-Signature header.
// RC signs the raw request body with the webhook secret (hex-encoded output).
async function verifySignature(
  secret:            string,
  rawBody:           string,
  receivedSignature: string,
): Promise<boolean> {
  const enc     = new TextEncoder();
  const key     = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf  = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const computed = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return computed === receivedSignature.toLowerCase();
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const webhookSecret    = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '';
  const serviceRoleKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabaseUrl      = Deno.env.get('SUPABASE_URL') ?? '';

  if (webhookSecret.length === 0 || serviceRoleKey.length === 0 || supabaseUrl.length === 0) {
    console.error('[rc-boost-webhook] missing required secrets');
    return new Response('Internal Server Error', { status: 500 });
  }

  // Read raw body once; needed for both signature verification and JSON parsing.
  const rawBody = await req.text();

  // Verify RC signature.
  const signature = req.headers.get('X-RevenueCat-Signature') ?? '';
  if (signature.length === 0) {
    return new Response('Bad Request: missing signature', { status: 400 });
  }
  const valid = await verifySignature(webhookSecret, rawBody, signature);
  if (!valid) {
    return new Response('Unauthorized: invalid signature', { status: 401 });
  }

  // Parse and validate payload.
  let payload: RcWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as RcWebhookPayload;
  } catch {
    return new Response('Bad Request: invalid JSON', { status: 400 });
  }

  const event = payload.event;

  // Ignore non-purchase events silently. Subscriptions fire INITIAL_PURCHASE;
  // consumables (boost, event creation) fire NON_RENEWING_PURCHASE.
  if (event.type !== 'INITIAL_PURCHASE' && event.type !== 'NON_RENEWING_PURCHASE') {
    return new Response(JSON.stringify({ skipped: true, type: event.type }), {
      status:  200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId   = event.app_user_id;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ── Event creation: unlock a freshly created (inactive) event ──────────────
  if (event.product_id === EVENT_PRODUCT_ID) {
    const eventId = event.subscriber_attributes?.['event_id']?.value ?? '';
    if (userId.length === 0 || eventId.length === 0) {
      console.error('[rc-boost-webhook] missing user_id or event_id', { userId, eventId });
      return new Response('Unprocessable Entity: missing user_id or event_id', { status: 422 });
    }

    const { data, error } = await supabase.rpc('activate_event', {
      p_event_id: eventId,
      p_user_id:  userId,
    });

    if (error !== null) {
      console.error('[rc-boost-webhook] activate_event error', error.message);
      // Return 200 to prevent RC from retrying on logic errors.
      return new Response(JSON.stringify({ ok: false, reason: error.message }), {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('[rc-boost-webhook] event activated', data);
    return new Response(JSON.stringify({ ok: true, data }), {
      status:  200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Map boost: 30-day featured marker for a sparring ───────────────────────
  if (event.product_id !== BOOST_PRODUCT_ID) {
    return new Response(JSON.stringify({ skipped: true, product: event.product_id }), {
      status:  200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sparringId = event.subscriber_attributes?.['sparring_id']?.value ?? '';
  if (userId.length === 0 || sparringId.length === 0) {
    console.error('[rc-boost-webhook] missing user_id or sparring_id', { userId, sparringId });
    return new Response('Unprocessable Entity: missing user_id or sparring_id', { status: 422 });
  }

  // Call activate_map_boost via service role.
  const { data, error } = await supabase.rpc('activate_map_boost', {
    p_sparring_id:   sparringId,
    p_user_id:       userId,
    p_duration_days: BOOST_DURATION_DAYS,
  });

  if (error !== null) {
    console.error('[rc-boost-webhook] activate_map_boost error', error.message);
    // Return 200 to prevent RC from retrying on logic errors (e.g. duplicate boost).
    return new Response(JSON.stringify({ ok: false, reason: error.message }), {
      status:  200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log('[rc-boost-webhook] boost activated', data);
  return new Response(JSON.stringify({ ok: true, data }), {
    status:  200,
    headers: { 'Content-Type': 'application/json' },
  });
});
