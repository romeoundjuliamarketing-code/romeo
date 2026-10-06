import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Linking, Modal, Platform, Switch,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useEntitlement } from '../hooks/useEntitlement';
import { useStoreEntitlements } from '../hooks/useStoreEntitlements';
import { planLabel } from '../utils/subscriptionPlans';
import { supabase } from '../lib/supabase';
import { revokeAppleAuthorization } from '../lib/socialAuth';
import { requestPasswordReset } from '../lib/passwordReset';
import { PROXIMITY_RADIUS_KEY } from '../hooks/useProximitySparringNotifications';
import { useCaptcha } from '../hooks/useCaptcha';
import { useProfile } from '../hooks/useProfile';
import { useBlockedUsers } from '../hooks/useBlockedUsers';
import { useFocusRefetch } from '../hooks/useFocusRefetch';
import { restorePurchases } from '../lib/restorePurchases';
import TurnstileWidget from '../components/auth/TurnstileWidget';
import LanguageSection from '../components/settings/LanguageSection';
import { useTranslation } from 'react-i18next';

const RADIUS_OPTIONS = [10, 30, 50, 100] as const;
type RadiusOption = typeof RADIUS_OPTIONS[number];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }): React.ReactElement {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function SettingsRow({
  icon, label, value, onPress, danger = false,
}: {
  icon: string; label: string; value?: string; onPress: () => void; danger?: boolean;
}): React.ReactElement {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <MaterialCommunityIcons name={icon as 'logout'} size={20} color={danger ? colors.deleteRed : colors.text} />
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      {value !== undefined && <Text style={styles.rowValue}>{value}</Text>}
      {!danger && <MaterialCommunityIcons name="chevron-right" size={18} color={colors.inactive} />}
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen(): React.ReactElement {
  const navigation = useNavigation();
  const { user, signOut } = useAuth();
  const { entitlement } = useEntitlement();
  const { entitlements: storeEntitlements, refetch: refetchStore } = useStoreEntitlements();
  const { profile, updateProfile } = useProfile();
  const { blocked, refetch: refetchBlocked } = useBlockedUsers();
  const { t } = useTranslation();
  useFocusRefetch(refetchBlocked);
  // Optimistic value while the update is in flight; null = follow the profile.
  const [recordPublicDraft, setRecordPublicDraft] = useState<boolean | null>(null);
  const recordPublic = recordPublicDraft ?? profile?.show_fight_record ?? true;
  const [resetting, setResetting]             = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const { captchaKey, resetCaptcha }          = useCaptcha();
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [notifGranted, setNotifGranted]       = useState(false);
  const [radiusKm, setRadiusKm] = useState<RadiusOption>(30);

  // JS getDay(): 0=Sun … 6=Sat → 0=Mon … 6=Sun

  useEffect(() => {
    void Notifications.getPermissionsAsync().then(({ status }) => {
      setNotifGranted(status === 'granted');
    });
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(PROXIMITY_RADIUS_KEY).then((v) => {
      if (v !== null) setRadiusKm(parseInt(v, 10) as RadiusOption);
    });
  }, []);

  function openPasswordReset(): void {
    if (user?.email == null) return;
    resetCaptcha();
    setResetModalVisible(true);
  }

  function closePasswordReset(): void {
    setResetModalVisible(false);
    setResetting(false);
  }

  // Called once Turnstile returns a token; captcha is required because Supabase
  // gates resetPasswordForEmail when bot protection is enabled.
  async function handlePasswordReset(captchaToken: string): Promise<void> {
    if (user?.email == null) return;
    setResetting(true);
    const { error } = await requestPasswordReset(user.email, captchaToken);
    setResetting(false);
    setResetModalVisible(false);
    if (error !== null) {
      Alert.alert('Fehler', error.message);
    } else {
      Alert.alert('E-Mail gesendet', `Ein Link zum Zurücksetzen des Passworts wurde an ${user.email} geschickt.`);
    }
  }

  function handleDeleteAccount(): void {
    Alert.alert(
      'Account löschen',
      'Bist du sicher? Alle deine Daten werden permanent gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Account löschen',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDeletingAccount(true);
              // Sign in with Apple: revoke the Apple authorization first (App
              // Store 5.1.1(v)). If that fails, nothing is deleted yet.
              const { error: revokeError } = await revokeAppleAuthorization();
              if (revokeError !== null) {
                setDeletingAccount(false);
                Alert.alert('Fehler', 'Die Verbindung zu deiner Apple-ID konnte gerade nicht getrennt werden. Bitte versuche es gleich noch einmal.');
                return;
              }
              const { error } = await supabase.rpc('delete_my_account');
              if (error !== null) {
                setDeletingAccount(false);
                Alert.alert('Fehler', error.message);
                return;
              }
              await supabase.auth.signOut();
              setDeletingAccount(false);
            })();
          },
        },
      ],
    );
  }

  function handleLogout(): void {
    Alert.alert('Abmelden', 'Wirklich abmelden?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Abmelden', style: 'destructive', onPress: () => { void signOut(); } },
    ]);
  }

  async function handleRecordPublicChange(next: boolean): Promise<void> {
    setRecordPublicDraft(next);
    const { error } = await updateProfile({ show_fight_record: next });
    setRecordPublicDraft(null);
    if (error !== null) Alert.alert('Fehler', 'Die Einstellung konnte nicht gespeichert werden. Bitte versuche es erneut.');
  }

  async function handleRestorePurchases(): Promise<void> {
    try {
      if (await restorePurchases() === 'restored') {
        await refetchStore();
        Alert.alert('Käufe wiederhergestellt', 'Dein Zugang ist wieder aktiv.');
      } else {
        Alert.alert('Keine Käufe gefunden', 'Für dieses Konto wurde kein aktives Abo gefunden.');
      }
    } catch (error: unknown) {
      Alert.alert('Wiederherstellung fehlgeschlagen', error instanceof Error ? error.message : 'Bitte versuche es erneut.');
    }
  }

  function handleRadiusPick(): void {
    Alert.alert(
      'Umkreis für Sparring-Benachrichtigungen',
      'Benachrichtige mich wenn ein Sparring in diesem Umkreis stattfindet:',
      [
        ...RADIUS_OPTIONS.map((km) => ({
          text: `${km} km${km === radiusKm ? '  (aktiv)' : ''}`,
          onPress: () => {
            setRadiusKm(km);
            void AsyncStorage.setItem(PROXIMITY_RADIUS_KEY, String(km));
          },
        })),
        { text: 'Abbrechen', style: 'cancel' as const },
      ],
    );
  }

  const activePlanLabel = entitlement.tier === 'studio_suite'
    ? 'Studio Suite'
    : entitlement.tier === 'studio_visibility'
      ? 'Studio Sichtbarkeit'
      : planLabel(storeEntitlements.creatorActive, storeEntitlements.cardsActive || entitlement.hasAccess);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Einstellungen</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Benachrichtigungen ── */}
        <SectionHeader title="Benachrichtigungen" />
        <View style={styles.card}>
          <SettingsRow
            icon="bell-outline"
            label="Benachrichtigungen"
            value={notifGranted ? 'Aktiviert' : 'Deaktiviert'}
            onPress={() => { void Linking.openSettings(); }}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="map-marker-radius-outline"
            label="Sparring-Umkreis"
            value={`${radiusKm} km`}
            onPress={handleRadiusPick}
          />
        </View>

        {/* ── Sprache ── */}
        <SectionHeader title={t('settings.language')} />
        <LanguageSection />

        {/* ── Konto ── */}
        <SectionHeader title="Konto" />
        <View style={styles.card}>
          <SettingsRow
            icon="email-outline"
            label="E-Mail"
            value={user?.email ?? '–'}
            onPress={() => {}}
          />
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={openPasswordReset} activeOpacity={0.7} disabled={resetting}>
            <MaterialCommunityIcons name="lock-reset" size={20} color={colors.text} />
            <Text style={styles.rowLabel}>Passwort zurücksetzen</Text>
            {resetting
              ? <ActivityIndicator size="small" color={colors.accentBlue} />
              : <MaterialCommunityIcons name="chevron-right" size={18} color={colors.inactive} />}
          </TouchableOpacity>
        </View>

        {/* ── Privatsphäre ── */}
        <SectionHeader title="Privatsphäre" />
        <View style={styles.card}>
          <View style={styles.row}>
            <MaterialCommunityIcons name="trophy-outline" size={20} color={colors.text} />
            <Text style={[styles.rowLabel, styles.rowLabelFill]}>Kampfrekord öffentlich zeigen</Text>
            <Switch
              value={recordPublic}
              onValueChange={(v) => { void handleRecordPublicChange(v); }}
              disabled={profile === null || recordPublicDraft !== null}
              trackColor={{ true: colors.accentBlue, false: colors.border }}
            />
          </View>
          <View style={styles.divider} />
          <SettingsRow
            icon="account-cancel-outline"
            label="Blockierte Nutzer"
            value={blocked.length > 0 ? String(blocked.length) : undefined}
            onPress={() => { (navigation as unknown as { navigate: (s: string) => void }).navigate('BlockedUsers'); }}
          />
        </View>

        {/* ── Abo ── */}
        <SectionHeader title="Abo" />
        <View style={styles.card}>
          <SettingsRow
            icon="card-account-details-outline"
            label="Aktiver Plan"
            value={activePlanLabel}
            onPress={() => { (navigation as unknown as { navigate: (s: string) => void }).navigate('Paywall'); }}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="open-in-new"
            label="Abo verwalten"
            onPress={() => {
              void Linking.openURL(
                Platform.OS === 'ios'
                  ? 'https://apps.apple.com/account/subscriptions'
                  : 'https://play.google.com/store/account/subscriptions',
              );
            }}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="restore"
            label="Käufe wiederherstellen"
            onPress={() => { void handleRestorePurchases(); }}
          />
        </View>

        {/* ── Rechtliches ── */}
        <SectionHeader title="Rechtliches" />
        <View style={styles.card}>
          <SettingsRow
            icon="information-outline"
            label="Impressum"
            onPress={() => { (navigation as unknown as { navigate: (s: string) => void }).navigate('Impressum'); }}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="handshake-outline"
            label="Sparr-Grundregeln"
            onPress={() => { (navigation as unknown as { navigate: (s: string) => void }).navigate('SparringRules'); }}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="shield-lock-outline"
            label="Datenschutzerklärung"
            onPress={() => { void Linking.openURL('https://sparrapp.com/datenschutz.html'); }}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="file-document-outline"
            label="Nutzungsbedingungen"
            onPress={() => { void Linking.openURL('https://sparrapp.com/agb.html'); }}
          />
        </View>

        {/* ── Konto-Aktionen ── */}
        <SectionHeader title="Konto-Aktionen" />
        <View style={styles.card}>
          <SettingsRow
            icon="logout"
            label="Abmelden"
            onPress={handleLogout}
            danger
          />
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.row}
            onPress={handleDeleteAccount}
            activeOpacity={0.7}
            disabled={deletingAccount}
          >
            <MaterialCommunityIcons name="delete-outline" size={20} color={colors.deleteRed} />
            <Text style={[styles.rowLabel, styles.rowLabelDanger]}>Account löschen</Text>
            {deletingAccount && <ActivityIndicator size="small" color={colors.deleteRed} />}
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>

      {/* Passwort-Reset: Sicherheitsprüfung (Turnstile) vor dem Versand */}
      <Modal
        visible={resetModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closePasswordReset}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sicherheitsprüfung</Text>
            <Text style={styles.modalText}>
              Bitte bestätige kurz, dass du kein Roboter bist. Danach senden wir dir den Link zum Zurücksetzen.
            </Text>
            {resetting
              ? <ActivityIndicator color={colors.accentBlue} style={styles.modalSpinner} />
              : (
                <TurnstileWidget
                  key={captchaKey}
                  onToken={(t) => { void handlePasswordReset(t); }}
                />
              )}
            <TouchableOpacity style={styles.modalCancel} onPress={closePasswordReset} activeOpacity={0.7}>
              <Text style={styles.modalCancelText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // Passwort-Reset-Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.mapOverlay,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  modalSpinner: {
    marginVertical: 24,
  },
  modalCancel: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accentBlue,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  backBtn: { width: 36, alignItems: 'center' },

  scroll: { flex: 1 },
  content: { padding: 16, gap: 8 },

  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inactive,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 4,
    paddingHorizontal: 4,
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 48 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowLabel: { fontSize: 15, fontWeight: '500', color: colors.text },
  rowLabelDanger: { color: colors.deleteRed },
  rowLabelFill: { flex: 1 },
  rowValue: { fontSize: 14, color: colors.inactive, fontWeight: '400', marginRight: 4 },

  bottomPad: { height: 32 },
});
