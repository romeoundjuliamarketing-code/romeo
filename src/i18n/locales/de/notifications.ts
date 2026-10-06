const notifications = {
  title: 'Benachrichtigungen',
  empty: 'Keine Benachrichtigungen',
  time: {
    justNow: 'Gerade eben',
    minutesAgo: 'Vor {{count}} Min.',
    hoursAgo: 'Vor {{count}} Std.',
    daysAgo_one: 'Vor {{count}} Tag',
    daysAgo_other: 'Vor {{count}} Tagen',
  },
} as const;

export default notifications;
