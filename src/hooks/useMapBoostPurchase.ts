import { useState } from 'react';
import { Alert } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { supabase } from '../lib/supabase';

export interface BoostStatus {
  isActive:      boolean;
  expiresAt:     string | null;
  daysRemaining: number | null;
}

export interface UseMapBoostPurchase {
  purchase:      (sparringId: string) => Promise<void>;
  loadStatus:    (sparringId: string) => Promise<void>;
  loadPackage:   () => Promise<void>;
  boostStatus:   BoostStatus;
  boostPackage:  PurchasesPackage | null;
  purchasing:    boolean;
  activating:    boolean;
  statusLoading: boolean;
  packageLoading: boolean;
}

const DEFAULT_STATUS: BoostStatus = {
  isActive:      false,
  expiresAt:     null,
  daysRemaining: null,
};

const BOOST_OFFERING_ID = 'map_boost';
const POLL_RETRIES      = 5;
const POLL_DELAY_MS     = 2000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useMapBoostPurchase(): UseMapBoostPurchase {
  const [boostStatus,   setBoostStatus]   = useState<BoostStatus>(DEFAULT_STATUS);
  const [boostPackage,  setBoostPackage]  = useState<PurchasesPackage | null>(null);
  const [purchasing,    setPurchasing]    = useState(false);
  const [activating,    setActivating]    = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [packageLoading, setPackageLoading] = useState(false);

  async function loadPackage(): Promise<void> {
    setPackageLoading(true);
    try {
      const offerings = await Purchases.getOfferings();
      const offering  = offerings.all[BOOST_OFFERING_ID] ?? offerings.current;
      if (offering !== null && offering !== undefined) {
        const pkg = offering.availablePackages[0] ?? null;
        setBoostPackage(pkg);
      }
    } catch (err) {
      console.warn('[useMapBoostPurchase] loadPackage error:', err);
    } finally {
      setPackageLoading(false);
    }
  }

  async function loadStatus(sparringId: string): Promise<void> {
    setStatusLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_my_boost_status', {
        p_sparring_id: sparringId,
      });
      if (error !== null || data === null) {
        setBoostStatus(DEFAULT_STATUS);
        return;
      }
      // RPC returns a single JSON row
      const row = Array.isArray(data) ? data[0] : data;
      if (row === undefined || row === null) {
        setBoostStatus(DEFAULT_STATUS);
        return;
      }
      setBoostStatus({
        isActive:      Boolean(row.is_active),
        expiresAt:     typeof row.expires_at === 'string' ? row.expires_at : null,
        daysRemaining: typeof row.days_remaining === 'number' ? row.days_remaining : null,
      });
    } catch (err) {
      console.warn('[useMapBoostPurchase] loadStatus error:', err);
      setBoostStatus(DEFAULT_STATUS);
    } finally {
      setStatusLoading(false);
    }
  }

  async function purchase(sparringId: string): Promise<void> {
    if (boostPackage === null) {
      Alert.alert('Fehler', 'Karten-Boost ist gerade nicht verfügbar. Bitte versuche es später.');
      return;
    }

    if (boostStatus.isActive) {
      const until = boostStatus.expiresAt !== null
        ? new Date(boostStatus.expiresAt).toLocaleDateString('de-DE')
        : '';
      Alert.alert('Bereits aktiv', `Dein Karten-Boost ist bereits aktiv bis ${until}.`);
      return;
    }

    setPurchasing(true);
    try {
      // Set RC attribute BEFORE purchase so the webhook payload carries sparring_id.
      await Purchases.setAttributes({ sparring_id: sparringId });
      // 500ms delay ensures RC syncs the attribute before the purchase is processed.
      await delay(500);

      await Purchases.purchasePackage(boostPackage);
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

    // Poll until the webhook activates the boost (RC webhook delivery: 5–15s).
    let activated = false;
    for (let i = 0; i < POLL_RETRIES; i++) {
      await delay(POLL_DELAY_MS);
      await loadStatus(sparringId);
      if (boostStatus.isActive) {
        activated = true;
        break;
      }
      // Re-read state — loadStatus updates the state asynchronously; check via RPC directly.
      const { data } = await supabase.rpc('get_my_boost_status', { p_sparring_id: sparringId });
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.is_active === true) {
        setBoostStatus({
          isActive:      true,
          expiresAt:     row.expires_at ?? null,
          daysRemaining: row.days_remaining ?? null,
        });
        activated = true;
        break;
      }
    }

    setActivating(false);

    if (!activated) {
      Alert.alert(
        'Boost wird aktiviert',
        'Dein Karten-Boost wird in Kürze aktiviert. Bitte schließe die Ansicht kurz und öffne sie erneut.',
      );
    }
  }

  return {
    purchase,
    loadStatus,
    loadPackage,
    boostStatus,
    boostPackage,
    purchasing,
    activating,
    statusLoading,
    packageLoading,
  };
}
