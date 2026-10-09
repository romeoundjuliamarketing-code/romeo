import type de from '../de/team';
import type { LocaleShape } from '../types';

const team: LocaleShape<typeof de> = {
  errors: {
    notSignedIn: 'Not signed in.',
  },
  invite: {
    invalid: 'Invalid or expired code.',
    locked: 'Too many failed attempts. Please try again in an hour.',
    noSubscription: "This gym can't accept members via code right now.",
  },
  requests: {
    title: 'Requests',
    empty: 'No open requests.',
    unknown: 'Unknown',
    joinRequests: 'Join requests',
    wantsToJoin: 'Wants to join the team',
    trial: 'Trial session · {{date}}',
    dropInBookings: 'Drop-in bookings',
    dropIn: 'Drop-in · {{date}}',
    membershipRequests: 'Membership requests',
    cancellations: 'Cancellations',
    cancellationRequested: 'Cancellation requested',
  },
};

export default team;
