// Tests for chatList utility functions.
// NOTE: no `import type` — babel cannot parse it in test env.
import { initialsFromTitle, lastMessageTimeLabel, sparringDateLabel } from './chatList';

// ── initialsFromTitle ──────────────────────────────────────────────────────

describe('initialsFromTitle', () => {
  it('returns ? for empty string', () => {
    expect(initialsFromTitle('')).toBe('?');
  });

  it('returns ? for whitespace-only string', () => {
    expect(initialsFromTitle('   ')).toBe('?');
  });

  it('returns one initial from a single word', () => {
    expect(initialsFromTitle('Boxing')).toBe('B');
  });

  it('returns two initials from two words', () => {
    expect(initialsFromTitle('Jiu Jitsu')).toBe('JJ');
  });

  it('returns only first two initials from many words', () => {
    expect(initialsFromTitle('Do Sparring Open')).toBe('DS');
  });

  it('uppercases initials', () => {
    expect(initialsFromTitle('judo session')).toBe('JS');
  });

  it('handles extra whitespace between words', () => {
    expect(initialsFromTitle('  ring  training  ')).toBe('RT');
  });
});


// ── lastMessageTimeLabel ───────────────────────────────────────────────────

describe('lastMessageTimeLabel', () => {
  const now = new Date('2026-06-05T15:00:00');

  it('returns empty string for null', () => {
    expect(lastMessageTimeLabel(null, now)).toBe('');
  });

  it('returns HH:MM for a message today', () => {
    const iso = '2026-06-05T14:32:00';
    expect(lastMessageTimeLabel(iso, now)).toBe('14:32');
  });

  it('returns Gestern for yesterday', () => {
    const iso = '2026-06-04T09:00:00';
    expect(lastMessageTimeLabel(iso, now)).toBe('Gestern');
  });

  it('returns short weekday for a message 3 days ago', () => {
    // 2026-06-05 - 3 = 2026-06-02, which is a Tuesday (Di)
    const iso = '2026-06-02T10:00:00';
    const label = lastMessageTimeLabel(iso, now);
    // Accept Di or Di. depending on locale
    expect(label).toMatch(/^Di\.?$/);
  });

  it('returns TT.MM. for a message older than 7 days', () => {
    const iso = '2026-05-20T10:00:00';
    expect(lastMessageTimeLabel(iso, now)).toBe('20.05.');
  });
});

// ── sparringDateLabel ──────────────────────────────────────────────────────

describe('sparringDateLabel', () => {
  const now = new Date('2026-06-05T10:00:00');

  it('returns Vorbei for a past event', () => {
    const iso = '2026-06-04T19:00:00';
    expect(sparringDateLabel(iso, now)).toBe('Vorbei');
  });

  it('returns Heute · HH:MM for today', () => {
    const iso = '2026-06-05T19:00:00';
    expect(sparringDateLabel(iso, now)).toBe('Heute · 19:00');
  });

  it('returns Morgen · HH:MM for tomorrow', () => {
    const iso = '2026-06-06T11:00:00';
    expect(sparringDateLabel(iso, now)).toBe('Morgen · 11:00');
  });

  it('returns weekday label within 7 days', () => {
    // 2026-06-07 is a Sunday (So)
    const iso = '2026-06-07T10:00:00';
    const label = sparringDateLabel(iso, now);
    expect(label).toMatch(/^So\.? · 10:00$/);
  });

  it('returns TT.MM. · HH:MM for events beyond 7 days', () => {
    const iso = '2026-06-20T14:00:00';
    expect(sparringDateLabel(iso, now)).toBe('20.06. · 14:00');
  });
});

// ── Chat overview helpers ─────────────────────────────────────────────────

import {
  cityFromAddress, chatPlaceLabel, chatWhenLabel, chatPreview, nextUpChatKey, isChatArchived,
} from './chatList';

describe('cityFromAddress', () => {
  it('extracts the city after the postcode', () => {
    expect(cityFromAddress('Hauptstr. 1, 26441 Jever')).toBe('Jever');
    expect(cityFromAddress('Am Markt 3 28195 Bremen')).toBe('Bremen');
    expect(cityFromAddress('Weg 2, 80331 München, Deutschland')).toBe('München');
  });
  it('takes a short digit-free address as the place', () => {
    expect(cityFromAddress('Bremen')).toBe('Bremen');
  });
  it('omits what it cannot read', () => {
    expect(cityFromAddress('53.08000, 8.80000')).toBeNull();
    expect(cityFromAddress('Hauptstraße 12')).toBeNull();
    expect(cityFromAddress('')).toBeNull();
    expect(cityFromAddress(null)).toBeNull();
  });
});

