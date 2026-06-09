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
