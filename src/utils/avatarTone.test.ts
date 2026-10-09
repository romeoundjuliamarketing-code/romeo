import { AVATAR_TONES, avatarTone, avatarToneIndex } from './avatarTone';

describe('avatarTone', () => {
  it('is stable for the same id', () => {
    const id = '6f1c2a3e-9b7d-4c1e-8f00-1234567890ab';
    expect(avatarTone(id)).toBe(avatarTone(id));
    expect(avatarToneIndex(id)).toBe(avatarToneIndex(id));
  });

  it('always returns a palette tone', () => {
    for (const id of ['', 'a', 'b', 'user-1', 'user-2', '00000000-0000-0000-0000-000000000000']) {
      expect(AVATAR_TONES).toContain(avatarTone(id));
    }
  });

  it('spreads ids over more than one tone', () => {
    const tones = new Set(Array.from({ length: 40 }, (_, i) => avatarToneIndex(`user-${i}`)));
    expect(tones.size).toBeGreaterThan(1);
  });
});
