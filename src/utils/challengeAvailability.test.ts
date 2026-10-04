import {
  availableChallengeAreas,
  playableChallengesForArea,
  normalizeChallengeArea,
  freePreviewChallenge,
  previewChallenges,
} from './challengeAvailability';

describe('delivered card availability', () => {
  it('offers only decks with real cards', () => {
    expect(availableChallengeAreas().map((area) => area.key)).toEqual(['kickboxen']);
  });

  it('never hands placeholder cards to either game mode', () => {
    expect(playableChallengesForArea('boxen')).toEqual([]);
    expect(playableChallengesForArea('kickboxen').length).toBeGreaterThan(0);
    expect(playableChallengesForArea('kickboxen').every((card) => !card.title.startsWith('Platzhalter'))).toBe(true);
  });

  it('moves an unavailable stored or profile area to the available deck', () => {
    expect(normalizeChallengeArea('mma')).toBe('kickboxen');
    expect(normalizeChallengeArea('kickboxen')).toBe('kickboxen');
  });

  it('shows one fixed, delivered K-1 card to nonbuyers', () => {
    expect(freePreviewChallenge()?.id).toBe('k1-017');
    expect(freePreviewChallenge()?.instruction).toBe('Zwinge den Gegner durch massives Box-Volumen in eine starre Doppeldeckung, reiß die Deckung aktiv nach unten (Peeling) und feuer sofort den Cross über seine Hände.');
  });
});

describe('released preview cards', () => {
  it('shows exactly the released cards in their order, with the real text', () => {
    const cards = previewChallenges();
    expect(cards.map((card) => card.id)).toEqual(['k1-017', 'k1-034', 'k1-067']);
    expect(cards[1].title).toBe('Check-Mute');
  });

  it('never includes placeholder content', () => {
    expect(previewChallenges().every((card) => !card.title.startsWith('Platzhalter'))).toBe(true);
  });
});
