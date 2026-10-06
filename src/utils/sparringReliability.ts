// Formats the reliability quote returned by the get_reliability RPC into
// UI-ready copy. The status sets behind attended/committed are defined
// exclusively server-side (see get_reliability) — this file only formats
// the two numbers, it never recomputes them from raw statuses.

import i18n from '../i18n';

export interface ReliabilityCounts {
  attended: number;
  committed: number;
}

export interface FormattedReliability {
  label: string;
  hasHistory: boolean;
}

export function formatReliability(r: ReliabilityCounts): FormattedReliability {
  if (r.committed === 0) {
    return { label: i18n.t('sparring.reliability.none'), hasHistory: false };
  }
  return {
    label: i18n.t('sparring.reliability.summary', { attended: r.attended, committed: r.committed }),
    hasHistory: true,
  };
}
