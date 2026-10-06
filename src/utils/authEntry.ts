// Entry decisions for signed-out users: whether the app still waits before it
// can render, and where the auth stack starts. Pure, so the routing rules are
// testable without navigation or storage.

export type AuthEntryRoute = 'Welcome' | 'Login';

// Signed-in users never depend on the intro flag; signed-out users wait for it,
// so neither the intro nor the login flashes up before the answer is known.
export function isEntryLoading(
  authLoading: boolean,
  hasSession:  boolean,
  introSeen:   boolean | null,
): boolean {
  if (authLoading) return true;
  return !hasSession && introSeen === null;
}

// The welcome intro is shown until it was finished, skipped or left via
// "Anmelden" once; after that (also after a logout) the stack opens on Login.
export function authInitialRoute(introSeen: boolean): AuthEntryRoute {
  return introSeen ? 'Login' : 'Welcome';
}

// Stored value -> flag. Anything but the exact marker counts as unseen.
export function parseIntroSeen(stored: string | null): boolean {
  return stored === INTRO_SEEN_VALUE;
}

export const INTRO_SEEN_VALUE = 'seen';
