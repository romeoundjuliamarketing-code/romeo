import { STUDIO_QR_PREFIX, buildStudioQr, parseStudioQr } from './studioQr';

describe('studioQr', () => {
  const id = 'a1b2c3d4-0000-4444-8888-abcdefabcdef';

  it('builds a prefixed payload', () => {
    expect(buildStudioQr(id)).toBe(`${STUDIO_QR_PREFIX}${id}`);
  });

  it('round-trips build -> parse', () => {
    expect(parseStudioQr(buildStudioQr(id))).toBe(id);
  });

  it('parses an uppercased payload (as the scanner emits it)', () => {
    expect(parseStudioQr(`STUDIO:${id.toUpperCase()}`)).toBe(id);
  });

  it('ignores surrounding whitespace', () => {
    expect(parseStudioQr(`  ${buildStudioQr(id)}  `)).toBe(id);
  });

  it('returns null for non-studio codes', () => {
    expect(parseStudioQr('ABC123')).toBeNull();
    expect(parseStudioQr('@FIGHTER42')).toBeNull();
  });

  it('returns null for an empty id', () => {
    expect(parseStudioQr('STUDIO:')).toBeNull();
  });
});
