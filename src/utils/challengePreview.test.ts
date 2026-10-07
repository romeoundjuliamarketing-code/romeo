import {
  isDeliveredChallenge,
  storedChallengeArea,
  localDayNumber,
  pickPreviewChallenge,
  previewChallengeForArea,
  challengeExcerpt,
  formatCount,
} from './challengePreview';

function card(id: string, title: string, instruction = 'Arbeite nur mit dem Jab. Danach Konter.') {
  return {
    id, area: 'kickboxen' as const,
    title: { de: title, en: title }, instruction: { de: instruction, en: instruction },
    focus: { de: 'Technik', en: 'Technique' }, difficulty: 'schwer' as const,
  };
}

describe('isDeliveredChallenge', () => {
  it('schließt Platzhalter aus', () => {
    expect(isDeliveredChallenge(card('a', 'Platzhalter Boxen 1'))).toBe(false);
    expect(isDeliveredChallenge(card('b', 'Echter Titel', 'Challenge-Text folgt.'))).toBe(false);
    expect(isDeliveredChallenge(card('c', 'Jab-Kontrolle'))).toBe(true);
  });
});

describe('storedChallengeArea', () => {
  it('liest nur gültige gespeicherte Decks', () => {
    expect(storedChallengeArea('{"area":"kickboxen"}')).toBe('kickboxen');
    expect(storedChallengeArea('{"area":"judo"}')).toBeNull();
    expect(storedChallengeArea('kaputt')).toBeNull();
    expect(storedChallengeArea(null)).toBeNull();
  });
});

describe('pickPreviewChallenge', () => {
  const deck = [card('p', 'Platzhalter X'), card('a', 'A'), card('b', 'B'), card('c', 'C')];

  it('ist am selben Tag stabil und wechselt am nächsten', () => {
    const day = localDayNumber(new Date(2026, 9, 7, 8, 0));
    expect(localDayNumber(new Date(2026, 9, 7, 23, 59))).toBe(day);
    const today = pickPreviewChallenge(deck, day);
    expect(pickPreviewChallenge(deck, day)).toBe(today);
    expect(pickPreviewChallenge(deck, day + 1)).not.toBe(today);
  });

  it('zeigt nie Platzhalter und liefert null ohne freigegebene Karten', () => {
    for (let d = 0; d < 6; d++) expect(pickPreviewChallenge(deck, d)?.id).not.toBe('p');
    expect(pickPreviewChallenge([card('p', 'Platzhalter X')], 3)).toBeNull();
  });

  it('nutzt die echten Decks: Kickboxen hat Inhalte, Boxen nur Platzhalter', () => {
    const date = new Date(2026, 9, 7);
    expect(previewChallengeForArea('kickboxen', date)).not.toBeNull();
    expect(previewChallengeForArea('boxen', date)).toBeNull();
  });
});

describe('challengeExcerpt', () => {
  it('nimmt den ersten Satz und kürzt lange Texte an einer Wortgrenze', () => {
    expect(challengeExcerpt('Arbeite nur mit dem Jab. Danach Konter.')).toBe('Arbeite nur mit dem Jab.');
    const long = 'Setze in jeder Runde mindestens fünfmal einen doppelten Jab zum Körper und wechsle danach sofort die Höhe zum Kopf';
    const out = challengeExcerpt(long);
    expect(out.length).toBeLessThanOrEqual(92);
    expect(out.endsWith(' …')).toBe(true);
  });
});

describe('formatCount', () => {
  it('setzt Tausenderpunkte', () => {
    expect(formatCount(4789)).toBe('4.789');
    expect(formatCount(1234567)).toBe('1.234.567');
    expect(formatCount(12)).toBe('12');
  });
});
