import { normalize, checkText, filterErrorMessage } from './contentFilter';

const list = [
  { word: 'scheisse', category: 'profanity' as const },
  { word: 'arsch', category: 'profanity' as const },
  { word: 'ich bring dich um', category: 'violence' as const },
  { word: 'whatsapp', category: 'contact' as const },
];

describe('normalize', () => {
  it('lowercases and resolves ß', () => {
    expect(normalize('Scheiße')).toBe('scheisse');
  });
  it('reverses leetspeak', () => {
    expect(normalize('Sch3i55e')).toBe('scheisse');
  });
  it('strips diacritics', () => {
    expect(normalize('ärsch')).toBe('arsch');
  });
  it('collapses spaced-out single letters', () => {
    expect(normalize('s c h e i s s e')).toBe('scheisse');
  });
  it('collapses stretched repeated letters but keeps normal doubles', () => {
    expect(normalize('Fuuuuck')).toBe('fuck');
    expect(normalize('Scheeeisse')).toBe('scheisse');
  });
});

describe('checkText', () => {
  it('passes clean text', () => {
    expect(checkText('Lockeres Boxsparring heute Abend', list)).toEqual({ ok: true });
  });
  it('blocks a profanity word', () => {
    expect(checkText('du bist ein Arsch', list)).toEqual({ ok: false, category: 'profanity' });
  });
  it('blocks leetspeak evasion', () => {
    expect(checkText('so eine Sch3i55e', list)).toEqual({ ok: false, category: 'profanity' });
  });
  it('blocks stretched-letter evasion', () => {
    expect(checkText('so eine scheeeisse', list)).toEqual({ ok: false, category: 'profanity' });
  });
  it('blocks a multi-word violence phrase', () => {
    expect(checkText('ich bring dich um', list)).toEqual({ ok: false, category: 'violence' });
  });
  it('does NOT false-positive on substrings', () => {
    expect(checkText('wir marschieren zum Studio', list)).toEqual({ ok: true });
  });
  it('blocks contact info by default', () => {
    expect(checkText('schreib mir auf WhatsApp', list)).toEqual({ ok: false, category: 'contact' });
  });
  it('allows contact info when allowContactInfo is set (Bio)', () => {
    expect(checkText('schreib mir auf WhatsApp', list, { allowContactInfo: true })).toEqual({ ok: true });
  });
  it('returns ok for empty text', () => {
    expect(checkText('   ', list)).toEqual({ ok: true });
  });
});

describe('filterErrorMessage', () => {
  it('returns a German message per category', () => {
    expect(filterErrorMessage('hate')).toContain('diskriminierende');
  });
});
