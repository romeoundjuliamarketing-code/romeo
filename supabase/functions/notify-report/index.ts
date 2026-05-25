// supabase/functions/notify-report/index.ts
// Sends an admin email via Resend when a user report is submitted.
// Required secret: RESEND_API_KEY (set in Supabase Dashboard → Project Settings → Edge Function Secrets)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const ADMIN_EMAIL = 'romeoundjuliamarketing@gmail.com';
const RESEND_URL  = 'https://api.resend.com/emails';

interface ReportPayload {
  reportedUserId: string;
  reporterUserId: string;
  sparringId:     string;
  reason:         string;
  details:        string | null;
  timestamp:      string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const payload = await req.json() as ReportPayload;

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (resendApiKey === undefined || resendApiKey.length === 0) {
    // Log and return 200 so the client is not blocked
    console.error('RESEND_API_KEY not set');
    return new Response(JSON.stringify({ ok: false, reason: 'no api key' }), { status: 200 });
  }

  const emailBody = `
Neue Meldung in Sparr

Gemeldeter Nutzer: ${payload.reportedUserId}
Melder:            ${payload.reporterUserId}
Sparring ID:       ${payload.sparringId}
Grund:             ${payload.reason}
Details:           ${payload.details ?? '–'}
Zeitstempel:       ${payload.timestamp}
  `.trim();

  const res = await fetch(RESEND_URL, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    'Sparr App <onboarding@resend.dev>',
      to:      [ADMIN_EMAIL],
      subject: `[Sparr] Neue Meldung: ${payload.reason}`,
      text:    emailBody,
    }),
  });

  const data = await res.json();
  return new Response(JSON.stringify({ ok: res.ok, data }), {
    status:  200,
    headers: { 'Content-Type': 'application/json' },
  });
});
