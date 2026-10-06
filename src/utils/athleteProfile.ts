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
  if (p.age_years !== null) rows.push({ label: 'Alter', value: `${p.age_years} Jahre` });
  const nationality = text(p.nationality);
  if (nationality !== null) rows.push({ label: 'Nationalität', value: nationality });
  const hometown = text(p.hometown);
  if (hometown !== null) rows.push({ label: 'Heimatstadt', value: hometown });
  if (p.arm_span_cm !== null) rows.push({ label: 'Spannweite', value: `${p.arm_span_cm} cm` });
  return rows;
}

// ── Profile typography ──────────────────────────────────────────────────────

// Times per week behind each frequency tier (wording in FREQUENCY_OPTIONS:
// "ca. 3x / 5x / 10x pro Woche"). Kept approximate on screen ("ca.").
const FREQUENCY_TIMES: Record<string, number> = { low: 3, medium: 5, high: 10 };

export interface TrainingHeadline {
  /** Big number, e.g. "5×"; null when no frequency is stored. */
  times:      string | null;
  /** Experience line, e.g. "Fortgeschritten · 1 bis 3 Jahre Erfahrung". */
  experience: string | null;
}

// "So trainiere ich" as typography: only stored frequency and experience,
// nothing derived or invented. Null when neither is filled.
export function trainingHeadline(p: {
  training_since?:     string | null;
  training_frequency?: string | null;
}): TrainingHeadline | null {
  const n = p.training_frequency != null ? FREQUENCY_TIMES[p.training_frequency] : undefined;
  const times = n !== undefined ? `${n}×` : null;
  const opt = EXPERIENCE_OPTIONS.find((o) => o.value === p.training_since);
  const experience = opt !== undefined ? `${opt.label} · ${opt.sub} Erfahrung` : null;
  if (times === null && experience === null) return null;
  return { times, experience };
}

export interface BodyStat {
  value: string;
  label: string;
}

const formatKg = (kg: number): string =>
  Number.isInteger(kg) ? String(kg) : kg.toLocaleString('de-DE', { maximumFractionDigits: 1 });

// Weight, height, stance and — only from the dedicated age field — age.
// Values are short so they can sit on the page without a table frame.
export function bodyStats(p: {
  weight_kg:  number | null;
  height_cm:  number | null;
  stance:     string | null;
  age_years?: number | null;
}, stanceText: string | null): BodyStat[] {
  const rows: BodyStat[] = [];
  if (p.weight_kg !== null) rows.push({ value: `${formatKg(p.weight_kg)} kg`, label: 'Gewicht' });
  if (p.height_cm !== null) rows.push({ value: `${p.height_cm} cm`, label: 'Größe' });
  if (stanceText !== null) rows.push({ value: stanceText, label: 'Auslage' });
  if (p.age_years != null) rows.push({ value: String(p.age_years), label: 'Alter' });
  return rows;
}
