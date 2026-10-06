import type de from '../de/team';
import type { LocaleShape } from '../types';

const team: LocaleShape<typeof de> = {
  errors: {
    notSignedIn: 'Not signed in.',
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
