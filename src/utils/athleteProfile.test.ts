import { experienceLabel, trainingFrequencyLabel, cardBackFacts, trainingHeadline, bodyStats } from './athleteProfile';

const empty = {
  weight_class: null,
  age_years: null,
  nationality: null,
  hometown: null,
  arm_span_cm: null,
};

describe('experienceLabel', () => {
  it('maps onboarding values', () => {
    expect(experienceLabel('1_3_years')).toBe('Fortgeschritten · 1 bis 3 Jahre');
  });
  it('returns null for unknown or missing values', () => {
    expect(experienceLabel('forever')).toBeNull();
    expect(experienceLabel(null)).toBeNull();
    expect(experienceLabel(undefined)).toBeNull();
  });
});

describe('trainingFrequencyLabel', () => {
  it('maps the three tiers', () => {
    expect(trainingFrequencyLabel('low')).toBe('ca. 3x pro Woche');
    expect(trainingFrequencyLabel('high')).toBe('ca. 10x pro Woche');
    expect(trainingFrequencyLabel(null)).toBeNull();
  });
});

describe('cardBackFacts', () => {
  it('is empty for an empty profile', () => {
    expect(cardBackFacts(empty)).toEqual([]);
  });

  it('skips blank strings and keeps a stable order', () => {
    const rows = cardBackFacts({ ...empty, age_years: 27, nationality: '  ', hometown: 'Bottrop' });
    expect(rows.map((r) => r.label)).toEqual(['Alter', 'Heimatstadt']);
    expect(rows[0].value).toBe('27 Jahre');
  });

  it('does not show the weight class (only the fight weight is shown)', () => {
    const rows = cardBackFacts({ ...empty, weight_class: 'Weltergewicht' });
    expect(rows).toEqual([]);
  });
});

describe('trainingHeadline', () => {
  it('is null without frequency and experience', () => {
    expect(trainingHeadline({ training_frequency: null, training_since: null })).toBeNull();
    expect(trainingHeadline({ training_frequency: 'daily', training_since: 'x' })).toBeNull();
  });
  it('turns the frequency tier into the stored approximate count', () => {
    expect(trainingHeadline({ training_frequency: 'medium', training_since: '1_3_years' })).toEqual({
      times: '5×',
      experience: 'Fortgeschritten · 1 bis 3 Jahre Erfahrung',
    });
  });
  it('shows only what is filled', () => {
    expect(trainingHeadline({ training_frequency: 'low' })).toEqual({ times: '3×', experience: null });
  });
});

describe('bodyStats', () => {
  it('lists only filled values and age only from age_years', () => {
    const rows = bodyStats({ weight_kg: 72.5, height_cm: 180, stance: 'orthodox', age_years: null }, 'Orthodox');
    expect(rows.map((r) => r.value)).toEqual(['72,5 kg', '180 cm', 'Orthodox']);
    expect(bodyStats({ weight_kg: null, height_cm: null, stance: null, age_years: 27 }, null))
      .toEqual([{ value: '27', label: 'Alter' }]);
  });
});
