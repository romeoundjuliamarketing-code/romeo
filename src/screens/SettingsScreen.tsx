import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { useEntitlement } from '../hooks/useEntitlement';
import { supabase } from '../lib/supabase';

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
  icon, label, value, onToggle,
}: {
  icon: string; label: string; value: boolean; onToggle: (v: boolean) => void;
}): React.ReactElement {
  return (
    <View style={styles.row}>
      <MaterialCommunityIcons name={icon as 'eye'} size={20} color={colors.text} />
      <Text style={[styles.rowLabel, styles.rowLabelFlex]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.accentBlue }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen(): React.ReactElement {
  const navigation = useNavigation();
  const { user, signOut } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { entitlement } = useEntitlement();
  const [resetting, setResetting]       = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  async function handlePasswordReset(): Promise<void> {
    if (user?.email == null) return;
    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email);
    setResetting(false);
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

  async function togglePrivacy(field: 'show_weight_in_group' | 'show_points_in_group' | 'show_fitness_in_group', value: boolean): Promise<void> {
    await updateProfile({ [field]: value });
  }

  const showWeight  = profile?.show_weight_in_group  ?? true;
  const showPoints  = profile?.show_points_in_group  ?? true;
  const showFitness = profile?.show_fitness_in_group ?? true;
  const planLabel = entitlement.hasAccess
    ? entitlement.tier === 'studio' ? 'Studio-Abo' : 'Einzel-Abo'
    : 'Kein aktives Abo';
  const seatsLabel = entitlement.tier === 'studio'
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
          <TouchableOpacity style={styles.row} onPress={() => { void handlePasswordReset(); }} activeOpacity={0.7} disabled={resetting}>
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
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

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
    backgroundColor: '#FFFFFF',
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
  rowLabelFlex: { flex: 1 },
  rowLabelDanger: { color: colors.deleteRed },
  rowValue: { fontSize: 14, color: colors.inactive, fontWeight: '400', marginRight: 4 },

  bottomPad: { height: 32 },
});
