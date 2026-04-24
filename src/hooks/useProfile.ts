import { useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { decode as base64Decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import type { Profile, ProfileUpdate } from '../types/database.types';

interface UseProfileResult {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  updateProfile: (updates: ProfileUpdate) => Promise<void>;
  uploadAvatar: (localUri: string) => Promise<void>;
}

export function useProfile(refetchTrigger = 0): UseProfileResult {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user === null) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
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
  }

  async function uploadAvatar(localUri: string): Promise<void> {
    if (user === null) return;

    // Read file as base64 — fetch(localUri).blob() returns empty in React Native
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const arrayBuffer = base64Decode(base64);

    const ext = localUri.split('.').pop()?.split('?')[0].toLowerCase() ?? 'jpg';
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, arrayBuffer, { upsert: true, contentType: mime });

    if (uploadError !== null) {
      setError(uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    // Cache-buster so the Image component reloads after re-upload
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await updateProfile({ avatar_url: publicUrl });
  }

  return { profile, loading, error, updateProfile, uploadAvatar };
}
