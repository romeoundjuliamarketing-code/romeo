import { useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import i18n from '../i18n';

// Photo picking with the existing square crop, immediate local preview,
// upload state and error handling (moved from the former AvatarPicker).
export function useAvatarUpload(onUpload: (localUri: string) => Promise<{ error: string | null }>) {
  const [uploading, setUploading] = useState(false);
  const [localUri, setLocalUri] = useState<string | null>(null);

  async function pick(): Promise<void> {
    if (uploading) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          i18n.t('home.hooks.photoAccessTitle'),
          i18n.t('home.hooks.photoAccessBody'),
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || result.assets.length === 0) return;

      const uri = result.assets[0].uri;
      setLocalUri(uri); // show immediately from device storage
      setUploading(true);
      const { error } = await onUpload(uri);
      setUploading(false);
      if (error !== null) {
        setLocalUri(null);
        Alert.alert(i18n.t('home.hooks.uploadFailed'), error);
      }
    } catch (e) {
      setUploading(false);
      setLocalUri(null);
      Alert.alert('Fehler', e instanceof Error ? e.message : 'Unbekannter Fehler.');
    }
  }

  return { pick, uploading, localUri };
}
