import {
  pickFeaturedSparring,
  sparringCardState,
  confirmDeadline,
  appointmentDayLabel,
  timeLabel,
  displaySparringTitle,
  shortAddress,
  msUntilNextMidnight,
  homeSparringTitle,
  dateBlockParts,
  participantsPreview,
} from './homeAgenda';

// Wednesday 2026-10-07, 12:00 local time
const NOW = new Date(2026, 9, 7, 12, 0, 0);

function inHours(h: number): string {
  return new Date(NOW.getTime() + h * 3_600_000).toISOString();
}

function sparring(id: string, hours: number, role: 'organizer' | 'pending' | 'confirmed' = 'confirmed') {
  return {
    id, title: `Sparring ${id}`, discipline: 'Boxen', scheduledAt: inHours(hours), durationMin: 90,
    gymName: null, locationLabel: 'Bremen', role, participants: [],
  };
}

describe('pickFeaturedSparring', () => {
  it('ist null ohne Sparrings', () => {
    expect(pickFeaturedSparring([], NOW)).toBeNull();
  });

  it('nimmt das zeitlich nächste zukünftige Sparring, unabhängig von der Eingabereihenfolge', () => {
    const list = [sparring('spaet', 72), sparring('frueh', 30, 'pending'), sparring('mitte', 48, 'organizer')];
    expect(pickFeaturedSparring(list, NOW)?.id).toBe('frueh');
  });

  it('sortiert nach Zeitstempel über Jahresgrenzen hinweg', () => {
    const list = [sparring('naechstesJahr', 24 * 400), sparring('bald', 24 * 3)];
    expect(pickFeaturedSparring(list, NOW)?.id).toBe('bald');
  });

  it('überspringt begonnene und vergangene Sparrings', () => {
    expect(pickFeaturedSparring([sparring('vorbei', -48), sparring('laeuft', -0.5), sparring('kommt', 5)], NOW)?.id).toBe('kommt');
  });
});

describe('sparringCardState', () => {
  it('fordert den Gastgeber nie zur Bestätigung auf', () => {
    expect(sparringCardState(sparring('o', 3, 'organizer'), NOW)).toBe('host');
  });

  it('verlangt Bestätigung nur für pending im Bestätigungsfenster', () => {
    expect(sparringCardState(sparring('p', 10, 'pending'), NOW)).toBe('confirm');
    expect(sparringCardState(sparring('p', 72, 'pending'), NOW)).toBe('in');
  });

  it('erzeugt bei weit entfernten Terminen keine Dringlichkeit', () => {
    expect(sparringCardState(sparring('fern', 24 * 960, 'pending'), NOW)).toBe('in');
  });

  it('zeigt bestätigte Teilnahme unabhängig vom Datum', () => {
    expect(sparringCardState(sparring('c', 3, 'confirmed'), NOW)).toBe('confirmed');
  });
});

describe('confirmDeadline', () => {
  it('liegt 6 Stunden vor Beginn und entfällt, wenn sie vorbei ist', () => {
    expect(confirmDeadline(inHours(10), NOW)?.getTime()).toBe(NOW.getTime() + 4 * 3_600_000);
    expect(confirmDeadline(inHours(5), NOW)).toBeNull();
  });
});

describe('Labels', () => {
  it('Tag: heute, morgen, nächste Woche, anderes Jahr', () => {
    expect(appointmentDayLabel(new Date(2026, 9, 7, 23, 59), NOW)).toBe('Heute');
    expect(appointmentDayLabel(new Date(2026, 9, 8, 0, 5), NOW)).toBe('Morgen');
    expect(appointmentDayLabel(new Date(2026, 9, 16, 18, 30), NOW)).toBe('Fr., 16. Okt.');
    expect(appointmentDayLabel(new Date(2029, 4, 25, 21, 0), NOW)).toBe('Fr., 25. Mai 2029');
    expect(timeLabel(new Date(2026, 9, 8, 9, 5))).toBe('09:05');
  });

  it('vereinfacht nur den generischen Sonstiges-Titel', () => {
    expect(displaySparringTitle('Sonstiges – Sparring')).toBe('Sparring');
    expect(displaySparringTitle('K1 / Kickboxen – Sparring')).toBe('K1 / Kickboxen – Sparring');
    expect(displaySparringTitle('Offenes Technik-Sparring')).toBe('Offenes Technik-Sparring');
  });

  it('kürzt Adressen um Postleitzahl und Land', () => {
    expect(shortAddress('Hauptstr. 1, 28195 Bremen')).toBe('Hauptstr. 1, Bremen');
    expect(shortAddress('Am Markt 3, 26441 Jever, Deutschland')).toBe('Am Markt 3, Jever');
    expect(shortAddress('Jever')).toBe('Jever');
  });

  it('rechnet bis zur nächsten Mitternacht', () => {
    expect(msUntilNextMidnight(NOW)).toBe(12 * 3_600_000);
  });
});

describe('homeSparringTitle', () => {
  it('nutzt bei reinem "Sparring" den Ort als Hauptzeile', () => {
    expect(homeSparringTitle('Sonstiges – Sparring', 'Hauptstr. 1, Bremen')).toEqual({ text: 'Bremen', isPlace: true });
    expect(homeSparringTitle('Sparring', 'Delmenhorst')).toEqual({ text: 'Delmenhorst', isPlace: true });
  });
  it('lässt eigene Titel unverändert', () => {
    expect(homeSparringTitle('Boxen – Sparring', 'Bremen')).toEqual({ text: 'Boxen – Sparring', isPlace: false });
  });
  it('bleibt "Sparring" ohne Ort', () => {
    expect(homeSparringTitle('Sparring', '  ')).toEqual({ text: 'Sparring', isPlace: false });
  });
});

describe('dateBlockParts', () => {
  it('zeigt Wochentag, Tag und Monat', () => {
    expect(dateBlockParts(new Date(2026, 9, 9, 18, 0), NOW)).toEqual({ weekday: 'Fr.', day: '9', month: 'Okt.', year: null });
  });
  it('ergänzt das Jahr außerhalb des aktuellen Jahres', () => {
    expect(dateBlockParts(new Date(2027, 0, 4, 18, 0), NOW).year).toBe('2027');
  });
});

describe('participantsPreview', () => {
  const p = (userId: string) => ({ userId, name: userId, avatarUrl: null });

  it('zählt den Nutzer nicht bei "weitere" mit und zeigt ihn zuerst', () => {
    const res = participantsPreview([p('a'), p('me'), p('b'), p('c'), p('d')], 'me');
    expect(res.label).toBe('Du + 4 weitere');
    expect(res.shown.map((x) => x.userId)).toEqual(['me', 'a', 'b']);
  });
  it('lässt die Zeile weg, wenn nur der Nutzer dabei ist', () => {
    expect(participantsPreview([p('me')], 'me')).toEqual({ shown: [], label: null });
  });
  it('zählt Zusagen für den Organisator', () => {
    expect(participantsPreview([p('a')], 'me').label).toBe('1 Zusage');
    expect(participantsPreview([p('a'), p('b')], 'me').label).toBe('2 Zusagen');
  });
  it('ist leer ohne Teilnehmer', () => {
    expect(participantsPreview([], 'me')).toEqual({ shown: [], label: null });
  });
});
