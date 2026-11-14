// Rules for the free-trial offer that opens by itself after the app starts.
// It opens at most MAX_AUTO_SHOWS times per account on this device; after that
// the trial stays reachable via the Karten tab and the paywall only.

export const MAX_AUTO_SHOWS = 2;

/** A return from the background counts as a new opening after this long. */
export const RESUME_AFTER_MS = 30 * 60 * 1000;

/** Delay between the app being ready and the offer opening. */
export const SHOW_DELAY_MS = 1500;

export function trialOfferStorageKey(userId: string): string {
  return `sparr.trialOffer.shown.v1:${userId}`;
}

/** Stored show count; anything unreadable counts as never shown. */
export function parseShowCount(raw: string | null): number {
  if (raw === null) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Cheap pre-check before the store is asked anything. */
export function mayAutoShow(shownCount: number): boolean {
  return shownCount < MAX_AUTO_SHOWS;
}

export function shouldAutoShow(state: {
  shownCount: number;
  /** Premium or a legacy plan is active. */
  subscribed: boolean;
  /** The store offers this user a free trial right now. */
  trialAvailable: boolean;
}): boolean {
  return mayAutoShow(state.shownCount) && !state.subscribed && state.trialAvailable;
}

/** Whether coming back from the background counts as a new app opening. */
export function isNewOpening(backgroundSinceMs: number | null, nowMs: number): boolean {
  return backgroundSinceMs !== null && nowMs - backgroundSinceMs >= RESUME_AFTER_MS;
}
