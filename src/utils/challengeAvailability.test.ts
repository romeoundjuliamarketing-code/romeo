import {
  availableChallengeAreas,
  playableChallengesForArea,
  normalizeChallengeArea,
  previewChallenges,
  homePreviewChallenges,
} from './challengeAvailability';

describe('delivered card availability', () => {
  it('offers only decks with real cards', () => {
    expect(availableChallengeAreas().map((area) => area.key)).toEqual(['kickboxen']);
  });

  it('never hands placeholder cards to either game mode', () => {
    expect(playableChallengesForArea('boxen')).toEqual([]);
    expect(playableChallengesForArea('kickboxen').length).toBeGreaterThan(0);
    expect(playableChallengesForArea('kickboxen').every((card) => !card.title.de.startsWith('Platzhalter'))).toBe(true);
  });

  it('moves an unavailable stored or profile area to the available deck', () => {
    expect(normalizeChallengeArea('mma')).toBe('kickboxen');
    expect(normalizeChallengeArea('kickboxen')).toBe('kickboxen');
  });
});

describe('released preview cards', () => {
  it('shows exactly the released cards in their order, with the real text', () => {
    const cards = previewChallenges();
    expect(cards.map((card) => card.id)).toEqual(['k1-111', 'k1-028', 'k1-089']);
    expect(cards[1].title.de).toBe('Body-to-Head Relay');
  });

  it('keeps every example task short enough for the preview card', () => {
    expect(previewChallenges().every((card) => card.instruction.de.length <= 120 && card.instruction.en.length <= 120)).toBe(true);
  });

  it('never includes placeholder content', () => {
    expect(previewChallenges().every((card) => !card.title.de.startsWith('Platzhalter'))).toBe(true);
  });

  it('hands the Home fan three delivered cards with short tasks, in fixed order', () => {
    const cards = homePreviewChallenges();
    expect(cards.map((card) => card.id)).toEqual(['k1-111', 'k1-035', 'k1-107']);
    expect(cards.every((card) => card.instruction.de.length <= 100 && card.instruction.en.length <= 100)).toBe(true);
  });
});
