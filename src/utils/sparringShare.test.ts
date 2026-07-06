import {
  buildSparringShareUrl,
  sparringShareStatus,
  coarseAreaLabel,
  SHARE_BASE_URL,
} from './sparringShare';

describe('buildSparringShareUrl', () => {
  it('builds a /s/<id> url on the share base', () => {
    expect(buildSparringShareUrl('abc-123')).toBe(`${SHARE_BASE_URL}/s/abc-123`);
  });
  it('encodes the id', () => {
    expect(buildSparringShareUrl('a b')).toBe(`${SHARE_BASE_URL}/s/a%20b`);
  });
});

describe('sparringShareStatus', () => {
  const now = new Date('2026-07-06T12:00:00Z');

  it('is expired when scheduledAt is in the past', () => {
    expect(sparringShareStatus({ scheduledAt: '2026-07-05T12:00:00Z', slotsLeft: 3, now }))
      .toBe('expired');
  });
  it('is full when no slots left and still upcoming', () => {
    expect(sparringShareStatus({ scheduledAt: '2026-07-07T12:00:00Z', slotsLeft: 0, now }))
      .toBe('full');
  });
  it('is upcoming when in the future with free slots', () => {
    expect(sparringShareStatus({ scheduledAt: '2026-07-07T12:00:00Z', slotsLeft: 2, now }))
      .toBe('upcoming');
  });
  it('treats negative slotsLeft as full', () => {
    expect(sparringShareStatus({ scheduledAt: '2026-07-07T12:00:00Z', slotsLeft: -1, now }))
      .toBe('full');
  });
  it('expired takes precedence over full', () => {
    expect(sparringShareStatus({ scheduledAt: '2026-07-05T12:00:00Z', slotsLeft: 0, now }))
      .toBe('expired');
  });
});

describe('coarseAreaLabel', () => {
  it('uses the studio name when present', () => {
    expect(coarseAreaLabel({ studioName: 'Boxwerk', address: 'Hauptstr. 1, 80331 München' }))
      .toBe('Boxwerk');
  });
  it('falls back to the city segment after the last comma', () => {
    expect(coarseAreaLabel({ studioName: null, address: 'Hauptstr. 1, 80331 München' }))
      .toBe('80331 München');
  });
  it('returns generic label when no studio and no comma', () => {
    expect(coarseAreaLabel({ studioName: null, address: 'irgendwo' }))
      .toBe('Ort in der App');
  });
  it('treats empty studio name as absent', () => {
    expect(coarseAreaLabel({ studioName: '', address: 'X, Berlin' })).toBe('Berlin');
  });
});
