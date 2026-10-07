import { colors } from '../theme/colors';
import type { LocalizedText } from '../utils/localized';

// Selectable fighter-card frames — all within the Sparr palette (no gold).
// Stored in profiles.card_frame (CHECK constraint in
// supabase/migrations/20260926120000_profile_fighter_card.sql).
export type CardFrameId = 'klassik' | 'blau' | 'nacht';

export interface CardFrame {
  id:          CardFrameId;
  label:       LocalizedText;
  cardBg:      string;   // card body
  border:      string;   // outer contour
  borderWidth: number;
  band:        string;   // name band background
  bandText:    string;   // name on the band (large text only)
  nickname:    string;   // fighter name on the band
  text:        string;   // body text on the card
  subtle:      string;   // secondary body text on the card
  line:        string;   // dividers inside the card
  accent:      string;   // small accents (icons, stripe)
}

export const CARD_FRAMES: Record<CardFrameId, CardFrame> = {
  klassik: {
    id: 'klassik', label: { de: 'Klassik', en: 'Classic' },
    cardBg: colors.card, border: colors.dark, borderWidth: 2,
    band: colors.dark, bandText: colors.card, nickname: colors.accentBlue,
    text: colors.text, subtle: colors.textMuted, line: colors.hairline, accent: colors.accentBlue,
  },
  blau: {
    id: 'blau', label: { de: 'Blau', en: 'Blue' },
    cardBg: colors.card, border: colors.accentBlue, borderWidth: 3,
    band: colors.dark, bandText: colors.card, nickname: colors.accentBlue,
    text: colors.text, subtle: colors.textMuted, line: colors.hairline, accent: colors.accentBlue,
  },
  nacht: {
    id: 'nacht', label: { de: 'Nacht', en: 'Night' },
    cardBg: colors.dark, border: colors.dark, borderWidth: 2,
    band: colors.accentBlue, bandText: colors.dark, nickname: colors.dark,
    text: colors.card, subtle: colors.textSecondary, line: colors.headerBorder, accent: colors.accentBlue,
  },
};

export const CARD_FRAME_IDS: readonly CardFrameId[] = ['klassik', 'blau', 'nacht'];

export function cardFrame(id: string | null | undefined): CardFrame {
  return CARD_FRAMES[(id ?? 'klassik') as CardFrameId] ?? CARD_FRAMES.klassik;
}
