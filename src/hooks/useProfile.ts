import { useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { decode as base64Decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import { getCached, setCached } from '../lib/queryCache';
import type { Profile, ProfileUpdate } from '../types/database.types';

type ProfileSnapshot = { profile: Profile | null };

interface UseProfileResult {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  updateProfile: (updates: ProfileUpdate) => Promise<void>;
  uploadAvatar: (localUri: string) => Promise<{ error: string | null }>;
}

export function useProfile(refetchTrigger = 0): UseProfileResult {
  const { user } = useAuth();
  const cacheKey = user ? `useProfile:${user.id}` : null;
  const cached = cacheKey ? getCached<ProfileSnapshot>(cacheKey) : undefined;
  const [profile, setProfile] = useState<Profile | null>(() => cached?.profile ?? null);
  const [loading, setLoading] = useState(cached === undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user === null) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setError(null);

    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data, error: err }) => {
        if (err !== null) {
          reportNetworkError(err);
          setError(err.message);
        } else {
          reportNetworkSuccess();
          setProfile(data);
          if (cacheKey) setCached<ProfileSnapshot>(cacheKey, { profile: data });
        }
        setLoading(false);
      });
  }, [user, refetchTrigger]);

  async function updateProfile(updates: ProfileUpdate): Promise<void> {
    if (user === null) return;

    const { data, error: err } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (err !== null) {
      setError(err.message);
      return;
    }
    setProfile(data);
    // Keep the shared cache in sync so other useProfile consumers
    // (ProfilScreen, HomeScreen, ...) don't read stale data on re-focus.
    if (cacheKey) setCached<ProfileSnapshot>(cacheKey, { profile: data });
  }

  async function uploadAvatar(localUri: string): Promise<{ error: string | null }> {
    if (user === null) return { error: 'Nicht angemeldet.' };

    try {
      // Read file as base64 — fetch(localUri).blob() returns empty in React Native
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const arrayBuffer = base64Decode(base64);

      // Normalise the extension; iOS edited images sometimes carry no usable suffix
      const rawExt = localUri.split('.').pop()?.split('?')[0].toLowerCase() ?? '';
      const ext = rawExt === 'png' || rawExt === 'webp' ? rawExt : 'jpg';
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, arrayBuffer, { upsert: true, contentType: mime });

      if (uploadError !== null) {
        setError(uploadError.message);
        return { error: uploadError.message };
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      // Cache-buster so the Image component reloads after re-upload
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)
        .select()
        .single();

      if (updateError !== null) {
        setError(updateError.message);
        return { error: updateError.message };
      }
      setProfile(data);
      if (cacheKey) setCached<ProfileSnapshot>(cacheKey, { profile: data });
      return { error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler beim Hochladen.';
      setError(msg);
      return { error: msg };
    }
  }

  return { profile, loading, error, updateProfile, uploadAvatar };
}
