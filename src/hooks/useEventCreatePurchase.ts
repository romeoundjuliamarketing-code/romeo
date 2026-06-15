import { useState } from 'react';
import { Alert } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { supabase } from '../lib/supabase';

export interface UseEventCreatePurchase {
  purchase:       (eventId: string) => Promise<void>;
  loadPackage:    () => Promise<void>;
  eventPackage:   PurchasesPackage | null;
  purchasing:     boolean;
  activating:     boolean;
  packageLoading: boolean;
}

const EVENT_OFFERING_ID = 'event-create';
const POLL_RETRIES      = 5;
const POLL_DELAY_MS     = 2000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useEventCreatePurchase(): UseEventCreatePurchase {
  const [eventPackage,   setEventPackage]   = useState<PurchasesPackage | null>(null);
  const [purchasing,     setPurchasing]     = useState(false);
  const [activating,     setActivating]     = useState(false);
  const [packageLoading, setPackageLoading] = useState(false);

  async function loadPackage(): Promise<void> {
    setPackageLoading(true);
    try {
      const offerings = await Purchases.getOfferings();
      const offering  = offerings.all[EVENT_OFFERING_ID] ?? offerings.current;
      if (offering !== null && offering !== undefined) {
        const pkg = offering.availablePackages[0] ?? null;
        setEventPackage(pkg);
      }
    } catch (err) {
      console.warn('[useEventCreatePurchase] loadPackage error:', err);
    } finally {
      setPackageLoading(false);
    }
  }

  async function purchase(eventId: string): Promise<void> {
    if (eventPackage === null) {
      Alert.alert('Fehler', 'Event-Erstellung ist gerade nicht verfügbar. Bitte versuche es später.');
      return;
    }

    setPurchasing(true);
    try {
      // Ensure the subscriber exists on the RC backend before syncing attributes.
      await Purchases.getCustomerInfo();
      // Set RC attribute BEFORE purchase so the webhook payload carries event_id.
      await Purchases.setAttributes({ event_id: eventId });
      // 500ms delay ensures RC syncs the attribute before the purchase is processed.
      await delay(500);

      await Purchases.purchasePackage(eventPackage);
    } catch (err: unknown) {
      const isCancelled =
        typeof err === 'object' &&
        err !== null &&
        'userCancelled' in err &&
        (err as { userCancelled: boolean }).userCancelled === true;

      if (!isCancelled) {
        const message = err instanceof Error ? err.message : 'Kauf fehlgeschlagen.';
        Alert.alert('Fehler', message);
      }
      setPurchasing(false);
      return;
    }

    setPurchasing(false);
    setActivating(true);

    // Poll until the webhook activates the event (RC webhook delivery: 5–15s).
    let activated = false;
    for (let i = 0; i < POLL_RETRIES; i++) {
      await delay(POLL_DELAY_MS);
      const { data } = await supabase
        .from('events')
        .select('is_active')
        .eq('id', eventId)
        .maybeSingle();
      if (data?.is_active === true) {
        activated = true;
        break;
      }
    }

    setActivating(false);

    if (!activated) {
      Alert.alert(
        'Event wird aktiviert',
        'Dein Event wird in Kürze aktiviert. Bitte schließe die Ansicht kurz und öffne sie erneut.',
      );
    }
  }

  return {
    purchase,
    loadPackage,
    eventPackage,
    purchasing,
    activating,
    packageLoading,
  };
}
