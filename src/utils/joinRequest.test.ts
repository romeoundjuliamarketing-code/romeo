import { joinButtonLabel } from './joinRequest';

describe('joinButtonLabel', () => {
  it('returns correct label for none state', () => {
    expect(joinButtonLabel('none')).toBe('Beitritt anfragen');
  });

  it('returns correct label for pending state', () => {
    expect(joinButtonLabel('pending')).toBe('Anfrage ausstehend');
  });

  it('returns correct label for member state', () => {
    expect(joinButtonLabel('member')).toBe('Mitglied');
  });
});
