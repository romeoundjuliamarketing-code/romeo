import type de from '../de/chat';
import type { LocaleShape } from '../types';

const chat: LocaleShape<typeof de> = {
  overview: {
    title: 'Chats',
    subtitle: 'This is where training gets arranged.',
    archive: 'Past meetups · {{count}}',
    emptyText: 'Your next training starts with an arrangement.',
    findSparring: 'Find sparring',
    nextUp: 'Up next',
    jumpToNew: 'Jump to new messages',
    newMessages: 'New messages',
    openHint: 'Opens the chat',
    loadFailed: 'Your chats could not be loaded.',
    maybeStale: 'The list may not be up to date.',
    archiveA11y: 'Past meetups, {{count}}',
    archiveA11yUnread: 'Past meetups, {{count}}, {{unread}} unread',
    unreadCount: '{{count}} unread',
  },
  system: {
    expired: '{{name}} is no longer in',
    someone: 'Someone',
    joined: '{{name}} signed up',
    cancelled: '{{name}} cancelled',
  },
  unknownSender: 'Unknown',
  composerPlaceholder: 'Message...',
  photoPermission: {
    title: 'Permission needed',
    message: 'Please allow access to your photos.',
  },
  summary: {
    soldOut: 'Fully booked',
    slotsLeft_one: '{{count}} spot left',
    slotsLeft_other: '{{count}} spots left',
    badge: 'Your sparring',
    signedUp: '{{signupCount}} of {{maxSlots}} signed up',
    notes: 'Notes',
    access: 'Gym access',
    noMessages: 'No messages yet. Sort out the last details for training here.',
  },
  participants: {
    nobody: 'Nobody has signed up yet',
    signOut: 'Sign out',
    soldOut: 'Fully booked',
    join: "I'm in",
  },
  countdown: {
    over: 'Already over',
    today: 'Today · {{time}}',
    tomorrow: 'Tomorrow · {{time}}',
    inDays: 'In {{days}} days · {{time}}',
  },
  screen: {
    noMessages: 'No messages yet.',
    eventOver: 'This event has taken place.',
    sparringOver: 'This sparring session has taken place.',
    hint: 'Note',
    messageBlocked: 'Message blocked',
    settingsTitle: 'Chat settings',
    allowMedia: 'Allow images and videos',
    imageUploadFailed: 'Image upload failed.',
  },
  dateSeparator: {
    today: 'Today',
    yesterday: 'Yesterday',
  },
  list: {
    yesterday: 'Yesterday',
    over: 'Over',
    today: 'Today · {{time}}',
    tomorrow: 'Tomorrow · {{time}}',
    whenToday: 'Today, {{time}}',
    whenTomorrow: 'Tomorrow, {{time}}',
    you: 'You',
    emptySparring: 'Sort out the last details for training here.',
    emptyEvent: 'Sort out the last details for your meetup here.',
  },
  legacyList: {
    noMessages: 'No messages yet',
  },
};

export default chat;
