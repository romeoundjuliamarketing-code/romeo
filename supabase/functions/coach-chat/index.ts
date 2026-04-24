// IMPORTANT: Set the ANTHROPIC_API_KEY secret via:
// npx supabase secrets set ANTHROPIC_API_KEY=<your-key> --project-ref lkgrnuwtnifnmghthbog

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DAILY_LIMIT = 10;

// React Native clients have no browser origin — CORS is enforced via JWT validation below
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Maps training_type values to fitness group labels
const TYPE_TO_LABEL: Record<string, string> = {
  schlagkraft:        'Schlagkraft',
  trittkraft:         'Trittkraft',
  koordination:       'Koordination',
  ausdauer:           'Ausdauer',
  beinarbeit:         'Beinarbeit',
  schulter:           'Schulter & Kraft',
  mobilitaet:         'Mobilität',
  K1:                 'Schlagkraft',
  Boxen:              'Schlagkraft',
  BJJ:                'Koordination',
  MMA:                'Schlagkraft',
  Plyometrik:         'Schlagkraft',
  'Kraft & Ausdauer': 'Schulter & Kraft',
  Gym:                'Schulter & Kraft',
  Kettlebell:         'Schulter & Kraft',
  'Intervallläufe':   'Ausdauer',
  Sprints:            'Ausdauer',
  Seilspringen:       'Ausdauer',
  Joggen:             'Ausdauer',
  Schwimmen:          'Ausdauer',
  Dehnen:             'Mobilität',
  Yoga:               'Mobilität',
  Sauna:              'Mobilität',
};

const ALL_GROUPS = [
  'Schlagkraft', 'Trittkraft', 'Ausdauer',
  'Schulter & Kraft', 'Beinarbeit', 'Koordination', 'Mobilität',
];

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Builds a short plain-text fitness summary from workout_logs
async function buildFitnessContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string> {
  const thirtyDaysAgo = toIsoDate(new Date(Date.now() - 30 * 86_400_000));

  const { data } = await supabase
    .from('workout_logs')
    .select('training_type')
    .eq('user_id', userId)
    .eq('completed', true)
    .gte('date', thirtyDaysAgo);

  const counts: Record<string, number> = {};
  for (const group of ALL_GROUPS) counts[group] = 0;

  for (const row of (data ?? [])) {
    if (row.training_type === null) continue;
    const label = TYPE_TO_LABEL[row.training_type];
    if (label !== undefined) counts[label] = (counts[label] ?? 0) + 1;
  }

  const sorted = ALL_GROUPS
    .map((g) => ({ g, n: counts[g] ?? 0 }))
    .sort((a, b) => b.n - a.n);

  const lines = sorted.map(({ g, n }) => `${g}: ${n} Sessions`);
  const weakest = sorted.filter(({ n }) => n === 0).map(({ g }) => g);

  let summary = `Trainings-Profil des Users (letzte 30 Tage):\n${lines.join(', ')}`;
  if (weakest.length > 0) {
    summary += `\nNoch gar nicht trainiert: ${weakest.join(', ')}`;
  }
  return summary;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Extract JWT from Authorization header to identify the user
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError !== null || user === null) {
      return new Response(JSON.stringify({ error: 'Nicht authentifiziert.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { message } = await req.json() as { message: string };

    // ── Check & update daily message limit ────────────────────────────────────
    const today = toIsoDate(new Date());

    const { data: profile } = await supabase
      .from('profiles')
      .select('coach_messages_count, coach_messages_date')
      .eq('id', user.id)
      .single();

    const lastDate = profile?.coach_messages_date ?? null;
    const currentCount = lastDate === today ? (profile?.coach_messages_count ?? 0) : 0;

    if (currentCount >= DAILY_LIMIT) {
      return new Response(
        JSON.stringify({ error: 'limit_reached', remaining: 0 }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Increment count before API call to prevent double-sends
    await supabase
      .from('profiles')
      .update({
        coach_messages_count: currentCount + 1,
        coach_messages_date: today,
      })
      .eq('id', user.id);

    // ── Build fitness context ─────────────────────────────────────────────────
    const fitnessContext = await buildFitnessContext(supabase, user.id);

    // ── Call Claude Haiku ─────────────────────────────────────────────────────
    const systemPrompt = `Du bist ein erfahrener K1- und Kampfsport-Coach. Du kennst dich aus mit Boxen, Kickboxen, MMA, BJJ, Konditionstraining und Verletzungsprävention.

Dein Kommunikationsstil:
- Kurz und direkt. Maximal 3-4 Sätze.
- Keine Emojis, keine Floskeln, kein Motivations-Bullshit.
- Konkrete Hinweise statt allgemeiner Ratschläge.
- Bei Verletzungen oder medizinischen Fragen: immer einen Arzt empfehlen.
- Antworte immer auf Deutsch.

${fitnessContext}

Nutze das Trainings-Profil des Users, um deine Antworten zu personalisieren. Wenn der User nach seinem schwächsten Bereich fragt oder allgemeine Ratschläge möchte, beziehe dich auf die Daten oben.`;

    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
      }),
    });

    const apiData = await apiResponse.json() as { content?: { text: string }[] };
    const reply = apiData.content?.[0]?.text ?? 'Keine Antwort erhalten.';
    const remaining = DAILY_LIMIT - (currentCount + 1);

    return new Response(
      JSON.stringify({ reply, remaining }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch {
    return new Response(
      JSON.stringify({ error: 'Interner Fehler.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
