import * as FileSystem from 'expo-file-system/legacy';
import { decode as base64Decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

// Upload a local image URI to Supabase Storage using the FileSystem + base64
// approach. Never use fetch().blob() — it does not work in the Expo context.
export async function uploadImage(
  localUri: string,
  bucket: string,
  path: string,
): Promise<{ url: string | null; error: string | null }> {
  const rawExt = localUri.split('.').pop()?.split('?')[0].toLowerCase() ?? '';
  const ext = rawExt === 'png' ? 'png' : 'jpg';
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  const fullPath = `${path}.${ext}`;

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const arrayBuffer = base64Decode(base64);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(fullPath, arrayBuffer, { upsert: true, contentType: mime });

  if (error !== null) return { url: null, error: error.message };

  const { data } = supabase.storage.from(bucket).getPublicUrl(fullPath);
  return { url: `${data.publicUrl}?t=${Date.now()}`, error: null };
}
