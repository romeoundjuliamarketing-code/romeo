import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Linking, Modal, Platform, Switch,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
      Alert.alert(t('common.error'), error.message);
    } else {
      Alert.alert(t('settings.passwordReset.sentTitle'), t('settings.passwordReset.sentMessage', { email: user.email }));
    }
  }

  function handleDeleteAccount(): void {
    Alert.alert(
      t('settings.deleteAccount.title'),
      t('settings.deleteAccount.message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.deleteAccount.confirm'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDeletingAccount(true);
              // Sign in with Apple: revoke the Apple authorization first (App
              // Store 5.1.1(v)). If that fails, nothing is deleted yet.
              const { error: revokeError } = await revokeAppleAuthorization();
              if (revokeError !== null) {
                setDeletingAccount(false);
                Alert.alert(t('common.error'), t('settings.deleteAccount.appleError'));
                return;
              }
              const { error } = await supabase.rpc('delete_my_account');
              if (error !== null) {
                setDeletingAccount(false);
                Alert.alert(t('common.error'), error.message);
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
    Alert.alert(t('settings.logoutConfirm.title'), t('settings.logoutConfirm.message'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.logoutConfirm.confirm'), style: 'destructive', onPress: () => { void signOut(); } },
    ]);
  }

  async function handleRecordPublicChange(next: boolean): Promise<void> {
    setRecordPublicDraft(next);
    const { error } = await updateProfile({ show_fight_record: next });
    setRecordPublicDraft(null);
    if (error !== null) Alert.alert(t('common.error'), t('settings.recordSaveError'));
  }

  async function handleRestorePurchases(): Promise<void> {
    try {
      if (await restorePurchases() === 'restored') {
        await refetchStore();
        Alert.alert(t('paywall.restore.successTitle'), t('paywall.restore.successMessage'));
      } else {
        Alert.alert(t('paywall.restore.noneTitle'), t('paywall.restore.noneMessage'));
      }
    } catch (error: unknown) {
      Alert.alert(t('paywall.restore.failedTitle'), error instanceof Error ? error.message : t('paywall.tryAgain'));
    }
  }

  function handleRadiusPick(): void {
    Alert.alert(
      t('settings.radius.title'),
      t('settings.radius.message'),
      [
        ...RADIUS_OPTIONS.map((km) => ({
          text: km === radiusKm ? t('settings.radius.optionActive', { km }) : t('settings.radius.option', { km }),
          onPress: () => {
            setRadiusKm(km);
            void AsyncStorage.setItem(PROXIMITY_RADIUS_KEY, String(km));
          },
        })),
        { text: t('common.cancel'), style: 'cancel' as const },
      ],
    );
  }

  const activePlanLabel = entitlement.tier === 'studio_suite'
    ? t('settings.plan.studioSuite')
    : entitlement.tier === 'studio_visibility'
      ? t('settings.plan.studioVisibility')
      : planLabel(storeEntitlements.creatorActive, storeEntitlements.cardsActive || entitlement.hasAccess);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Benachrichtigungen ── */}
        <SectionHeader title={t('settings.sections.notifications')} />
        <View style={styles.card}>
          <SettingsRow
            icon="bell-outline"
            label={t('settings.rows.notifications')}
            value={notifGranted ? t('settings.rows.notificationsOn') : t('settings.rows.notificationsOff')}
            onPress={() => { void Linking.openSettings(); }}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="map-marker-radius-outline"
            label={t('settings.rows.sparringRadius')}
            value={`${radiusKm} km`}
            onPress={handleRadiusPick}
          />
          <View style={styles.divider} />
          {/* Intro on request: only the optional steps, never name, birth date or place. */}
          <SettingsRow
            icon="school-outline"
            label={t('onboarding.intro.replay')}
            onPress={() => navigation.navigate('Intro')}
          />
        </View>

        {/* ── Sprache ── */}
        <SectionHeader title={t('settings.language')} />
        <LanguageSection />

        {/* ── Konto ── */}
        <SectionHeader title={t('settings.sections.account')} />
        <View style={styles.card}>
          <SettingsRow
            icon="email-outline"
            label={t('settings.rows.email')}
            value={user?.email ?? '–'}
            onPress={() => {}}
          />
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={openPasswordReset} activeOpacity={0.7} disabled={resetting}>
            <MaterialCommunityIcons name="lock-reset" size={20} color={colors.text} />
            <Text style={styles.rowLabel}>{t('settings.rows.resetPassword')}</Text>
            {resetting
              ? <ActivityIndicator size="small" color={colors.accentBlue} />
              : <MaterialCommunityIcons name="chevron-right" size={18} color={colors.inactive} />}
          </TouchableOpacity>
        </View>

        {/* ── Privatsphäre ── */}
        <SectionHeader title={t('settings.sections.privacy')} />
        <View style={styles.card}>
          <View style={styles.row}>
            <MaterialCommunityIcons name="trophy-outline" size={20} color={colors.text} />
            <Text style={[styles.rowLabel, styles.rowLabelFill]}>{t('settings.rows.showFightRecord')}</Text>
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
            label={t('settings.rows.blockedUsers')}
            value={blocked.length > 0 ? String(blocked.length) : undefined}
            onPress={() => { (navigation as unknown as { navigate: (s: string) => void }).navigate('BlockedUsers'); }}
          />
        </View>

        {/* ── Abo ── */}
        <SectionHeader title={t('settings.sections.subscription')} />
        <View style={styles.card}>
          <SettingsRow
            icon="card-account-details-outline"
            label={t('settings.rows.activePlan')}
            value={activePlanLabel}
            onPress={() => { (navigation as unknown as { navigate: (s: string) => void }).navigate('Paywall'); }}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="open-in-new"
            label={t('settings.rows.manageSubscription')}
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
            label={t('settings.rows.restorePurchases')}
            onPress={() => { void handleRestorePurchases(); }}
          />
        </View>

        {/* ── Rechtliches ── */}
        <SectionHeader title={t('settings.sections.legal')} />
        <View style={styles.card}>
          <SettingsRow
            icon="information-outline"
            label={t('settings.rows.imprint')}
            onPress={() => { (navigation as unknown as { navigate: (s: string) => void }).navigate('Impressum'); }}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="handshake-outline"
            label={t('settings.rows.rules')}
            onPress={() => { (navigation as unknown as { navigate: (s: string) => void }).navigate('SparringRules'); }}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="shield-lock-outline"
            label={t('settings.rows.privacyPolicy')}
            onPress={() => { void Linking.openURL('https://sparrapp.com/datenschutz.html'); }}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="file-document-outline"
            label={t('settings.rows.terms')}
            onPress={() => { void Linking.openURL('https://sparrapp.com/agb.html'); }}
          />
        </View>

        {/* ── Konto-Aktionen ── */}
        <SectionHeader title={t('settings.sections.accountActions')} />
        <View style={styles.card}>
          <SettingsRow
            icon="logout"
            label={t('settings.rows.logout')}
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
            <Text style={[styles.rowLabel, styles.rowLabelDanger]}>{t('settings.rows.deleteAccount')}</Text>
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
            <Text style={styles.modalTitle}>{t('settings.passwordReset.securityTitle')}</Text>
            <Text style={styles.modalText}>
              {t('settings.passwordReset.securityText')}
            </Text>
            {resetting
              ? <ActivityIndicator color={colors.accentBlue} style={styles.modalSpinner} />
              : (
                <TurnstileWidget
                  key={captchaKey}
                  onToken={(token) => { void handlePasswordReset(token); }}
                />
              )}
            <TouchableOpacity style={styles.modalCancel} onPress={closePasswordReset} activeOpacity={0.7}>
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
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
