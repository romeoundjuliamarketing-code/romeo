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
  it('extracts the PLZ + city, ignoring the street', () => {
    expect(coarseAreaLabel({ studioName: null, address: 'Hauptstr. 1, 80331 München' }))
      .toBe('80331 München');
  });
  it('extracts PLZ + city from a plain "PLZ Stadt" address', () => {
    expect(coarseAreaLabel({ studioName: null, address: '14167 Berlin' })).toBe('14167 Berlin');
  });
  it('strips a trailing house number', () => {
    expect(coarseAreaLabel({ studioName: null, address: '01662 talstraße 15' }))
      .toBe('01662 talstraße');
  });
  it('never leaks a coordinate pair', () => {
    expect(coarseAreaLabel({ studioName: null, address: '-72.93627, 34.09779' }))
      .toBe('Ort in der App');
    expect(coarseAreaLabel({ studioName: null, address: '(51.3764511, 6.7506437)' }))
      .toBe('Ort in der App');
  });
  it('returns generic label for a bare postal code (no city)', () => {
    expect(coarseAreaLabel({ studioName: null, address: '21680' })).toBe('Ort in der App');
  });
  it('returns generic label when nothing parseable', () => {
    expect(coarseAreaLabel({ studioName: null, address: 'irgendwo' }))
      .toBe('Ort in der App');
  });
  it('treats empty studio name as absent and still parses the address', () => {
    expect(coarseAreaLabel({ studioName: '', address: '80331 München' })).toBe('80331 München');
  });
});
