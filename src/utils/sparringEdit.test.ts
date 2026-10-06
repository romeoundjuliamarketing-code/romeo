import { changedSparringFields, isMaterialEdit, editNotifyMessage } from './sparringEdit';

const BASE = {
  title:        'Freitagssparring',
  notes:        null,
  discipline:   'Boxen',
  address:      'Hauptstr. 1, 28195 Bremen',
  lat:          53.08,
  lng:          8.8,
  scheduledAt:  '2026-10-09T16:00:00.000Z',
  durationMin:  90,
  maxSlots:     10,
  verifiedOnly: false,
};

describe('changedSparringFields', () => {
  it('meldet nichts bei unverändertem Formular', () => {
    expect(changedSparringFields(BASE, { ...BASE })).toEqual([]);
  });

  it('ignoriert Leerzeichen und leere Notizen wie der Server', () => {
    expect(changedSparringFields(BASE, { ...BASE, title: '  Freitagssparring ', notes: '   ' })).toEqual([]);
  });

  it('vergleicht Zeitpunkte, nicht Schreibweisen', () => {
    expect(changedSparringFields(BASE, { ...BASE, scheduledAt: '2026-10-09T18:00:00+02:00' })).toEqual([]);
    expect(changedSparringFields(BASE, { ...BASE, scheduledAt: '2026-10-09T17:00:00.000Z' })).toEqual(['scheduled_at']);
  });

  it('erkennt Ortsänderungen über Adresse oder Koordinaten', () => {
    expect(changedSparringFields(BASE, { ...BASE, address: 'Weserstr. 9' })).toEqual(['location']);
    expect(changedSparringFields(BASE, { ...BASE, lat: 53.1 })).toEqual(['location']);
  });

  it('listet mehrere Felder in fester Reihenfolge', () => {
    expect(changedSparringFields(BASE, {
      ...BASE, title: 'MMA-Abend', discipline: 'MMA', durationMin: 120, maxSlots: 8, verifiedOnly: true,
    })).toEqual(['duration_min', 'discipline', 'title', 'max_slots', 'verified_only']);
  });
});

describe('isMaterialEdit', () => {
  it('ist wahr für Zeit, Ort, Dauer, Disziplin', () => {
    expect(isMaterialEdit(['scheduled_at'])).toBe(true);
    expect(isMaterialEdit(['location'])).toBe(true);
    expect(isMaterialEdit(['duration_min'])).toBe(true);
    expect(isMaterialEdit(['title', 'discipline'])).toBe(true);
  });

  it('ist falsch für Titel, Notizen, Plätze, verified_only', () => {
    expect(isMaterialEdit(['title', 'notes', 'max_slots', 'verified_only'])).toBe(false);
    expect(isMaterialEdit([])).toBe(false);
  });
});

describe('editNotifyMessage', () => {
  it('nutzt Singular und Plural', () => {
    expect(editNotifyMessage(1)).toBe('1 Teilnehmer wird benachrichtigt und muss neu bestätigen.');
    expect(editNotifyMessage(3)).toBe('3 Teilnehmer werden benachrichtigt und müssen neu bestätigen.');
  });
});
