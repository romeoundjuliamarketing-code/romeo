import type de from '../de/map';
import type { LocaleShape } from '../types';

const map: LocaleShape<typeof de> = {
  bottom: {
    chatsUnread: 'Sparring chats, {{count}} unread',
    chats: 'Sparring chats',
  },
  mode: { sparrings: 'Sparring', events: 'Events' },
  timeFilter: { today: 'Today', week: '7 days', later: 'Later' },
  header: { title: 'Find your sparring' },
  preview: {
    close: 'Close preview',
    with: 'With {{name}}',
    viewA11y: 'View {{title}}',
    view: 'View',
    widen: 'Widen search area',
    closeNotice: 'Close notice',
  },
  search: {
    viewMap: 'Map',
    viewList: 'List',
    chooseLocation: 'Choose location',
    areaA11y: 'Search area: {{location}}, {{radius}}. Change',
    everywhereLower: 'everywhere',
    kilometers: '{{count}} kilometres',
    locationA11y: 'Search location: {{location}}. Change',
    location: 'Location',
    change: 'Change',
    radius: 'Radius',
    searchEverywhere: 'Search everywhere',
    radiusA11y: 'Radius {{count}} kilometres',
  },
  list: {
    pickPlace: 'Choose a place to see sparring sessions in your area.',
    loadFailed: 'Sparring sessions could not be loaded right now.',
    noneUpcoming: 'No upcoming sparring sessions right now',
    noneInRadius: 'No sparring sessions within {{radius}} km right now',
    offer: 'Offer a sparring session',
    footnote: 'Distance as the crow flies',
    fullWaitlist: 'Full · Waitlist',
    onWaitlist: 'On the waitlist',
    rowA11y: '{{discipline}}, {{date}}, {{place}}, {{distance}} away, {{slots}}',
  },
  picker: {
    locating: 'Finding your location …',
    title: 'Choose place on map',
    hint: 'Tap the map to mark a place',
    confirm: 'Use this place',
  },
};

export default map;