describe('chatPlaceLabel', () => {
  it('prefers the place name', () => {
    expect(chatPlaceLabel('Phoenix Gym', 'Hauptstr. 1, 26441 Jever')).toBe('Phoenix Gym');
    expect(chatPlaceLabel('  ', 'Hauptstr. 1, 26441 Jever')).toBe('Jever');
    expect(chatPlaceLabel(null, null)).toBeNull();
  });
});

describe('chatWhenLabel', () => {
  const NOW = new Date(2026, 9, 4, 12, 0);
  it('labels upcoming dates', () => {
    expect(chatWhenLabel(new Date(2026, 9, 4, 18, 0).toISOString(), NOW)).toBe('Heute, 18:00');
    expect(chatWhenLabel(new Date(2026, 9, 5, 18, 0).toISOString(), NOW)).toBe('Morgen, 18:00');
    expect(chatWhenLabel(new Date(2026, 9, 20, 9, 30).toISOString(), NOW)).toBe('20.10., 09:30');
  });
  it('shows the real date for past meetings, never "Vorbei"', () => {
    const past = chatWhenLabel(new Date(2026, 8, 12, 18, 0).toISOString(), NOW);
    expect(past).toMatch(/12\.09\.$/);
    expect(past).not.toContain('Vorbei');
    expect(chatWhenLabel(new Date(2025, 11, 30, 18, 0).toISOString(), NOW)).toMatch(/30\.12\.2025$/);
  });
});

describe('chatPreview', () => {
  const base = { kind: 'sparring' as const, lastText: 'Bringt jemand Pratzen mit?', lastSenderName: 'Romeo Georgiadis', lastFromMe: false, lastIsSystem: false };
  it('prefixes the sender first name', () => {
    expect(chatPreview(base)).toEqual({ sender: 'Romeo', text: 'Bringt jemand Pratzen mit?', empty: false });
  });
  it('marks own messages with Du', () => {
    expect(chatPreview({ ...base, lastFromMe: true }).sender).toBe('Du');
  });
  it('shows system messages without a sender', () => {
    expect(chatPreview({ ...base, lastIsSystem: true, lastSenderName: null }).sender).toBeNull();
  });
  it('invites in empty chats, per kind', () => {
    expect(chatPreview({ ...base, lastText: null }).text).toBe('Klärt hier die letzten Details fürs Training.');
    expect(chatPreview({ ...base, kind: 'event', lastText: null }).text).toBe('Klärt hier die letzten Details für euer Treffen.');
  });
  it('flattens line breaks for the one-line preview', () => {
    expect(chatPreview({ ...base, lastText: 'a\n\nb' }).text).toBe('a b');
  });
});

describe('nextUpChatKey', () => {
  const NOW = new Date(2026, 9, 4, 12, 0);
  const at = (d: number) => new Date(2026, 9, d, 18, 0).toISOString();
  it('picks the soonest committed upcoming sparring', () => {
    expect(nextUpChatKey([
      { key: 'a', kind: 'sparring', scheduledAt: at(8), myStatus: 'confirmed' },
      { key: 'b', kind: 'sparring', scheduledAt: at(6), myStatus: 'organizer' },
      { key: 'c', kind: 'sparring', scheduledAt: at(5), myStatus: 'pending' },
      { key: 'd', kind: 'event', scheduledAt: at(5), myStatus: 'organizer' },
      { key: 'e', kind: 'sparring', scheduledAt: at(1), myStatus: 'confirmed' },
    ], NOW)).toBe('b');
  });
  it('is null without a match', () => {
    expect(nextUpChatKey([{ key: 'c', kind: 'sparring', scheduledAt: at(5), myStatus: 'pending' }], NOW)).toBeNull();
  });
});

describe('isChatArchived', () => {
  it('archives once the meeting has ended', () => {
    const now = new Date(2026, 9, 4, 12, 0);
    expect(isChatArchived(new Date(2026, 9, 4, 10, 0).toISOString(), 90, now)).toBe(true);
    expect(isChatArchived(new Date(2026, 9, 4, 11, 0).toISOString(), 90, now)).toBe(false);
  });
});
