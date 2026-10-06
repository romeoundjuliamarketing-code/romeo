// Regelbasierter Wortfilter — pure logic, no React, no network.
import i18n from '../i18n';
// Word list is injected (loaded via useBannedWords) so this stays testable.

export type FilterCategory =
  | 'profanity'
  | 'hate'
  | 'violence'
  | 'sexual'
  | 'spam'
  | 'contact';

export type BannedWord = { word: string; category: FilterCategory };

export type FilterResult = { ok: true } | { ok: false; category: FilterCategory };

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  '$': 's',
};

// Normalize text to defeat common evasion tricks while keeping word tokens.
export function normalize(text: string): string {
  let s = text.toLowerCase();
  s = s.replace(/ß/g, 'ss'); // ß -> ss
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); // strip diacritics
  s = s.replace(/[013457@$]/g, (c) => LEET[c] ?? c); // leetspeak
  s = s.replace(/[^a-z]+/g, ' ').trim(); // non-letters -> single space
  // collapse runs of single letters: "s c h e i s s e" -> "scheisse"
  let prev: string;
  do {
    prev = s;
    s = s.replace(/\b([a-z]) (?=[a-z]\b)/g, '$1');
  } while (s !== prev);
  // collapse stretched letters (3+ identical in a row): "fuuuuck" -> "fuck".
  // Leaves normal double letters intact (e.g. "scheisse" keeps "ss").
  s = s.replace(/([a-z])\1{2,}/g, '$1');
  return s;
}

// Whole-word (space-bounded) match avoids substring false positives.
export function checkText(
  text: string,
  bannedWords: BannedWord[],
  opts?: { allowContactInfo?: boolean },
): FilterResult {
  const normalized = normalize(text);
  if (normalized.length === 0) return { ok: true };
  const haystack = ` ${normalized} `;
  for (const bw of bannedWords) {
    if (opts?.allowContactInfo && bw.category === 'contact') continue;
    const needle = normalize(bw.word);
    if (needle.length === 0) continue;
    if (haystack.includes(` ${needle} `)) {
      return { ok: false, category: bw.category };
    }
  }
  return { ok: true };
}

const MESSAGE_KEYS = {
  profanity: 'home.filter.profanity',
  hate: 'home.filter.hate',
  violence: 'home.filter.violence',
  sexual: 'home.filter.sexual',
  spam: 'home.filter.spam',
  contact: 'home.filter.contact',
} as const satisfies Record<FilterCategory, string>;

export function filterErrorMessage(category: FilterCategory): string {
  return i18n.t(MESSAGE_KEYS[category]);
}
