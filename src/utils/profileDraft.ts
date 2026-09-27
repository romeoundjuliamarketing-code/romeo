// Pure draft logic of "Profil bearbeiten": form values are strings, the saved
// profile keeps its existing column types. Only changed fields are written,
// empty optional fields become null (never 0 or ""), placeholders are never
// values. Validation ranges are unchanged from the previous form.
import type { Profile, ProfileUpdate } from '../types/database.types';
import type { Stance } from './stance';

export interface ProfileDraft {
  name:          string;
  nickname:      string;
  bio:           string;
  disciplines:   string[];
  stance:        Stance | null;
  trainingFocus: string;
  favoriteMove:  string;
  heightCm:      string;
  armSpanCm:     string;
  weightKg:      string;
  weightClass:   string;
  ageYears:      string;
  nationality:   string;
  hometown:      string;
  motto:         string;
  instagram:     string;
}

export type DraftField = keyof ProfileDraft;
export type DraftErrors = Partial<Record<DraftField, string>>;

export const TEXT_LIMITS = {
  name: 40, nickname: 50, bio: 300, trainingFocus: 60, favoriteMove: 40,
  nationality: 50, hometown: 100, motto: 60, instagram: 30,
} as const;

// Instagram: stored as the bare handle (that is what existing rows contain).
// Accepts "@name", "name", or a full instagram.com URL.
export function normalizeInstagramHandle(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^instagram\.com\//i, '')
    .replace(/^@+/, '')
    .replace(/[/?#].*$/, '')
    .trim();
}

// Opens the handle on Instagram. Tolerates legacy values that already are URLs.
export function instagramProfileUrl(stored: string): string | null {
  const handle = normalizeInstagramHandle(stored);
  return handle.length > 0 ? `https://instagram.com/${encodeURIComponent(handle)}` : null;
}

const numText = (v: number | null): string => (v !== null ? String(v).replace('.', ',') : '');

export function toDraft(p: Profile): ProfileDraft {
  return {
    name:          p.name ?? '',
    nickname:      p.nickname ?? '',
    bio:           p.bio ?? '',
    disciplines:   p.disciplines ?? [],
    stance:        p.stance ?? null,
    trainingFocus: p.training_focus ?? '',
    favoriteMove:  p.favorite_move ?? '',
    heightCm:      numText(p.height_cm),
    armSpanCm:     numText(p.arm_span_cm),
    weightKg:      numText(p.weight_kg),
    weightClass:   p.weight_class ?? '',
    ageYears:      numText(p.age_years),
    nationality:   p.nationality ?? '',
    hometown:      p.hometown ?? '',
    motto:         p.motto ?? '',
    instagram:     normalizeInstagramHandle(p.instagram_url ?? ''),
  };
}

const str = (v: string): string | null => (v.trim().length > 0 ? v.trim() : null);

// Integer field within a range; '' → null. Returns an error message otherwise.
function parseInt10(v: string, min: number, max: number, message: string): { value: number | null; error?: string } {
  const t = v.trim();
  if (t.length === 0) return { value: null };
  if (!/^\d+$/.test(t)) return { value: null, error: message };
  const n = parseInt(t, 10);
  return n < min || n > max ? { value: null, error: message } : { value: n };
}

// Weight in kg with comma or dot; '' → null. The old form had no check here
// (a typo was saved as NaN); the range matches the existing weekly weight log
// (ProfilScreen handleSaveWeight: 0 < kg < 500).
function parseWeight(v: string): { value: number | null; error?: string } {
  const t = v.trim().replace(',', '.');
  if (t.length === 0) return { value: null };
  if (!/^\d+(\.\d+)?$/.test(t)) return { value: null, error: 'Bitte ein Gewicht wie 72,5 eingeben.' };
  const n = parseFloat(t);
  return n <= 0 || n >= 500 ? { value: null, error: 'Bitte ein realistisches Gewicht eingeben.' } : { value: n };
}

// Full update for a draft, or per-field errors. Height/arm span 100–250 cm and
// age 14–99 as before; weight see parseWeight.
export function draftToUpdate(d: ProfileDraft): { update: ProfileUpdate; errors: DraftErrors } {
  const errors: DraftErrors = {};
  const height = parseInt10(d.heightCm, 100, 250, 'Körpergröße zwischen 100 und 250 cm.');
  const armSpan = parseInt10(d.armSpanCm, 100, 250, 'Spannweite zwischen 100 und 250 cm.');
  const age = parseInt10(d.ageYears, 14, 99, 'Alter zwischen 14 und 99 Jahren.');
  const weight = parseWeight(d.weightKg);
  if (height.error) errors.heightCm = height.error;
  if (armSpan.error) errors.armSpanCm = armSpan.error;
  if (age.error) errors.ageYears = age.error;
  if (weight.error) errors.weightKg = weight.error;

  const update: ProfileUpdate = {
    name:           str(d.name),
    nickname:       str(d.nickname),
    bio:            str(d.bio)?.slice(0, TEXT_LIMITS.bio) ?? null,
    disciplines:    d.disciplines,
    stance:         d.stance,
    training_focus: str(d.trainingFocus),
    favorite_move:  str(d.favoriteMove),
    height_cm:      height.value,
    arm_span_cm:    armSpan.value,
    weight_kg:      weight.value,
    weight_class:   str(d.weightClass),
    age_years:      age.value,
    nationality:    str(d.nationality),
    hometown:       str(d.hometown),
    motto:          str(d.motto),
    instagram_url:  str(normalizeInstagramHandle(d.instagram)),
  };
  return { update, errors };
}

// Only the columns whose value actually changed — no write without changes.
export function changedFields(update: ProfileUpdate, original: Profile): ProfileUpdate {
  const out: Record<string, unknown> = {};
  const orig = original as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(update)) {
    // Legacy instagram values ("@name", full URL) count as unchanged when they
    // normalize to the same handle — no silent rewrite on unrelated saves.
    const before = key === 'instagram_url' && typeof orig[key] === 'string'
      ? (normalizeInstagramHandle(orig[key] as string) || null)
      : (orig[key] ?? null);
    const same = Array.isArray(value) && Array.isArray(before)
      ? value.length === before.length && value.every((v, i) => v === before[i])
      : (value ?? null) === before;
    if (!same) out[key] = value;
  }
  return out as ProfileUpdate;
}

export function isDraftDirty(draft: ProfileDraft, baseline: ProfileDraft): boolean {
  return (Object.keys(draft) as DraftField[]).some((k) => {
    const a = draft[k];
    const b = baseline[k];
    return Array.isArray(a) && Array.isArray(b)
      ? a.length !== b.length || a.some((v, i) => v !== b[i])
      : a !== b;
  });
}
