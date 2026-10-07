import i18n from '../i18n';
import { shortDiscipline, shortDay, sparringMarkerLabel } from './sparringMarkerLabel';

// Saturday, 2026-10-03, 10:00 local time.
const NOW = new Date(2026, 9, 3, 10, 0);

function at(day: number, hour = 18): string {
  return new Date(2026, 9, day, hour, 0).toISOString();
}

describe('shortDiscipline', () => {
  it('abbreviates known disciplines', () => {
    expect(shortDiscipline('K1 / Kickboxen')).toBe('K1');
    expect(shortDiscipline('Sonstiges')).toBe('Sparring');
    expect(shortDiscipline('BJJ')).toBe('BJJ');
    expect(shortDiscipline('Muay Thai')).toBe('Muay Thai');
  });

  it('keeps unknown ones short', () => {
    expect(shortDiscipline('Taekwondo Olympic')).toBe('Taekwondo');
    expect(shortDiscipline('Brazilianjiujitsu')).toBe('Brazilian.');
    expect(shortDiscipline('  ')).toBe('Sparring');
  });

  it('shows stored German disciplines in English', async () => {
    expect(shortDiscipline('Boxen')).toBe('Boxen');
    await i18n.changeLanguage('en');
    try {
      expect(shortDiscipline('Boxen')).toBe('Boxing');
      expect(shortDiscipline('Ringen')).toBe('Wrestling');
      expect(shortDiscipline('K1 / Kickboxen')).toBe('K1');
      expect(shortDiscipline('Sonstiges')).toBe('Sparring');
    } finally {
      await i18n.changeLanguage('de');
    }
  });
});

describe('shortDay', () => {
  it('names today and tomorrow', () => {
    expect(shortDay(at(3), NOW)).toBe('Heute');
    expect(shortDay(at(4, 9), NOW)).toBe('Morgen');
  });

  it('uses the weekday within the week', () => {
    expect(shortDay(at(5), NOW)).toBe('Mo');
    expect(shortDay(at(9), NOW)).toBe('Fr');
  });

  it('uses the date from one week on', () => {
    expect(shortDay(at(10), NOW)).toBe('10.10.');
  });
});

describe('sparringMarkerLabel', () => {
  it('joins discipline and day', () => {
    expect(sparringMarkerLabel('K1 / Kickboxen', at(3), NOW)).toBe('K1 · Heute');
  });
});
