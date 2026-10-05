// rc-boost-webhook/index.ts
// Receives RevenueCat webhooks: subscription entitlements (store_entitlements), map boosts and event unlocks.
//
// Required secrets (Supabase Dashboard → Settings → Edge Functions):
//   REVENUECAT_WEBHOOK_SECRET — same value as "Authorization header value" in RC → Integrations → Webhooks
//   SUPABASE_SERVICE_ROLE_KEY — from Supabase Dashboard → Settings → API

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isSupabaseUserId, subscriptionChange } from './storeEntitlementEvents.ts';

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
  new_product_id?:       string | null;
  expiration_at_ms?:     number | null;
  cancel_reason?:        string | null;
  transferred_from?:     string[] | null;
  transferred_to?:       string[] | null;
  subscriber_attributes?: Record<string, RcSubscriberAttribute>;
}

interface RcWebhookPayload {
  event:       RcEvent;
  api_version: string;
}

// RC sends the dashboard's "Authorization header value" verbatim on every
// delivery; it must equal the secret (optionally with a "Bearer " prefix).
// Compared via SHA-256 digests so the check runs in constant time.
async function verifyAuthorization(secret: string, header: string): Promise<boolean> {
  const received = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : header;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(received)),
    crypto.subtle.digest('SHA-256', enc.encode(secret)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
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

  // Verify the shared secret from the RC webhook's Authorization header.
  const authorization = req.headers.get('Authorization') ?? '';
  if (!(await verifyAuthorization(webhookSecret, authorization))) {
    return new Response('Unauthorized', { status: 401 });
  }

  const rawBody = await req.text();

  // Parse and validate payload.
  let payload: RcWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as RcWebhookPayload;
  } catch {
    return new Response('Bad Request: invalid JSON', { status: 400 });
  }

  const event = payload.event;

  // ── Subscriptions: mirror creator / cards entitlements into Postgres ───────
  const change = subscriptionChange(event);
  if (change.kind === 'transfer') {
    const transferClient = createClient(supabaseUrl, serviceRoleKey);
    const { error: transferError } = await transferClient.rpc('transfer_store_entitlements', {
      p_from: change.fromUserIds,
      p_to:   change.toUserId,
    });
    if (transferError !== null) {
      console.error('[rc-boost-webhook] transfer_store_entitlements error', transferError.message);
      return new Response('Internal Server Error', { status: 500 });
    }
    console.log('[rc-boost-webhook] store entitlements transferred', change.fromUserIds, change.toUserId);
    return new Response(JSON.stringify({ ok: true, change: 'transfer' }), {
      status:  200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (change.kind !== 'ignore') {
    if (!isSupabaseUserId(event.app_user_id)) {
      // Anonymous RC user (purchase before login): nothing to attach it to.
      console.warn('[rc-boost-webhook] subscription event for non-uuid user', event.app_user_id);
      return new Response(JSON.stringify({ skipped: true, reason: 'anonymous user' }), {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const subClient = createClient(supabaseUrl, serviceRoleKey);
    const { error: subError } = await subClient.rpc('apply_store_entitlement', {
      p_user_id:      event.app_user_id,
      p_entitlements: change.entitlements,
      p_product_id:   change.productId,
      p_expires_at:   change.kind === 'grant' ? change.expiresAt : null,
    });
    if (subError !== null) {
      console.error('[rc-boost-webhook] apply_store_entitlement error', subError.message);
      // 500 so RevenueCat retries: a missed grant would lock a paying user out.
      return new Response('Internal Server Error', { status: 500 });
    }
    console.log('[rc-boost-webhook] store entitlement', change.kind, change.entitlements, event.app_user_id);
    return new Response(JSON.stringify({ ok: true, change: change.kind }), {
      status:  200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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
