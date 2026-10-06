// supabase/functions/apple-auth/index.ts
// Sign in with Apple token handling (App Store guideline 5.1.1(v)):
//   { action: 'exchange', authorizationCode } — right after the native Apple
//     sign-in: trades the short-lived code (5 min) for a refresh token and
//     stores it in apple_auth_tokens.
//   { action: 'revoke' } — before account deletion: revokes the stored token
//     at Apple and removes the row. No stored token → nothing to revoke.
// Only the signed-in user's own row is ever touched.
//
// Required secrets (Supabase Dashboard → Edge Function Secrets):
//   APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY (contents of the .p8 key
//   with "Sign in with Apple" enabled). Optional: APPLE_CLIENT_ID (defaults to
//   the app's bundle ID).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SignJWT, importPKCS8 } from 'https://deno.land/x/jose@v5.9.6/index.ts';

const APPLE_TOKEN_URL  = 'https://appleid.apple.com/auth/token';
const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke';

type Body = { action: 'exchange'; authorizationCode: string } | { action: 'revoke' };

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Apple's client secret: an ES256 JWT signed with the .p8 key, valid briefly.
async function clientSecret(clientId: string): Promise<string> {
  const teamId = Deno.env.get('APPLE_TEAM_ID') ?? '';
  const keyId  = Deno.env.get('APPLE_KEY_ID') ?? '';
  const pem    = (Deno.env.get('APPLE_PRIVATE_KEY') ?? '').replace(/\\n/g, '\n');
  if (teamId === '' || keyId === '' || pem === '') throw new Error('Apple secrets missing');
  const key = await importPKCS8(pem, 'ES256');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime('5m')
    .setAudience('https://appleid.apple.com')
    .setSubject(clientId)
    .sign(key);
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization');
  if (authHeader === null) return new Response('Unauthorized', { status: 401 });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError !== null || user === null) return new Response('Unauthorized', { status: 401 });

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  const clientId = Deno.env.get('APPLE_CLIENT_ID') ?? 'com.kombat.app';

  let body: Body;
  try {
    body = await req.json() as Body;
  } catch {
    return json({ ok: false, reason: 'invalid body' }, 400);
  }

  try {
    if (body.action === 'exchange') {
      if (typeof body.authorizationCode !== 'string' || body.authorizationCode.length === 0) {
        return json({ ok: false, reason: 'missing code' }, 400);
      }
      const res = await fetch(APPLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     clientId,
          client_secret: await clientSecret(clientId),
          code:          body.authorizationCode,
          grant_type:    'authorization_code',
        }),
      });
      const data = await res.json() as { refresh_token?: string; error?: string };
      if (!res.ok || typeof data.refresh_token !== 'string') {
        console.error('apple token exchange failed', res.status, data.error);
        return json({ ok: false, reason: 'exchange failed' }, 502);
      }
      const { error } = await admin
        .from('apple_auth_tokens')
        .upsert({ user_id: user.id, refresh_token: data.refresh_token, updated_at: new Date().toISOString() });
      if (error !== null) {
        console.error('apple token store failed', error.message);
        return json({ ok: false, reason: 'store failed' }, 500);
      }
      return json({ ok: true });
    }

    if (body.action === 'revoke') {
      const { data: row, error } = await admin
        .from('apple_auth_tokens')
        .select('refresh_token')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error !== null) return json({ ok: false, reason: 'lookup failed' }, 500);
      if (row === null) return json({ ok: true, revoked: false });

      const res = await fetch(APPLE_REVOKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:       clientId,
          client_secret:   await clientSecret(clientId),
          token:           row.refresh_token,
          token_type_hint: 'refresh_token',
        }),
      });
      if (!res.ok) {
        console.error('apple revoke failed', res.status);
        return json({ ok: false, reason: 'revoke failed' }, 502);
      }
      await admin.from('apple_auth_tokens').delete().eq('user_id', user.id);
      return json({ ok: true, revoked: true });
    }

    return json({ ok: false, reason: 'unknown action' }, 400);
  } catch (e) {
    console.error('apple-auth error', e instanceof Error ? e.message : String(e));
    return json({ ok: false, reason: 'server error' }, 500);
  }
});
