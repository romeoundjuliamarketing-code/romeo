import { SPARRING_CHALLENGES } from '../data/sparringChallenges';
import {
  SPARRING_RULES, SPARRING_RULES_INTRO, SPARRING_RULES_PREAMBLE, SPARRING_CONSENT_ITEMS, SPARRING_CONSENT_CHECKBOX_LABEL,
} from '../data/sparringRules';
import { CARD_FRAMES } from '../data/cardFrames';

const filled = (t: { de: string; en: string }): boolean => t.de.trim().length > 0 && t.en.trim().length > 0;

describe('bilingual content', () => {
  it('every challenge card has de + en', () => {
    for (const c of SPARRING_CHALLENGES) {
      expect([c.id, filled(c.title), filled(c.instruction), filled(c.focus)]).toEqual([c.id, true, true, true]);
      if (c.successCriteria) expect([c.id, filled(c.successCriteria)]).toEqual([c.id, true]);
    }
  });
  it('rules have de + en', () => {
    expect(filled(SPARRING_RULES_PREAMBLE)).toBe(true);
    expect(filled(SPARRING_RULES_INTRO.title)).toBe(true);
    SPARRING_RULES_INTRO.paragraphs.forEach((p) => expect(filled(p)).toBe(true));
    SPARRING_RULES.forEach((r) => expect([r.number, filled(r.title), filled(r.body)]).toEqual([r.number, true, true]));
    SPARRING_CONSENT_ITEMS.forEach((i) => expect([i.de, filled(i)]).toEqual([i.de, true]));
    expect(filled(SPARRING_CONSENT_CHECKBOX_LABEL)).toBe(true);
  });
  it('card frame labels have de + en', () => {
    Object.values(CARD_FRAMES).forEach((f) => expect([f.id, filled(f.label)]).toEqual([f.id, true]));
  });
});
