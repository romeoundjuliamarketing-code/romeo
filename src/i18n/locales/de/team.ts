const team = {
  errors: {
    notSignedIn: 'Nicht angemeldet.',
  },
  invite: {
    invalid: 'Ungültiger oder abgelaufener Code.',
    locked: 'Zu viele Fehlversuche. Bitte versuche es in einer Stunde erneut.',
    noSubscription: 'Dieses Gym kann gerade keine Mitglieder per Code aufnehmen.',
  },
  requests: {
    title: 'Anfragen',
    empty: 'Keine offenen Anfragen.',
    unknown: 'Unbekannt',
    joinRequests: 'Beitrittsanfragen',
    wantsToJoin: 'Möchte dem Team beitreten',
    trial: 'Probetraining · {{date}}',
    dropInBookings: 'Drop-in-Buchungen',
    dropIn: 'Drop-in · {{date}}',
    membershipRequests: 'Mitgliedschaftsanfragen',
    cancellations: 'Kündigungen',
    cancellationRequested: 'Kündigung angefordert',
  },
} as const;

export default team;
