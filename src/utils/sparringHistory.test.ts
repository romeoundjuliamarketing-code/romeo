import { historyStatus, isHistoryVisible } from './sparringHistory';

const now = new Date('2026-10-02T12:00:00Z');
const past = '2026-09-30T18:00:00Z';
const future = '2026-10-05T18:00:00Z';

describe('historyStatus', () => {
  it('never turns a past commitment into attendance', () => {
    expect(historyStatus({ role: 'participant', status: 'confirmed', scheduledAt: past }, now))
      .toEqual({ label: 'Teilnahme offen', tone: 'neutral' });
    expect(historyStatus({ role: 'participant', status: 'pending', scheduledAt: past }, now).label).toBe('Teilnahme offen');
  });
  it('uses the recorded result', () => {
    expect(historyStatus({ role: 'participant', status: 'attended', scheduledAt: past }, now).tone).toBe('done');
    expect(historyStatus({ role: 'participant', status: 'no_show', scheduledAt: past }, now).tone).toBe('missed');
  });
  it('labels upcoming slots and organized meetings', () => {
    expect(historyStatus({ role: 'participant', status: 'pending', scheduledAt: future }, now).label).toBe('Zugesagt');
    expect(historyStatus({ role: 'organizer', status: null, scheduledAt: future }, now).label).toBe('Du organisierst');
    expect(historyStatus({ role: 'organizer', status: null, scheduledAt: past }, now).label).toBe('Organisiert');
  });
});

describe('isHistoryVisible', () => {
  it('hides in-time cancellations and expired slots', () => {
    expect(isHistoryVisible({ role: 'participant', status: 'cancelled', scheduledAt: past })).toBe(false);
    expect(isHistoryVisible({ role: 'participant', status: 'expired', scheduledAt: past })).toBe(false);
    expect(isHistoryVisible({ role: 'participant', status: 'cancelled_late', scheduledAt: past })).toBe(true);
    expect(isHistoryVisible({ role: 'organizer', status: null, scheduledAt: past })).toBe(true);
  });
});
