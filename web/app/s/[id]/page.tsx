import type { Metadata } from 'next';
import { fetchPublicSparring } from '../../../lib/supabase';
import { webSparringStatus, formatDateTimeDE, slotsLeftLabel } from '../../../lib/sparring';
import OpenInApp from './OpenInApp';

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const s = await fetchPublicSparring(id);
  if (!s) return { title: 'Sparr' };
  const title = `Sparring: ${s.discipline} · ${s.area_label}`;
  const description = `${formatDateTimeDE(s.scheduled_at)} — ${slotsLeftLabel(s.slots_left)}`;
  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function SparringPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const s = await fetchPublicSparring(id);

  if (!s) {
    return (
      <main style={wrap}>
        <h1 style={h1}>Dieser Sparr ist nicht mehr verfügbar</h1>
        <p style={p}>Finde andere Sparrings in der Sparr-App.</p>
        <OpenInApp sparringId={null} />
      </main>
    );
  }

  const status = webSparringStatus({ scheduledAt: s.scheduled_at, slotsLeft: s.slots_left });

  return (
    <main style={wrap}>
      <p style={kicker}>SPARRING · {s.discipline}</p>
      <h1 style={h1}>{s.title}</h1>
      <ul style={list}>
        <li>{s.area_label}</li>
        <li>{formatDateTimeDE(s.scheduled_at)}</li>
        <li>{s.duration_min} Minuten</li>
        <li>{status === 'expired' ? 'Dieser Sparr ist vorbei' : slotsLeftLabel(s.slots_left)}</li>
      </ul>
      {s.host_name ? <p style={p}>Host: {s.host_name}</p> : null}
      <OpenInApp sparringId={s.id} />
    </main>
  );
}

// Inline styles are acceptable here (Next.js server component, no StyleSheet).
const wrap = { maxWidth: 560, margin: '0 auto', padding: 24, fontFamily: 'Inter, system-ui, sans-serif', color: '#141414', background: '#F7F5F0', minHeight: '100vh' } as const;
const kicker = { color: '#4A90D9', letterSpacing: 2, fontWeight: 700, fontSize: 14 } as const;
const h1 = { fontSize: 28, lineHeight: 1.2, margin: '8px 0 16px' } as const;
const list = { listStyle: 'none', padding: 0, display: 'grid', gap: 8, fontSize: 16 } as const;
const p = { fontSize: 15, color: '#8A8A8A' } as const;
