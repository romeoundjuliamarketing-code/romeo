// Price formatting utilities for membership plan display
import i18n from '../i18n';
import { parseLanguage } from './language';

/**
 * Converts a price in cents to a German-formatted euro string.
 * Example: 2900 → "29,00 €", 4999 → "49,99 €"
 */
export function formatPrice(cents: number): string {
  const euros = Math.floor(cents / 100);
  const remainder = cents % 100;
  const centsStr = remainder.toString().padStart(2, '0');
  // Manual formatting (no Intl): German "29,00 €", English "€29.00".
  if ((parseLanguage(i18n.language) ?? 'de') === 'en') return `€${euros}.${centsStr}`;
  return `${euros},${centsStr} €`;
}

/**
 * Returns a German label for a billing interval.
 */
export function billingIntervalLabel(interval: 'monthly' | 'yearly'): string {
  return interval === 'yearly' ? i18n.t('home.price.yearly') : i18n.t('home.price.monthly');
}
