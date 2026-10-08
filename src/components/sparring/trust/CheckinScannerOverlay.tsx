import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../theme/colors';
import { useLanguage } from '../../../i18n/language';
import { formatDate } from '../../../utils/formatDate';
import { useSparringTrustActions } from '../../../hooks/useSparringTrustActions';
import { openLocationSettings } from '../../../hooks/useDeviceFix';
import { parseCheckinQr, type TrustAction } from '../../../utils/sparringTrust';
import TrustNoticeCard, { type TrustProblem } from './TrustNoticeCard';

const CAMERA_HEIGHT = 320;

// Participant scanner, shown inside the open detail modal (no second Modal).
// Success is only shown after the server confirmed the check-in.
export default function CheckinScannerOverlay({ sparringId, onCheckedIn, onClose }: {
  sparringId: string;
  onCheckedIn: () => void;
  onClose: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { checkIn } = useSparringTrustActions();
  const [permission, requestPermission] = useCameraPermissions();
  const [problem, setProblem] = useState<TrustProblem | null>(null);
  const [notCode, setNotCode] = useState(false);
  const [checking, setChecking] = useState(false);
  const [doneAt, setDoneAt] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  async function run(token: string): Promise<void> {
    setChecking(true);
    setProblem(null);
    const out = await checkIn(sparringId, token);
    setChecking(false);
    busyRef.current = false;
    if (out.kind === 'ok') {
      setDoneAt(out.data.checked_in_at);
      onCheckedIn();
    } else if (out.kind === 'refused') {
      setProblem({ kind: 'refused', refusal: out.refusal });
    } else if (out.kind === 'location') {
      setProblem({ kind: 'location', error: out.error });
    } else {
      setProblem({ kind: 'network' });
    }
  }

  function handleScan({ data }: { data: string }): void {
    if (busyRef.current) return;
    const token = parseCheckinQr(data.trim());
    if (token === null) {
      setNotCode(true);
      return;
    }
    busyRef.current = true;
    setNotCode(false);
    tokenRef.current = token;
    void run(token);
  }

  function onAction(action: TrustAction): void {
    if (action === 'settings') {
      openLocationSettings();
    } else if (action === 'retry') {
      // A new scan is needed after an expired / wrong code; otherwise re-send.
      const reason = problem?.kind === 'refused' ? problem.refusal.reason : null;
      const needsNewScan = reason === 'token_expired' || reason === 'token_invalid' || reason === 'token_wrong_sparring';
      if (!needsNewScan && tokenRef.current !== null) {
        busyRef.current = true;
        void run(tokenRef.current);
      } else {
        tokenRef.current = null;
        setProblem(null);
      }
    }
  }

  let body: React.ReactElement;
  if (doneAt !== null) {
    body = (
      <>
        <Ionicons name="checkmark-circle-outline" size={48} color={colors.text} style={styles.center} />
        <Text style={styles.title}>{t('sparringTrust.checkin.checkedIn')}</Text>
        <Text style={styles.hint}>{t('sparringTrust.checkin.success')}</Text>
        <Text style={styles.hint}>{t('sparringTrust.checkin.checkedInAt', { time: formatDate(doneAt, 'time', language) })}</Text>
        <TouchableOpacity style={styles.primary} onPress={onClose} accessibilityRole="button">
          <Text style={styles.primaryText}>{t('sparringTrust.actions.close')}</Text>
        </TouchableOpacity>
      </>
    );
  } else if (permission === null) {
    body = <Text style={styles.hint}>{t('profile.scanner.preparing')}</Text>;
  } else if (!permission.granted) {
    const canAsk = permission.canAskAgain;
    body = (
      <>
        <Ionicons name="camera-outline" size={48} color={colors.textSecondary} style={styles.center} />
        <Text style={styles.hint}>{t('sparringTrust.checkin.cameraDenied')}</Text>
        <TouchableOpacity
          style={styles.primary}
          onPress={() => { if (canAsk) void requestPermission(); else void Linking.openSettings(); }}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>{canAsk ? t('sparringTrust.checkin.cameraAllow') : t('sparringTrust.actions.settings')}</Text>
        </TouchableOpacity>
      </>
    );
  } else if (problem !== null) {
    body = <TrustNoticeCard problem={problem} onAction={onAction} />;
  } else {
    body = (
      <>
        <View style={styles.camera}>
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={checking ? undefined : handleScan}
          />
        </View>
        <Text style={styles.hint}>{checking ? t('sparringTrust.checkin.checking') : t('sparringTrust.checkin.scannerHint')}</Text>
        {notCode && <Text style={styles.error} accessibilityRole="alert">{t('sparringTrust.checkin.notACheckinCode')}</Text>}
      </>
    );
  }

  return (
    <View style={styles.wrap}>
      {doneAt === null && <Text style={styles.title} accessibilityRole="header">{t('sparringTrust.checkin.scannerTitle')}</Text>}
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 24, gap: 16 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  hint: { fontSize: 15, lineHeight: 22, color: colors.text, textAlign: 'center' },
  error: { fontSize: 14, color: colors.deleteRed, textAlign: 'center' },
  center: { alignSelf: 'center' },
  camera: { height: CAMERA_HEIGHT, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.dark },
  primary: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  primaryText: { fontSize: 16, fontWeight: '700', color: colors.card },
});
