import type de from '../de/notifications';
import type { LocaleShape } from '../types';

const notifications: LocaleShape<typeof de> = {
  title: 'Notifications',
  empty: 'No notifications',
  time: {
    justNow: 'Just now',
    minutesAgo: '{{count}} min ago',
    hoursAgo: '{{count}} h ago',
    daysAgo_one: '{{count}} day ago',
    daysAgo_other: '{{count}} days ago',
  },
};

export default notifications;
