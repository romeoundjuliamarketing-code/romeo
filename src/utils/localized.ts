// Bilingual content fields (challenge cards, rules, ...) that live in src/data/.
import type { AppLanguage } from './language';

export interface LocalizedText {
  readonly de: string;
  readonly en: string;
}

export function localized(text: LocalizedText, language: AppLanguage): string {
  return language === 'en' && text.en.trim().length > 0 ? text.en : text.de;
}
