import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import ViewShot from 'react-native-view-shot';
import Share from 'react-native-share';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { buildSparringShareUrl } from '../../utils/sparringShare';

const COPIED_RESET_MS = 2000;

// Sharing one sparring: story image (captured from an off-screen
// SparringStoryCard behind `shotRef`) + link via the native share sheet, and
// copying the link for an Instagram link sticker. A cancelled share is silent;
// a failed capture falls back to sharing the link only.
export function useSparringShare(sparringId: string, title: string) {
  const { t } = useTranslation();
  const shotRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const url = buildSparringShareUrl(sparringId);
  const message = t('sparring.detailSheet.shareMessage', { title, url });

  useEffect(() => () => {
    if (copiedTimerRef.current !== null) clearTimeout(copiedTimerRef.current);
  }, []);

  async function shareImage(): Promise<void> {
    if (sharing) return;
    setSharing(true);
    try {
      let uri: string | undefined;
      try {
        uri = await shotRef.current?.capture?.();
      } catch {
        uri = undefined;
      }
      if (uri) {
        await Share.open({ url: uri, type: 'image/png', message, failOnCancel: false });
      } else {
        await Share.open({ message, failOnCancel: false });
      }
    } catch {
      Alert.alert(t('sparring.shareSheet.errorTitle'), t('sparring.shareSheet.errorMessage'));
    } finally {
      setSharing(false);
    }
  }

  async function copyLink(): Promise<void> {
    try {
      await Clipboard.setStringAsync(url);
      setCopied(true);
      if (copiedTimerRef.current !== null) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch {
      Alert.alert(t('sparring.shareSheet.errorTitle'), t('sparring.shareSheet.copyError'));
    }
  }

  return { shotRef, sharing, copied, shareImage, copyLink };
}
