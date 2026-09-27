// Display labels for athlete profile values stored as enums. The wording comes
// from the onboarding options (single source) so the profile says exactly what
// the user picked. Unknown values → null.
import { EXPERIENCE_OPTIONS, FREQUENCY_OPTIONS } from '../data/trainingProfileOptions';

export function experienceLabel(trainingSince: string | null | undefined): string | null {
  const opt = EXPERIENCE_OPTIONS.find((o) => o.value === trainingSince);
  return opt !== undefined ? `${opt.label} · ${opt.sub}` : null;
}

export function trainingFrequencyLabel(frequency: string | null | undefined): string | null {
  return FREQUENCY_OPTIONS.find((o) => o.value === frequency)?.label ?? null;
}

export interface FactRow {
  label: string;
  value: string;
}

type FactInput = {
  weight_class:        string | null;
  age_years:           number | null;
  nationality:         string | null;
  hometown:            string | null;
  arm_span_cm:         number | null;
  training_since?:     string | null;
  training_frequency?: string | null;
  is_professional?:    boolean | null;
};

const text = (v: string | null | undefined): string | null =>
  v !== null && v !== undefined && v.trim().length > 0 ? v.trim() : null;

// Personal facts for the back of the fighter card, fixed order, only filled
// fields. Weight, height and stance are on the card front.
export function cardBackFacts(p: FactInput): FactRow[] {
  const rows: FactRow[] = [];
  const weightClass = text(p.weight_class);
  if (weightClass !== null) rows.push({ label: 'Gewichtsklasse', value: weightClass });
  if (p.age_years !== null) rows.push({ label: 'Alter', value: `${p.age_years} Jahre` });
  const nationality = text(p.nationality);
  if (nationality !== null) rows.push({ label: 'Nationalität', value: nationality });
  const hometown = text(p.hometown);
  if (hometown !== null) rows.push({ label: 'Heimatstadt', value: hometown });
  if (p.arm_span_cm !== null) rows.push({ label: 'Spannweite', value: `${p.arm_span_cm} cm` });
  return rows;
}

// "So trainiere ich": experience, training frequency, pro status and the
// optional current focus — only what is actually filled.
export function trainingFacts(p: FactInput & { training_focus?: string | null }): FactRow[] {
  const rows: FactRow[] = [];
  const experience = experienceLabel(p.training_since);
  if (experience !== null) rows.push({ label: 'Erfahrung', value: experience });
  const frequency = trainingFrequencyLabel(p.training_frequency);
  if (frequency !== null) rows.push({ label: 'Trainingspensum', value: frequency });
  if (p.is_professional === true) rows.push({ label: 'Status', value: 'Profi' });
  const focus = text(p.training_focus);
  if (focus !== null) rows.push({ label: 'Aktueller Fokus', value: focus });
  return rows;
}
