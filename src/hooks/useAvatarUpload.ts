import { useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import i18n from '../i18n';
import { detectFaces, isFaceDetectionAvailable } from '../../modules/sparr-face-detector';
import { evaluateFacePhoto, type FaceProblem } from '../utils/faceCheck';

export type PhotoSource = 'camera' | 'library';

const FACE_MESSAGE_KEY = {
  none: 'profile.photo.faceNone',
  multiple: 'profile.photo.faceMultiple',
  tooSmall: 'profile.photo.faceTooSmall',
  notFrontal: 'profile.photo.faceNotFrontal',
} as const satisfies Record<FaceProblem, string>;

// The profile photo must show the person's face (required for sparrings).
// Detection runs on the device. A technical failure (old build without the
// module, unreadable file, detector error) lets the photo through rather than
// locking the user out; only a clear "no usable face" result blocks.
async function faceProblemOf(uri: string): Promise<FaceProblem | null> {
  if (!isFaceDetectionAvailable()) return null;
  try {
    const verdict = evaluateFacePhoto(await detectFaces(uri));
    return verdict.ok ? null : verdict.problem;
  } catch {
    return null;
  }
}

// Photo from camera or gallery with the existing square crop, face check,
// immediate local preview, upload state and error handling.
export function useAvatarUpload(onUpload: (localUri: string) => Promise<{ error: string | null }>) {
  const [uploading, setUploading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [localUri, setLocalUri] = useState<string | null>(null);

  /** Resolves true once a checked photo was uploaded. */
  async function pickFrom(source: PhotoSource): Promise<boolean> {
    if (uploading || checking) return false;
    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        if (source === 'camera') {
          Alert.alert(i18n.t('profile.photo.cameraAccessTitle'), i18n.t('profile.photo.cameraAccessBody'));
        } else {
          Alert.alert(i18n.t('home.hooks.photoAccessTitle'), i18n.t('home.hooks.photoAccessBody'));
        }
        return false;
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      };
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ ...options, cameraType: ImagePicker.CameraType.front })
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || result.assets.length === 0) return false;

      const uri = result.assets[0].uri;
      setChecking(true);
      const problem = await faceProblemOf(uri);
      setChecking(false);
      if (problem !== null) {
        Alert.alert(i18n.t('profile.photo.faceTitle'), i18n.t(FACE_MESSAGE_KEY[problem]));
        return false;
      }

      setLocalUri(uri); // show immediately from device storage
      setUploading(true);
      const { error } = await onUpload(uri);
      setUploading(false);
      if (error !== null) {
        setLocalUri(null);
        Alert.alert(i18n.t('home.hooks.uploadFailed'), error);
        return false;
      }
      return true;
    } catch (e) {
      setChecking(false);
      setUploading(false);
      setLocalUri(null);
      Alert.alert(i18n.t('common.error'), e instanceof Error ? e.message : i18n.t('home.screen.unknownError'));
      return false;
    }
  }

  /** Asks for the source (camera or gallery), then picks. */
  async function pick(): Promise<void> {
    if (uploading || checking) return;
    Alert.alert(i18n.t('profile.photo.chooseTitle'), undefined, [
      { text: i18n.t('profile.photo.camera'), onPress: () => { void pickFrom('camera'); } },
      { text: i18n.t('profile.photo.library'), onPress: () => { void pickFrom('library'); } },
      { text: i18n.t('common.cancel'), style: 'cancel' },
    ]);
  }

  return { pick, pickFrom, uploading, checking, localUri };
}
