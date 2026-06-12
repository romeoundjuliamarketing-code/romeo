import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';
import { geocodeAddress } from '../utils/geocoding';

type StudioAddressSnapshot = { address: string | null; lat: number | null; lng: number | null };

export function useStudioAddress(studioId: string): {
  address: string | null;
  lat: number | null;
  lng: number | null;
  loading: boolean;
  updateAddress: (newAddress: string) => Promise<{ error: string | null }>;
} {
  const cacheKey = studioId !== '' ? `useStudioAddress:${studioId}` : null;
  const cached = cacheKey ? getCached<StudioAddressSnapshot>(cacheKey) : undefined;
  const [address, setAddress] = useState<string | null>(() => cached?.address ?? null);
  const [lat, setLat] = useState<number | null>(() => cached?.lat ?? null);
  const [lng, setLng] = useState<number | null>(() => cached?.lng ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (studioId === '') return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('studios')
        .select('address, lat, lng')
        .eq('id', studioId)
        .single();
      if (cancelled || data === null) return;
      setAddress(data.address);
      setLat(data.lat);
      setLng(data.lng);
      if (cacheKey) setCached<StudioAddressSnapshot>(cacheKey, { address: data.address, lat: data.lat, lng: data.lng });
    })();
    return () => {
      cancelled = true;
    };
  }, [studioId, cacheKey]);

  const updateAddress = useCallback(async (newAddress: string): Promise<{ error: string | null }> => {
    setLoading(true);
    const trimmed = newAddress.trim();
    const coords = await geocodeAddress(trimmed);
    const { error } = await supabase
      .from('studios')
      .update({
        address: trimmed,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      })
      .eq('id', studioId);
    setLoading(false);
    if (error === null) {
      setAddress(trimmed);
      setLat(coords?.lat ?? null);
      setLng(coords?.lng ?? null);
      if (cacheKey) setCached<StudioAddressSnapshot>(cacheKey, { address: trimmed, lat: coords?.lat ?? null, lng: coords?.lng ?? null });
    }
    return { error: error?.message ?? null };
  }, [studioId, cacheKey]);

  return { address, lat, lng, loading, updateAddress };
}
