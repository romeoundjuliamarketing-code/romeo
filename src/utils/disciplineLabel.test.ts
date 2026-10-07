import { disciplineLabel } from './disciplineLabel';

describe('disciplineLabel', () => {
  it('translates stored German values to English', () => {
    expect(disciplineLabel('Boxen', 'en' as const)).toBe('Boxing');
    expect(disciplineLabel('K1 / Kickboxen', 'en' as const)).toBe('K1 / Kickboxing');
    expect(disciplineLabel('Ringen', 'en' as const)).toBe('Wrestling');
    expect(disciplineLabel('Sonstiges', 'en' as const)).toBe('Other');
  });
  it('keeps German and unknown values as stored', () => {
    expect(disciplineLabel('Boxen', 'de' as const)).toBe('Boxen');
    expect(disciplineLabel('Capoeira', 'en' as const)).toBe('Capoeira');
    expect(disciplineLabel('MMA', 'en' as const)).toBe('MMA');
  });
});
