import {
  checkinPhase,
  checkinQrValue,
  classifyFix,
  fixToRpcArgs,
  formatTooFarKm,
  parseCheckinQr,
  serverOffsetMs,
  trustNoticeFor,
} from './sparringTrust';

const NOW = Date.parse('2026-10-08T12:00:00.000Z');

function fix(accuracyM: number, ageS: number) {
  return { lat: 53.08, lng: 8.8, accuracyM, timestamp: NOW - ageS * 1000 };
}

describe('classifyFix', () => {
  it('akzeptiert frische, genaue Positionen', () => {
    expect(classifyFix(fix(20, 5), NOW)).toBe('ok');
    expect(classifyFix(fix(200, 5), NOW)).toBe('ok');
  });
  it('misst bei zu ungenauer Position neu', () => {
    expect(classifyFix(fix(201, 5), NOW)).toBe('inaccurate');
    expect(classifyFix(fix(Number.NaN, 5), NOW)).toBe('inaccurate');
  });
  it('misst vor Ablauf des Serverlimits neu', () => {
    expect(classifyFix(fix(20, 90), NOW)).toBe('ok');
    expect(classifyFix(fix(20, 91), NOW)).toBe('stale');
  });
});

describe('fixToRpcArgs', () => {
  it('sendet nur Position, Genauigkeit und Alter', () => {
    expect(fixToRpcArgs(fix(12.34, 7), NOW)).toEqual({
      p_lat: 53.08, p_lng: 8.8, p_accuracy_m: 12.3, p_fix_age_s: 7,
    });
  });
  it('setzt negatives Alter (Uhrabweichung) auf 0', () => {
    expect(fixToRpcArgs(fix(10, -3), NOW).p_fix_age_s).toBe(0);
  });
});

describe('formatTooFarKm', () => {
  it('erfindet keine Distanz', () => {
    expect(formatTooFarKm(undefined, 150, 'de-DE')).toBeNull();
    expect(formatTooFarKm(null, 150, 'de-DE')).toBeNull();
  });
  it('zeigt knapp über dem Radius nie den Radius selbst', () => {
    expect(formatTooFarKm(150000.4, 150, 'de-DE')).toBe('150,1');
    expect(formatTooFarKm(150950, 150, 'de-DE')).toBe('151,0');
  });
  it('rundet weit entfernte Distanzen auf ganze km', () => {
    expect(formatTooFarKm(512345, 150, 'de-DE')).toBe('512');
    expect(formatTooFarKm(1512345, 300, 'en-US')).toBe('1,512');
  });
});

describe('trustNoticeFor', () => {
  it('bietet bei zu großer Entfernung Nähe und Erklärung an', () => {
    expect(trustNoticeFor('too_far')).toEqual({ key: 'tooFar', actions: ['nearby', 'howItWorks'] });
  });
  it('verlinkt bei belegtem Slot den eigenen Termin', () => {
    expect(trustNoticeFor('slot_taken').actions).toEqual(['mySparring']);
  });
  it('bietet bei Standortproblemen Wiederholen an', () => {
    expect(trustNoticeFor('location_missing').actions).toContain('retry');
    expect(trustNoticeFor('location_stale').actions).toContain('retry');
  });
  it('fasst falsche Codes zusammen', () => {
    expect(trustNoticeFor('token_wrong_sparring').key).toBe('tokenInvalid');
  });
  it('fällt bei Unbekanntem auf einen allgemeinen Text zurück', () => {
    expect(trustNoticeFor('join_failed').key).toBe('generic');
  });
});

describe('checkinPhase', () => {
  const opens = '2026-10-08T11:30:00.000Z';
  const closes = '2026-10-08T14:00:00.000Z';
  it('unterscheidet vor, während und nach dem Fenster', () => {
    expect(checkinPhase(opens, closes, Date.parse('2026-10-08T11:29:59.000Z'))).toBe('before');
    expect(checkinPhase(opens, closes, Date.parse(opens))).toBe('open');
    expect(checkinPhase(opens, closes, Date.parse(closes))).toBe('open');
    expect(checkinPhase(opens, closes, Date.parse('2026-10-08T14:00:01.000Z'))).toBe('closed');
  });
});

describe('serverOffsetMs', () => {
  it('berechnet die Abweichung zur Serverzeit', () => {
    expect(serverOffsetMs('2026-10-08T12:00:05.000Z', NOW)).toBe(5000);
    expect(serverOffsetMs('kaputt', NOW)).toBe(0);
  });
});

describe('Check-in-QR', () => {
  const token = 'AbCdEfGhIjKlMnOpQrStUvWxYz012345';
  it('liest nur eigene Check-in-Codes', () => {
    expect(parseCheckinQr(checkinQrValue(token))).toBe(token);
    expect(parseCheckinQr('https://sparrapp.com/u/123')).toBeNull();
    expect(parseCheckinQr('sparr-checkin:v1:kurz')).toBeNull();
    expect(parseCheckinQr('sparr-checkin:v1:abc def ghi jkl mno')).toBeNull();
  });
});
