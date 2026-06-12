// Per-user cache key for the onboarding-completed flag.
// Lets returning users skip the network round-trip that would otherwise gate
// the entire app behind a spinner on cold start (see RootNavigator).
export function onboardingCacheKey(userId: string): string {
  return `onboarding_completed:${userId}`;
}
