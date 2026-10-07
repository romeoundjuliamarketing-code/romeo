// Discipline values are stored in German (sparrings, profiles, gyms). Only the
// display is translated; mirror of public.discipline_label on the server.
import type { AppLanguage } from './language';

const EN: Record<string, string> = {
  'Boxen':          'Boxing',
  'Kickboxen':      'Kickboxing',
  'K1 / Kickboxen': 'K1 / Kickboxing',
  'Ringen':         'Wrestling',
  'Sonstiges':      'Other',
};

export const KNOWN_DISCIPLINES: readonly string[] = [
  'Boxen', 'Kickboxen', 'K1 / Kickboxen', 'Ringen', 'Sonstiges', 'BJJ', 'MMA', 'Muay Thai', 'Wrestling',
];

export function disciplineLabel(value: string, language: AppLanguage): string {
  if (language === 'de') return value;
  return EN[value] ?? value;
}
