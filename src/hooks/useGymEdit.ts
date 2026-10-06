import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { uploadImage } from '../lib/uploadImage';
import { cacheGym, toGym } from './useGyms';
import type { Gym } from './useGyms';

export interface GymDraft {
  name:        string;
  city:        string;
  address:     string;
  disciplines: string[];
  description: string;
  websiteUrl:  string | null;
  /** Local picks; null keeps the stored image. */
  coverUri:    string | null;
  logoUri:     string | null;
}

// Coordinates for a changed address (OpenStreetMap Nominatim, as before).
// Unknown → null: the route then falls back to the address text.
async function geocode(address: string, city: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = encodeURIComponent(`${address}, ${city}`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
      headers: { 'User-Agent': 'Sparr-App/1.0 (kontakt@sparr.app)' },
    });
    const json = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (json.length === 0) return null;
    const lat = parseFloat(json[0].lat);
    const lng = parseFloat(json[0].lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

// Saves the reduced gym profile. Only the operator may write the row: the
// existing RLS policy (owner_user_id = auth.uid()) decides on the server; a
// refused update affects zero rows and is reported, never silently ignored.
export function useGymEdit(gym: Gym | null): {
  saving: boolean;
  save:   (draft: GymDraft) => Promise<{ error: string | null }>;
} {
  const [saving, setSaving] = useState(false);

  async function save(draft: GymDraft): Promise<{ error: string | null }> {
    if (gym === null) return { error: 'Das Gym ist nicht geladen.' };
    setSaving(true);
    try {
      const address = draft.address.trim();
      const updates: Record<string, unknown> = {
        name:        draft.name.trim(),
        city:        draft.city.trim(),
        address:     address.length > 0 ? address : null,
        disciplines: draft.disciplines,
        description: draft.description.trim().length > 0 ? draft.description.trim() : null,
      };
      // Only sent when changed: older databases without the column keep working.
      if (draft.websiteUrl !== gym.website_url) updates.website_url = draft.websiteUrl;

      const addressChanged = address !== (gym.address ?? '').trim() || draft.city.trim() !== gym.city;
      if (addressChanged) {
        const point = address.length > 0 ? await geocode(address, draft.city.trim()) : null;
        updates.lat = point?.lat ?? null;
        updates.lng = point?.lng ?? null;
      }

      if (draft.coverUri !== null) {
        const { url, error } = await uploadImage(draft.coverUri, 'studio-assets', `${gym.id}/banner`);
        if (error !== null) return { error: 'Das Cover konnte nicht hochgeladen werden.' };
        updates.banner_url = url;
      }
      if (draft.logoUri !== null) {
        const { url, error } = await uploadImage(draft.logoUri, 'studio-assets', `${gym.id}/avatar`);
        if (error !== null) return { error: 'Das Logo konnte nicht hochgeladen werden.' };
        updates.avatar_url = url;
      }

      const { data, error } = await supabase.from('studios').update(updates).eq('id', gym.id).select('*');
      if (error !== null) return { error: 'Die Änderungen konnten nicht gespeichert werden. Bitte versuche es erneut.' };
      const row = (data ?? [])[0];
      if (row === undefined) return { error: 'Du kannst dieses Gym nicht bearbeiten.' };
      cacheGym(toGym(row as Parameters<typeof toGym>[0]));
      return { error: null };
    } finally {
      setSaving(false);
    }
  }

  return { saving, save };
}
