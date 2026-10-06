import {
  normalizeInstagramHandle,
  instagramProfileUrl,
  toDraft,
  draftToUpdate,
  changedFields,
  isDraftDirty,
} from './profileDraft';

function profile(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Romeo', nickname: null, bio: null, disciplines: ['Boxen'], stance: null,
    training_focus: null, favorite_move: null, height_cm: 180, arm_span_cm: null,
    weight_kg: 72.5, weight_class: null, age_years: 27, nationality: null, hometown: null,
    motto: null, instagram_url: 'romeo.boxt', country_code: null,
    ...overrides,
  } as never;
}

describe('instagram', () => {
  it('normalizes handles, @ and URLs to the bare handle', () => {
    expect(normalizeInstagramHandle('@@romeo.boxt ')).toBe('romeo.boxt');
    expect(normalizeInstagramHandle('https://www.instagram.com/romeo.boxt/?hl=de')).toBe('romeo.boxt');
    expect(normalizeInstagramHandle('instagram.com/romeo')).toBe('romeo');
    expect(normalizeInstagramHandle('   ')).toBe('');
  });
  it('builds a profile URL from stored values', () => {
    expect(instagramProfileUrl('romeo.boxt')).toBe('https://instagram.com/romeo.boxt');
    expect(instagramProfileUrl('https://instagram.com/romeo')).toBe('https://instagram.com/romeo');
    expect(instagramProfileUrl('')).toBeNull();
  });
});

describe('draft conversion', () => {
  it('turns numbers into text with a decimal comma', () => {
    const d = toDraft(profile());
    expect(d.weightKg).toBe('72,5');
    expect(d.heightCm).toBe('180');
    expect(d.armSpanCm).toBe('');
  });

  it('parses a decimal comma and keeps empty optional fields null (not 0)', () => {
    const d = { ...toDraft(profile()), weightKg: '81,3', armSpanCm: '', ageYears: '' };
    const { update, errors } = draftToUpdate(d);
    expect(errors).toEqual({});
    expect(update.weight_kg).toBe(81.3);
    expect(update.arm_span_cm).toBeNull();
    expect(update.age_years).toBeNull();
  });

  it('reports errors per field with the existing ranges', () => {
    const d = { ...toDraft(profile()), heightCm: '90', ageYears: '12', weightKg: 'abc', armSpanCm: '1a' };
    const { errors } = draftToUpdate(d);
    expect(Object.keys(errors).sort()).toEqual(['ageYears', 'armSpanCm', 'heightCm', 'weightKg']);
  });

  it('saves whitespace-only text as null', () => {
    const { update } = draftToUpdate({ ...toDraft(profile()), motto: '   ', nickname: '  Hammer ' });
    expect(update.motto).toBeNull();
    expect(update.nickname).toBe('Hammer');
  });

  it('round-trips the flag country code and clears it to null', () => {
    const d = toDraft(profile({ country_code: 'DE' }));
    expect(d.countryCode).toBe('DE');
    expect(changedFields(draftToUpdate(d).update, profile({ country_code: 'DE' }))).toEqual({});
    expect(draftToUpdate({ ...d, countryCode: '' }).update.country_code).toBeNull();
    expect(changedFields(draftToUpdate({ ...d, countryCode: 'GB-SCT' }).update, profile({ country_code: 'DE' })))
      .toEqual({ country_code: 'GB-SCT' });
  });
});

describe('changes', () => {
  it('writes nothing when nothing changed', () => {
    const p = profile();
    const { update } = draftToUpdate(toDraft(p));
    expect(changedFields(update, p)).toEqual({});
  });

  it('writes only the changed columns', () => {
    const p = profile();
    const { update } = draftToUpdate({ ...toDraft(p), motto: 'Fair sparren', disciplines: ['Boxen', 'MMA'] });
    expect(changedFields(update, p)).toEqual({ motto: 'Fair sparren', disciplines: ['Boxen', 'MMA'] });
  });

  it('does not rewrite a legacy instagram value on unrelated saves', () => {
    const p = profile({ instagram_url: '@romeo.boxt' });
    const { update } = draftToUpdate({ ...toDraft(p), motto: 'Neu' });
    expect(changedFields(update, p)).toEqual({ motto: 'Neu' });
  });

  it('detects a dirty draft', () => {
    const base = toDraft(profile());
    expect(isDraftDirty(base, base)).toBe(false);
    expect(isDraftDirty({ ...base, disciplines: [] }, base)).toBe(true);
    expect(isDraftDirty({ ...base, name: 'Romeo ' }, base)).toBe(true);
  });
});
