import type de from '../de/paywall';
import type { LocaleShape } from '../types';

const paywall: LocaleShape<typeof de> = {
  plans: {
    creator: { title: 'Creator', subtitle: 'Create your own sparring sessions' },
    cards: { title: 'Cards', subtitle: 'Card game for kickboxing / K1' },
    bundle: { title: 'Creator + Cards', subtitle: 'Both in one subscription' },
  },
  planLabel: {
    bundle: 'Creator + Cards',
    creator: 'Creator',
    cards: 'Cards',
    none: 'No active subscription',
  },
  planName: {
    creator: 'Creator subscription',
    cards: 'Cards subscription',
    bundle: 'bundle',
  },
  switchNotice: {
    fromBundle: 'The {{target}} replaces your bundle. {{lost}} then no longer included.',
    lostCreate: 'Creating sparring sessions is',
    lostCards: 'The card game is',
    other: 'The {{target}} replaces your {{current}}. For both, choose the bundle.',
  },
  switchTitle: 'Switch subscription?',
  switchConfirm: 'Switch',
  purchaseFailed: 'Purchase failed',
  tryAgain: 'Please try again.',
  restore: {
    successTitle: 'Purchases restored',
    successMessage: 'Your access is active again.',
    noneTitle: 'No purchases found',
    noneMessage: 'No active subscription was found for this account.',
    failedTitle: 'Restore failed',
  },
  cta: {
    active: 'Active subscription',
    continue: 'Continue – {{price}} / month',
    unavailable: 'Currently unavailable',
  },
  savings: 'You save {{amount}}',
  hero: {
    close: 'Close',
    creator: {
      title: 'Create your own sparring sessions',
      benefit1: 'Create sparring sessions and show them on the map',
      benefit2: 'Joining stays free for everyone',
    },
    cards: {
      title: 'The complete card game',
      benefit1: 'All available cards for kickboxing / K1',
      benefit2: 'Draw cards and put them to use in sparring',
    },
    bundle: {
      title: 'Creator + Cards',
      benefit1: 'Create sparring sessions and show them on the map',
      benefit2: 'Complete card game for kickboxing / K1',
    },
  },
  option: {
    active: 'Active',
    unavailable: 'Not available',
    perMonth: 'per month',
  },
  footer: {
    legalNote: 'The subscription renews automatically at the price and period shown unless it is cancelled in time via the subscription settings of your app store.',
    restore: 'Restore purchases',
    privacy: 'Privacy',
    terms: 'Terms of use',
  },
};

export default paywall;
