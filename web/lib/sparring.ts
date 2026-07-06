export type WebSparringStatus = 'upcoming' | 'full' | 'expired';

export function webSparringStatus(input: {
  scheduledAt: string;
  slotsLeft: number;
  now?: Date;
}): WebSparringStatus {
  const now = input.now ?? new Date();
  if (new Date(input.scheduledAt).getTime() < now.getTime()) return 'expired';
  if (input.slotsLeft <= 0) return 'full';
  return 'upcoming';
}

export function formatDateTimeDE(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' });
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time} Uhr`;
}

export function slotsLeftLabel(slotsLeft: number): string {
  if (slotsLeft <= 0) return 'Ausgebucht';
  return `${slotsLeft} ${slotsLeft === 1 ? 'Platz' : 'Plätze'} frei`;
}
