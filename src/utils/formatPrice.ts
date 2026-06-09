// Price formatting utilities for membership plan display

/**
 * Converts a price in cents to a German-formatted euro string.
 * Example: 2900 → "29,00 €", 4999 → "49,99 €"
 */
export function formatPrice(cents: number): string {
  const euros = Math.floor(cents / 100);
  const remainder = cents % 100;
  const centsStr = remainder.toString().padStart(2, '0');
  return `${euros},${centsStr} €`;
}

/**
 * Returns a German label for a billing interval.
 */
export function billingIntervalLabel(interval: 'monthly' | 'yearly'): string {
  return interval === 'yearly' ? 'jährlich' : 'monatlich';
}
