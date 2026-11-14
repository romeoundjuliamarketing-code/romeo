import type de from '../de/paywall';
import type { LocaleShape } from '../types';

const paywall: LocaleShape<typeof de> = {
  premium: { title: 'Sparr Premium Membership', subtitle: 'Create sparrings and play the card game' },
  planLabel: {
    premium: 'Sparr Premium',
    creator: 'Creator (legacy plan)',
    cards: 'Cards (legacy plan)',
    none: 'No active subscription',
  },
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
    trial: 'Try {{duration}} free',
    trialNote: 'Then {{price}} / month · cancel anytime',
  },
  trial: {
    day_one: '{{count}} day',
    day_other: '{{count}} days',
    month_one: '{{count}} month',
    month_other: '{{count}} months',
    year_one: '{{count}} year',
    year_other: '{{count}} years',
  },
  offer: {
    badge: 'Your offer',
    free: 'free',
    subtitle: 'Try Sparr Premium',
    cta: 'Start free',
    later: 'Later',
  },
  hero: {
    close: 'Close',
    premium: {
      title: 'Sparr Premium Membership',
      benefit1: 'Create your own sparrings and show them on the map',
      benefit2: 'Complete card game for kickboxing / K1',
    },
  },
  option: {
    active: 'Active',
    unavailable: 'Not available',
    perMonth: 'per month',
  },
  footer: {
    sparringsNote: 'If your subscription ends, your planned sparrings are cancelled and hidden. They come back with a new subscription.',
    legalNote: 'The subscription renews automatically at the price and period shown unless it is cancelled in time via the subscription settings of your app store.',
    restore: 'Restore purchases',
    privacy: 'Privacy',
    terms: 'Terms of use',
  },
};

export default paywall;
