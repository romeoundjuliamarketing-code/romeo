import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, AppState, Image, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../theme/colors';
import { SPARRING_TRUST } from '../../../data/sparringConfig';
import { useSparringTrustActions } from '../../../hooks/useSparringTrustActions';
import { useSparringCheckins } from '../../../hooks/useSparringReach';
import { openLocationSettings } from '../../../hooks/useDeviceFix';
import { checkinQrValue, type TrustAction } from '../../../utils/sparringTrust';
import TrustNoticeCard, { type TrustProblem } from './TrustNoticeCard';

const LIST_REFRESH_MS = 10000;

// Organizer QR: a short-lived token, renewed every qrRefreshS seconds while
// visible (each renewal measures the position again). Stops when closed
// (unmount) or while the app is in the background.
export default function CheckinQrOverlay({ sparringId }: {
  sparringId: string;
}): React.ReactElement {
  const { t } = useTranslation();
  const { startCheckinSession } = useSparringTrustActions();
  const [token, setToken] = useState<string | null>(null);
  const [problem, setProblem] = useState<TrustProblem | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [listTick, setListTick] = useState(0);
  const { entries } = useSparringCheckins(sparringId, listTick);
  const hadTokenRef = useRef(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (appActive) return;
    // Never keep a code on screen while the app is not in use.
    setToken(null);
  }, [appActive]);

  useEffect(() => {
    if (!appActive || problem !== null) return;
    let cancelled = false;
    async function run(): Promise<void> {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      const out = await startCheckinSession(sparringId, hadTokenRef.current);
      inFlightRef.current = false;
      if (cancelled) return;
      if (out.kind === 'ok') {
        hadTokenRef.current = true;
        setToken(out.data.token);
      } else {
        setToken(null);
        if (out.kind === 'refused') setProblem({ kind: 'refused', refusal: out.refusal });
        else if (out.kind === 'location') setProblem({ kind: 'location', error: out.error });
        else setProblem({ kind: 'network' });
      }
    }
    void run();
    const id = setInterval(() => { void run(); }, SPARRING_TRUST.qrRefreshS * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [appActive, problem, attempt, sparringId, startCheckinSession]);

  useEffect(() => {
    if (!appActive) return;
    const id = setInterval(() => setListTick((n) => n + 1), LIST_REFRESH_MS);
    return () => clearInterval(id);
  }, [appActive]);

  function onAction(action: TrustAction): void {
    if (action === 'settings') openLocationSettings();
    else if (action === 'retry') {
      hadTokenRef.current = false;
      setProblem(null);
      setAttempt((n) => n + 1);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title} accessibilityRole="header">{t('sparringTrust.checkin.heading')}</Text>
      {problem !== null ? (
        <TrustNoticeCard problem={problem} onAction={onAction} />
      ) : (
        <>
          <View style={styles.qrBox}>
            {token !== null ? (
              <QRCode value={checkinQrValue(token)} size={200} color={colors.brandInk} backgroundColor={colors.card} />
            ) : (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.accentBlue} />
                <Text style={styles.muted}>{t('sparringTrust.checkin.qrLoading')}</Text>
              </View>
            )}
          </View>
          <Text style={styles.hint}>{t('sparringTrust.checkin.qrHint')}</Text>
        </>
      )}
      <Text style={styles.count}>{t('sparringTrust.checkin.checkedInList', { count: entries.length })}</Text>
      {entries.length === 0 ? (
        <Text style={styles.muted}>{t('sparringTrust.checkin.nobodyYet')}</Text>
      ) : (
        entries.map((e) => (
          <View key={e.user_id} style={styles.entry}>
            {e.avatar_url !== null && <Image source={{ uri: e.avatar_url }} style={styles.avatar} />}
            <Text style={styles.entryName}>{e.name ?? ''}</Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 24, gap: 16 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  qrBox: {
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderRadius: 16,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: { alignItems: 'center', gap: 8 },
  hint: { fontSize: 15, lineHeight: 22, color: colors.text, textAlign: 'center' },
  muted: { fontSize: 14, color: colors.textMuted },
  count: { fontSize: 16, fontWeight: '700', color: colors.text },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.hairline },
  entryName: { fontSize: 15, color: colors.text },
});
