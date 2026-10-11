// Coach tour "Sparr kennenlernen": stations, the sparring it shows, where the
// explanation panel goes, and what the profile still misses. Pure, testable.

export const TOUR_STATIONS = ['profile', 'cards', 'discover', 'detail'] as const;
export type TourStation = typeof TOUR_STATIONS[number];

export function tourStationAt(index: number): TourStation {
  return TOUR_STATIONS[Math.max(0, Math.min(TOUR_STATIONS.length - 1, Math.round(index)))];
}

// A resumed tour never starts on the detail station: the sparring it showed
// may be gone, the discover station picks a fresh one.
export function resumeStation(saved: number | null | undefined): number {
  if (saved === null || saved === undefined || !Number.isFinite(saved)) return 0;
  return Math.max(0, Math.min(2, Math.round(saved)));
}

export interface TourSparringCandidate {
  id:           string;
  scheduled_at: string;
  is_active:    boolean;
  max_slots:    number;
  signup_count: number;
}

// The sparring the tour opens: upcoming, active, with a free slot. The list
// is already nearest first, so the first fitting one is the closest.
export function pickTourSparring<T extends TourSparringCandidate>(list: readonly T[], now: Date): T | null {
  return list.find((s) => s.is_active
    && new Date(s.scheduled_at).getTime() > now.getTime()
    && s.signup_count < s.max_slots) ?? null;
}

export interface Rect { x: number; y: number; width: number; height: number }

/** Smallest rect around all targets, or null without any. */
export function unionRect(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((r) => r.x));
  const top = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

// Parts of the explained elements that show between the tour's progress row
// and its coach group (region, window coordinates). Elements entirely hidden
// there get no spotlight hole.
export function visibleHoles(targets: readonly Rect[], region: { top: number; bottom: number }): Rect[] {
  return targets
    .map((r) => {
      const top = Math.max(r.y, region.top);
      const bottom = Math.min(r.y + r.height, region.bottom);
      return { ...r, y: top, height: bottom - top };
    })
    .filter((r) => r.height > 0);
}

export type ProfileGap = 'photo' | 'disciplines';

// What a profile still misses for others to judge a sparring partner. Filled
// fields are never asked again. Only fields the profile editor can change
// (experience/training_since currently has no editor, so it is not listed).
export function missingProfileItems(p: {
  avatar_url:  string | null;
  disciplines: readonly string[] | null;
} | null): ProfileGap[] {
  if (p === null) return [];
  const gaps: ProfileGap[] = [];
  if (p.avatar_url === null || p.avatar_url.trim() === '') gaps.push('photo');
  if (p.disciplines === null || p.disciplines.length === 0) gaps.push('disciplines');
  return gaps;
}
