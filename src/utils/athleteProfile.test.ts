import { experienceLabel, trainingFrequencyLabel, cardBackFacts, trainingFacts } from './athleteProfile';

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
    const rows = cardBackFacts({ ...empty, weight_class: 'Weltergewicht', age_years: 27, nationality: '  ', hometown: 'Bottrop' });
    expect(rows.map((r) => r.label)).toEqual(['Gewichtsklasse', 'Alter', 'Heimatstadt']);
    expect(rows[1].value).toBe('27 Jahre');
  });
});

describe('trainingFacts', () => {
  it('is empty without training data', () => {
    expect(trainingFacts({ ...empty, is_professional: false, training_focus: ' ' })).toEqual([]);
  });

  it('lists experience, frequency, pro status and focus in order', () => {
    const rows = trainingFacts({
      ...empty,
      training_since: 'over_5_years',
      training_frequency: 'medium',
      is_professional: true,
      training_focus: 'Beinarbeit',
    });
    expect(rows.map((r) => r.label)).toEqual(['Erfahrung', 'Trainingspensum', 'Status', 'Aktueller Fokus']);
    expect(rows[3].value).toBe('Beinarbeit');
  });
});
