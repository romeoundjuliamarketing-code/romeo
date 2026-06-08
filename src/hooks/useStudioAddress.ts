import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { geocodeAddress } from '../utils/geocoding';

export function useStudioAddress(studioId: string): {
  address: string | null;
  lat: number | null;
  lng: number | null;
  loading: boolean;
  updateAddress: (newAddress: string) => Promise<{ error: string | null }>;
} {
  const [address, setAddress] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('studios')
        .select('address, lat, lng')
        .eq('id', studioId)
        .single();
      if (data !== null) {
        setAddress(data.address);
        setLat(data.lat);
        setLng(data.lng);
      }
    })();
  }, [studioId]);

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
    }
    return { error: error?.message ?? null };
  }, [studioId]);

  return { address, lat, lng, loading, updateAddress };
}
