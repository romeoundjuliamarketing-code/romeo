// Default sparring titles are stored as "<German discipline> – Sparring"
// (open_sparrings.title is NOT NULL). Mirror of public.sparring_title_for.
import type { AppLanguage } from './language';
import { disciplineLabel, KNOWN_DISCIPLINES } from './disciplineLabel';

const SUFFIX = ' – Sparring';

export function sparringDisplayTitle(title: string, language: AppLanguage): string {
  const trimmed = title.trim();
  if (!trimmed.endsWith(SUFFIX)) return trimmed;
  const discipline = trimmed.slice(0, -SUFFIX.length);
  if (discipline === 'Sonstiges') return 'Sparring';
  if (!KNOWN_DISCIPLINES.includes(discipline)) return trimmed;
  return `${disciplineLabel(discipline, language)}${SUFFIX}`;
}
