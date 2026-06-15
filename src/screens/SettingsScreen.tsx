import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch,
  TouchableOpacity, Alert, ActivityIndicator, Linking, Modal,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { useEntitlement } from '../hooks/useEntitlement';
import { useSchedule } from '../hooks/useSchedule';
import { useNotifications } from '../hooks/useNotifications';
import { supabase } from '../lib/supabase';
import { PROXIMITY_RADIUS_KEY } from '../hooks/useProximitySparringNotifications';
import { useCaptcha } from '../hooks/useCaptcha';
import TurnstileWidget from '../components/auth/TurnstileWidget';

const PREWORKOUT_KEY = 'preworkout_enabled';
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

function ToggleRow({
  icon, label, subtitle, value, onToggle,
}: {
  icon: string; label: string; subtitle?: string; value: boolean; onToggle: (v: boolean) => void;
}): React.ReactElement {
  return (
    <View style={styles.row}>
      <MaterialCommunityIcons name={icon as 'eye'} size={20} color={colors.text} />
      <View style={styles.rowLabelWrap}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle !== undefined && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.accentBlue }}
        thumbColor={colors.card}
      />
    </View>
  );
}

// ─── Debug ────────────────────────────────────────────────────────────────────

// Fires all notification types at 10-second intervals for simulator testing
async function scheduleTestNotifications(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((n) => n.identifier.startsWith('test-'))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  // Pre-workout values based on 75 kg fallback for testing
  const testItems: Array<{ id: string; title: string; body: string; delaySec: number }> = [
    { id: 'test-water-1',  delaySec: 10,  title: 'Wasser trinken',                  body: 'Wasser trinken — dein Körper dankt es dir.' },
    { id: 'test-water-2',  delaySec: 20,  title: 'Wasser trinken',                  body: 'Hydration-Check: Wann hast du zuletzt getrunken?' },
    { id: 'test-water-3',  delaySec: 30,  title: 'Wasser trinken',                  body: 'Trink jetzt — warte nicht bis du Durst hast.' },
    { id: 'test-weight',   delaySec: 40,  title: 'Wöchentliches Gewichts-Check-in', body: 'Wöchentliches Wiegen — nur eine Zahl, aber sie zeigt den Trend.' },
    { id: 'test-pw-4h',    delaySec: 50,  title: 'Heute Training: Ernährung',       body: 'Jetzt vollständig essen — letzte Mahlzeit mit Fetten und Ballaststoffen. Danach nur noch leichte Kost.' },
    { id: 'test-pw-2h',    delaySec: 60,  title: 'Trainingszeit nähert sich',       body: 'Leichte Mahlzeit: ~90 g Kohlenhydrate + ~26 g Protein. Z.B. Reis + Hühnchen.' },
    { id: 'test-pw-1h',    delaySec: 70,  title: '1 Stunde bis Training',           body: 'Kleiner Snack: ~38 g schnelle Carbs (Banane, Reiswaffel). Dazu 450 ml Wasser mit einer Prise Salz.' },
    { id: 'test-pw-30min', delaySec: 80,  title: '30 Minuten',                      body: 'Kein Essen mehr. Equipment packen, kurz dehnen, mental einstimmen.' },
    { id: 'test-training', delaySec: 90,  title: 'Training in 1 Stunde',            body: 'Dein Training startet bald — vergiss nicht, dich anzumelden und deine Punkte abzuholen!' },
  ];

  for (const item of testItems) {
    const date = new Date(Date.now() + item.delaySec * 1000);
    await Notifications.scheduleNotificationAsync({
      identifier: item.id,
      content: { title: item.title, body: item.body },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date },
    });
  }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen(): React.ReactElement {
  const navigation = useNavigation();
  const { user, signOut } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { entitlement } = useEntitlement();
  const [resetting, setResetting]             = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const { captchaKey, resetCaptcha }          = useCaptcha();
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [notifGranted, setNotifGranted]       = useState(false);
  const [preWorkoutEnabled, setPreWorkoutEnabled] = useState(false);
  const [radiusKm, setRadiusKm] = useState<RadiusOption>(30);

  // JS getDay(): 0=Sun … 6=Sat → 0=Mon … 6=Sun
  const todayDow = (new Date().getDay() + 6) % 7;
  const { schedule } = useSchedule(todayDow, profile?.studio_id ?? null);
  const { scheduleTrainingReminders } = useNotifications();

  useEffect(() => {
    void Notifications.getPermissionsAsync().then(({ status }) => {
      setNotifGranted(status === 'granted');
    });
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(PREWORKOUT_KEY).then((v) => {
      setPreWorkoutEnabled(v === 'true');
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
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { captchaToken, redirectTo: 'sparr://reset-password' });
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

  async function handlePreWorkoutToggle(value: boolean): Promise<void> {
    setPreWorkoutEnabled(value);
    await AsyncStorage.setItem(PREWORKOUT_KEY, value ? 'true' : 'false');
    await scheduleTrainingReminders(schedule, value);
  }

  async function togglePrivacy(field: 'show_weight_in_group' | 'show_points_in_group' | 'show_fitness_in_group', value: boolean): Promise<void> {
    await updateProfile({ [field]: value });
  }

  const showWeight  = profile?.show_weight_in_group  ?? true;
  const showPoints  = profile?.show_points_in_group  ?? true;
  const showFitness = profile?.show_fitness_in_group ?? true;
  const planLabel = entitlement.hasAccess
    ? entitlement.tier === 'studio_suite'
      ? 'Studio Suite'
      : entitlement.tier === 'studio_visibility'
        ? 'Studio Sichtbarkeit'
        : 'Einzel-Abo'
    : 'Kein aktives Abo';
  const seatsLabel = entitlement.tier === 'studio_suite'
    ? `${entitlement.usedSeats}/${entitlement.includedSeats + entitlement.extraSeats}`
    : undefined;

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

        {/* ── Training ── */}
        <SectionHeader title="Training" />
        <View style={styles.card}>
          <ToggleRow
            icon="run-fast"
            label="Vorbereitung vor Training"
            subtitle="Erinnerungen 4h, 2h, 1h und 30 Min vor jeder Session"
            value={preWorkoutEnabled}
            onToggle={(v) => { void handlePreWorkoutToggle(v); }}
          />
        </View>

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

        {/* ── Datenschutz ── */}
        <SectionHeader title="Datenschutz" />
        <View style={styles.card}>
          <ToggleRow
            icon="scale-bathroom"
            label="Gewichtsfortschritt in Gruppe anzeigen"
            value={showWeight}
            onToggle={(v) => { void togglePrivacy('show_weight_in_group', v); }}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="star-outline"
            label="Punkte & Rang in Gruppe anzeigen"
            value={showPoints}
            onToggle={(v) => { void togglePrivacy('show_points_in_group', v); }}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="chart-bar"
            label="Fitness-Profil in Gruppe anzeigen"
            value={showFitness}
            onToggle={(v) => { void togglePrivacy('show_fitness_in_group', v); }}
          />
        </View>

        {/* ── Abo ── */}
        <SectionHeader title="Abo" />
        <View style={styles.card}>
          <SettingsRow
            icon="card-account-details-outline"
            label="Aktiver Plan"
            value={planLabel}
            onPress={() => {}}
          />
          {seatsLabel !== undefined && (
            <>
              <View style={styles.divider} />
              <SettingsRow
                icon="account-multiple-outline"
                label="Belegte Plätze"
                value={seatsLabel}
                onPress={() => {}}
              />
            </>
          )}
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

        {/* DEBUG – remove after App Store screenshot */}
        <SectionHeader title="Debug" />
        <View style={styles.card}>
          <SettingsRow
            icon="storefront-outline"
            label="Abo ändern"
            onPress={() => { (navigation as unknown as { navigate: (s: string) => void }).navigate('Paywall'); }}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="bell-ring-outline"
            label="Alle Notifications testen (10 s)"
            onPress={() => { void scheduleTestNotifications(); }}
          />
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
  rowLabelWrap: { flex: 1 },
  rowSubtitle: { fontSize: 12, color: colors.inactive, marginTop: 2 },
  rowLabelDanger: { color: colors.deleteRed },
  rowValue: { fontSize: 14, color: colors.inactive, fontWeight: '400', marginRight: 4 },

  bottomPad: { height: 32 },
});
