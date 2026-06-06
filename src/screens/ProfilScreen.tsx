import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import FightRecordCard from '../components/profil/FightRecordCard';
import AddFightSheet from '../components/profil/AddFightSheet';
import TeamPickerCard from '../components/profil/TeamPickerCard';
import AvatarPicker from '../components/profil/AvatarPicker';
import ProfileNameEditor from '../components/profil/ProfileNameEditor';
import DisciplinePickerCard from '../components/profil/DisciplinePickerCard';
import PaywallCard from '../components/common/PaywallCard';
import MyRequestsCard from '../components/profil/MyRequestsCard';
import { VerificationSection } from '../components/profil/VerificationSection';
import type { Discipline } from '../data/disciplines';
import { useWorkoutStats } from '../hooks/useWorkoutStats';
import { useFightRecord } from '../hooks/useFightRecord';
import { useStudio } from '../hooks/useStudio';
import { useProfile } from '../hooks/useProfile';
import { useWeight } from '../hooks/useWeight';
import { useEntitlement } from '../hooks/useEntitlement';
import { useStudioInvite } from '../hooks/useStudioInvite';

// Derives initials from a full name (e.g. "Romeo Georgiadis" → "RG")
function getInitials(name: string | null): string {
  if (name === null || name.trim().length === 0) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

// Formats created_at ISO string as "Mitglied seit Monat YYYY"
function getMemberSince(createdAt: string | null): string {
  if (createdAt === null) return '';
  const date = new Date(createdAt);
  return `Mitglied seit ${date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`;
}

type StatIcon = 'fire' | 'star' | 'dumbbell' | 'trophy';

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfilScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [focusTrigger, setFocusTrigger] = useState(0);

  useFocusEffect(useCallback(() => {
    setFocusTrigger((n) => n + 1);
  }, []));

  const { totalPoints, totalWorkouts, streak, rank } = useWorkoutStats(focusTrigger);
  const { currentStudio, joinStudio, searchStudios, createStudio } = useStudio(focusTrigger);
  const { profile, uploadAvatar, updateProfile } = useProfile(focusTrigger);
  const { acceptInvite } = useStudioInvite();
  const { currentWeight, isNewWeek, logWeight } = useWeight(focusTrigger);
  const { entitlement } = useEntitlement(focusTrigger);
  const { fights, loading: fightsLoading, addFight, deleteFight } = useFightRecord(focusTrigger);
  const [fightSheetVisible, setFightSheetVisible] = useState(false);
  const [disciplineSaving, setDisciplineSaving] = useState(false);

  // Weight input modal
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [weightDraft, setWeightDraft] = useState('');
  const [weightSaving, setWeightSaving] = useState(false);

  // Height input modal
  const [heightModalVisible, setHeightModalVisible] = useState(false);
  const [heightDraft, setHeightDraft] = useState('');
  const [heightSaving, setHeightSaving] = useState(false);
  const [ageModalVisible, setAgeModalVisible] = useState(false);
  const [ageDraft, setAgeDraft] = useState('');
  const [ageSaving, setAgeSaving] = useState(false);
  const [armSpanModalVisible, setArmSpanModalVisible] = useState(false);
  const [armSpanDraft, setArmSpanDraft] = useState('');
  const [armSpanSaving, setArmSpanSaving] = useState(false);

  async function handleRedeemCode(code: string): Promise<{ error: string | null }> {
    const result = await acceptInvite(code);
    if (result.error !== null) return { error: result.error };
    if (result.studioId !== null) {
      await joinStudio(result.studioId);
    }
    return { error: null };
  }

  async function handleSaveWeight(): Promise<void> {
    const kg = parseFloat(weightDraft.replace(',', '.'));
    if (isNaN(kg) || kg <= 0 || kg >= 500) {
      Alert.alert('Ungültig', 'Bitte gib ein gültiges Gewicht ein (z. B. 82.5).');
      return;
    }
    setWeightSaving(true);
    const result = await logWeight(kg);
    setWeightSaving(false);
    if (result.error !== null) {
      Alert.alert('Fehler', result.error);
      return;
    }
    setWeightModalVisible(false);
    setWeightDraft('');
  }

  async function handleSaveHeight(): Promise<void> {
    const cm = parseInt(heightDraft, 10);
    if (isNaN(cm) || cm < 100 || cm > 250) {
      Alert.alert('Ungültig', 'Bitte gib eine gültige Körpergrösse ein (100–250 cm).');
      return;
    }
    setHeightSaving(true);
    await updateProfile({ height_cm: cm });
    setHeightSaving(false);
    setHeightModalVisible(false);
    setHeightDraft('');
  }

  async function handleSaveAge(): Promise<void> {
    const years = parseInt(ageDraft, 10);
    if (isNaN(years) || years < 14 || years > 99) {
      Alert.alert('Ungültig', 'Bitte gib ein gültiges Alter ein (14–99 Jahre).');
      return;
    }
    setAgeSaving(true);
    await updateProfile({ age_years: years });
    setAgeSaving(false);
    setAgeModalVisible(false);
    setAgeDraft('');
  }

  async function handleSaveArmSpan(): Promise<void> {
    const cm = parseInt(armSpanDraft, 10);
    if (isNaN(cm) || cm < 100 || cm > 250) {
      Alert.alert('Ungültig', 'Bitte gib eine gültige Spannweite ein (100–250 cm).');
      return;
    }
    setArmSpanSaving(true);
    await updateProfile({ arm_span_cm: cm });
    setArmSpanSaving(false);
    setArmSpanModalVisible(false);
    setArmSpanDraft('');
  }

  async function handleSaveName(name: string): Promise<void> {
    await updateProfile({ name });
  }

  async function handleToggleDiscipline(discipline: Discipline): Promise<void> {
    if (profile === null) return;
    const current = profile.disciplines ?? [];
    const next = current.includes(discipline)
      ? current.filter((d) => d !== discipline)
      : [...current, discipline];
    setDisciplineSaving(true);
    await updateProfile({ disciplines: next });
    setDisciplineSaving(false);
  }

  const displayName = profile?.name ?? 'Profil';
  const displayInitials = getInitials(profile?.name ?? null);
  const displayMemberSince = getMemberSince(profile?.created_at ?? null);
  const displayAge = profile?.age_years !== null && profile?.age_years !== undefined
    ? `${profile.age_years} Jahre`
    : null;

  const STATS: { label: string; value: string; unit: string; icon: StatIcon }[] = [
    { label: 'Streak',   value: String(streak),        unit: 'Tage',   icon: 'fire'     },
    { label: 'Punkte',   value: String(totalPoints),   unit: 'XP',     icon: 'star'     },
    { label: 'Workouts', value: String(totalWorkouts), unit: 'gesamt', icon: 'dumbbell' },
    { label: 'Rang',     value: rank !== null ? `#${rank}` : '–', unit: 'Gruppe', icon: 'trophy'   },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
        {/* ── Profile header ── */}
        <View style={styles.profileCard}>
          <View style={styles.profileTopRow}>
            <AvatarPicker
              avatarUrl={profile?.avatar_url ?? null}
              initials={displayInitials}
              onUpload={uploadAvatar}
            />
            <View style={styles.profileMeta}>
              {currentStudio !== null && (
                <Text style={styles.profileMetaText}>{currentStudio.name}, {currentStudio.city}</Text>
              )}
              {displayMemberSince.length > 0 && (
                <Text style={styles.profileMetaText}>{displayMemberSince}</Text>
              )}
              {displayAge !== null && (
                <Text style={styles.profileMetaText}>{displayAge}</Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('Settings')}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="cog-outline" size={22} color={colors.inactive} />
            </TouchableOpacity>
          </View>
          <ProfileNameEditor
            name={profile?.name ?? null}
            onSave={handleSaveName}
          />
          <DisciplinePickerCard
            selected={profile?.disciplines ?? []}
            saving={disciplineSaving}
            onToggle={handleToggleDiscipline}
            inline
          />
          <TeamPickerCard
            currentStudio={currentStudio}
            onJoin={joinStudio}
            onSearch={searchStudios}
            onRedeemCode={handleRedeemCode}
            onCreate={async (name, city) => {
              if (!entitlement.canCreateStudio) {
                Alert.alert('Studio-Abo erforderlich', 'Ein neues Team kann nur mit einem aktiven Studio-Abo erstellt werden.');
                return null;
              }
              const created = await createStudio(name, city);
              if (created === null) {
                Alert.alert('Fehler', 'Studio konnte nicht erstellt werden.');
              }
              return created;
            }}
            canCreateStudio={entitlement.canCreateStudio}
            onCreateBlocked={() => {
              Alert.alert('Studio-Abo erforderlich', 'Ein neues Team kann nur mit einem aktiven Studio-Abo erstellt werden.');
            }}
            onViewTeam={currentStudio !== null ? () => navigation.navigate('Team', {
              studioId: currentStudio.id,
              studioName: currentStudio.name,
              studioCity: currentStudio.city,
            }) : undefined}
            inline
          />

          {/* Height entry row */}
          <TouchableOpacity
            style={styles.weightRow}
            onPress={() => {
              setHeightDraft(profile?.height_cm !== null && profile?.height_cm !== undefined ? String(profile.height_cm) : '');
              setHeightModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="human-male-height" size={20} color={colors.inactive} />
            <View style={styles.weightInfo}>
              <Text style={styles.weightLabel}>Körpergrösse</Text>
            </View>
            <Text style={[styles.weightValue, (profile?.height_cm === null || profile?.height_cm === undefined) && styles.weightValueEmpty]}>
              {profile?.height_cm !== null && profile?.height_cm !== undefined ? `${profile.height_cm} cm` : 'Eintragen'}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.inactive} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.weightRow}
            onPress={() => {
              setAgeDraft(profile?.age_years !== null && profile?.age_years !== undefined ? String(profile.age_years) : '');
              setAgeModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="calendar-account-outline" size={20} color={colors.inactive} />
            <View style={styles.weightInfo}>
              <Text style={styles.weightLabel}>Alter</Text>
            </View>
            <Text style={[styles.weightValue, (profile?.age_years === null || profile?.age_years === undefined) && styles.weightValueEmpty]}>
              {profile?.age_years !== null && profile?.age_years !== undefined ? `${profile.age_years} Jahre` : 'Eintragen'}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.inactive} />
          </TouchableOpacity>

          {/* Weight entry row */}
          <TouchableOpacity
            style={[styles.weightRow, isNewWeek && styles.weightRowHighlight]}
            onPress={() => {
              setWeightDraft(currentWeight !== null ? String(currentWeight) : '');
              setWeightModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="scale-bathroom"
              size={20}
              color={isNewWeek ? colors.accentBlue : colors.inactive}
            />
            <View style={styles.weightInfo}>
              <Text style={[styles.weightLabel, isNewWeek && styles.weightLabelHighlight]}>
                Gewicht
              </Text>
              {isNewWeek && (
                <Text style={styles.weightHint}>Neuer Eintrag fällig</Text>
              )}
            </View>
            <Text style={[styles.weightValue, currentWeight === null && styles.weightValueEmpty]}>
              {currentWeight !== null ? `${currentWeight} kg` : 'Eintragen'}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.inactive} />
          </TouchableOpacity>

          {/* Weight history nav row */}
          <TouchableOpacity
            style={styles.weightRow}
            onPress={() => navigation.navigate('WeightHistory')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="chart-line" size={20} color={colors.inactive} />
            <View style={styles.weightInfo}>
              <Text style={styles.weightLabel}>Gewichtsverlauf</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.inactive} />
          </TouchableOpacity>

          {/* Arm span row */}
          <TouchableOpacity
            style={styles.weightRow}
            onPress={() => {
              setArmSpanDraft(profile?.arm_span_cm !== null && profile?.arm_span_cm !== undefined ? String(profile.arm_span_cm) : '');
              setArmSpanModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="arrow-left-right" size={20} color={colors.inactive} />
            <View style={styles.weightInfo}>
              <Text style={styles.weightLabel}>Spannweite</Text>
            </View>
            <Text style={[styles.weightValue, (profile?.arm_span_cm === null || profile?.arm_span_cm === undefined) && styles.weightValueEmpty]}>
              {profile?.arm_span_cm !== null && profile?.arm_span_cm !== undefined ? `${profile.arm_span_cm} cm` : 'Eintragen'}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={colors.inactive} />
          </TouchableOpacity>

          {/* Stance row */}
          <View style={styles.stanceRow}>
            {(['southpaw', 'orthodox'] as const).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.stanceChip, profile?.stance === s && styles.stanceChipActive]}
                onPress={() => { void updateProfile({ stance: s }); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.stanceChipText, profile?.stance === s && styles.stanceChipTextActive]}>
                  {s === 'orthodox' ? 'Rechtshänder' : 'Linkshänder'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

        </View>

        {/* ── Meine Anfragen ── */}
        <MyRequestsCard refetchTrigger={focusTrigger} />

        {entitlement.hasAccess ? (
          <>
            {/* ── Kampfrekord ── */}
            <FightRecordCard
              fights={fights}
              loading={fightsLoading}
              onAdd={() => setFightSheetVisible(true)}
              onDelete={async (id) => { await deleteFight(id); }}
            />

            {/* ── Stats grid ── */}
            <View style={styles.statsGrid}>
              {STATS.map((stat) => {
                const isPunkte = stat.label === 'Punkte';
                const isStreak = stat.label === 'Streak';
                const isWorkouts = stat.label === 'Workouts';
                const isTappable = isPunkte || isStreak || isWorkouts;
                const cardContent = (
                  <>
                    <MaterialCommunityIcons
                      name={stat.icon}
                      size={22}
                      color={colors.accentBlue}
                      style={styles.statIcon}
                    />
                    <Text style={styles.statValue}>{stat.value}</Text>
                    <Text style={styles.statUnit}>{stat.unit}</Text>
                    <View style={styles.statLabelRow}>
                      <Text style={styles.statLabel}>{stat.label}</Text>
                      {isTappable && (
                        <MaterialCommunityIcons name="chevron-right" size={14} color={colors.inactive} />
                      )}
                    </View>
                  </>
                );
                if (isTappable) {
                  return (
                    <TouchableOpacity
                      key={stat.label}
                      style={styles.statCard}
                      onPress={() =>
                        isPunkte ? navigation.navigate('PointsBreakdown')
                        : isStreak ? navigation.navigate('AttendanceHistory')
                        : navigation.navigate('WorkoutHistory')
                      }
                      activeOpacity={0.7}
                    >
                      {cardContent}
                    </TouchableOpacity>
                  );
                }
                return (
                  <View key={stat.label} style={styles.statCard}>
                    {cardContent}
                  </View>
                );
              })}
            </View>

          </>
        ) : (
          <PaywallCard
            title="Stats & Punkte im Abo"
            message="Punkte, Rang und detaillierte Auswertungen sind nur mit einem aktiven Abo verfügbar."
            onPressCta={() => navigation.navigate('Paywall')}
          />
        )}
        </View>

        {/* ── Verifizierung ── */}
        <VerificationSection refetchTrigger={focusTrigger} />
      </ScrollView>

      {/* Height input modal */}
      <Modal
        visible={heightModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setHeightModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.weightOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={styles.weightBackdrop} activeOpacity={1} onPress={() => setHeightModalVisible(false)} />
          <View style={styles.weightSheet}>
            <Text style={styles.weightSheetTitle}>Körpergrösse eintragen</Text>
            <Text style={styles.weightSheetSubtitle}>cm</Text>
            <TextInput
              style={styles.weightInput}
              placeholder="z. B. 182"
              placeholderTextColor={colors.inactive}
              value={heightDraft}
              onChangeText={setHeightDraft}
              keyboardType="number-pad"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => { void handleSaveHeight(); }}
            />
            <TouchableOpacity
              style={[styles.weightSaveBtn, heightDraft.trim().length === 0 && styles.weightSaveBtnDisabled]}
              onPress={() => { void handleSaveHeight(); }}
              disabled={heightSaving || heightDraft.trim().length === 0}
              activeOpacity={0.8}
            >
              <Text style={styles.weightSaveBtnLabel}>
                {heightSaving ? 'Speichern...' : 'Speichern'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Weight input modal */}
      <Modal
        visible={ageModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAgeModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.weightOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={styles.weightBackdrop} activeOpacity={1} onPress={() => setAgeModalVisible(false)} />
          <View style={styles.weightSheet}>
            <Text style={styles.weightSheetTitle}>Alter eintragen</Text>
            <Text style={styles.weightSheetSubtitle}>Jahre</Text>
            <TextInput
              style={styles.weightInput}
              placeholder="z. B. 27"
              placeholderTextColor={colors.inactive}
              value={ageDraft}
              onChangeText={setAgeDraft}
              keyboardType="number-pad"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => { void handleSaveAge(); }}
            />
            <TouchableOpacity
              style={[styles.weightSaveBtn, ageDraft.trim().length === 0 && styles.weightSaveBtnDisabled]}
              onPress={() => { void handleSaveAge(); }}
              disabled={ageSaving || ageDraft.trim().length === 0}
              activeOpacity={0.8}
            >
              <Text style={styles.weightSaveBtnLabel}>
                {ageSaving ? 'Speichern...' : 'Speichern'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <AddFightSheet
        visible={fightSheetVisible}
        onClose={() => setFightSheetVisible(false)}
        onSaved={() => setFocusTrigger((n) => n + 1)}
        addFight={addFight}
      />

      {/* Arm span input modal */}
      <Modal
        visible={armSpanModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setArmSpanModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.weightOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={styles.weightBackdrop} activeOpacity={1} onPress={() => setArmSpanModalVisible(false)} />
          <View style={styles.weightSheet}>
            <Text style={styles.weightSheetTitle}>Spannweite eintragen</Text>
            <Text style={styles.weightSheetSubtitle}>cm</Text>
            <TextInput
              style={styles.weightInput}
              placeholder="z. B. 185"
              placeholderTextColor={colors.inactive}
              value={armSpanDraft}
              onChangeText={setArmSpanDraft}
              keyboardType="number-pad"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.weightSaveBtn, armSpanDraft.trim().length === 0 && styles.weightSaveBtnDisabled]}
              onPress={() => { void handleSaveArmSpan(); }}
              disabled={armSpanSaving || armSpanDraft.trim().length === 0}
              activeOpacity={0.8}
            >
              <Text style={styles.weightSaveBtnLabel}>
                {armSpanSaving ? 'Speichern...' : 'Speichern'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Weight input modal */}
      <Modal
        visible={weightModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setWeightModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.weightOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={styles.weightBackdrop} activeOpacity={1} onPress={() => setWeightModalVisible(false)} />
          <View style={styles.weightSheet}>
            <Text style={styles.weightSheetTitle}>Gewicht eintragen</Text>
            <Text style={styles.weightSheetSubtitle}>Diese Woche · kg</Text>
            <TextInput
              style={styles.weightInput}
              placeholder="z. B. 82.5"
              placeholderTextColor={colors.inactive}
              value={weightDraft}
              onChangeText={setWeightDraft}
              keyboardType="decimal-pad"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => { void handleSaveWeight(); }}
            />
            <TouchableOpacity
              style={[styles.weightSaveBtn, weightDraft.trim().length === 0 && styles.weightSaveBtnDisabled]}
              onPress={() => { void handleSaveWeight(); }}
              disabled={weightSaving || weightDraft.trim().length === 0}
              activeOpacity={0.8}
            >
              <Text style={styles.weightSaveBtnLabel}>
                {weightSaving ? 'Speichern...' : 'Speichern'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_RADIUS = 16;

const cardShadow = Platform.select({
  ios: {
    shadowColor: colors.headerBg,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 32,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },

  // Profile header card
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: CARD_RADIUS,
    padding: 16,
    marginBottom: 16,
    ...cardShadow,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  profileMeta: {
    flex: 1,
    gap: 2,
  },
  profileMetaText: {
    fontSize: 13,
    color: colors.inactive,
    fontWeight: '400',
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: colors.card,
    borderRadius: CARD_RADIUS,
    padding: 16,
    width: '47.5%',
    ...cardShadow,
  },
  statIcon: {
    marginBottom: 8,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  statUnit: {
    fontSize: 11,
    color: colors.inactive,
    fontWeight: '500',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },

  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  // Weight row (inside profile card)
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  weightRowHighlight: {
    // subtle blue tint when new week
    backgroundColor: colors.accentBlueSoft,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    marginBottom: -16,
    borderBottomLeftRadius: CARD_RADIUS,
    borderBottomRightRadius: CARD_RADIUS,
  },
  weightInfo: {
    flex: 1,
    gap: 2,
  },
  weightLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  weightLabelHighlight: {
    color: colors.accentBlue,
  },
  weightHint: {
    fontSize: 11,
    color: colors.accentBlue,
    fontWeight: '500',
  },
  weightValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  weightValueEmpty: {
    color: colors.accentBlue,
    fontWeight: '600',
  },
  stanceRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stanceChip: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stanceChipActive:     { backgroundColor: colors.accentBlue, borderColor: colors.accentBlue },
  stanceChipText:       { fontSize: 14, fontWeight: '600', color: colors.text },
  stanceChipTextActive: { color: colors.card },

  // Weight modal
  weightOverlay: { flex: 1, justifyContent: 'flex-end' },
  weightBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  weightSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 8,
  },
  weightSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  weightSheetSubtitle: {
    fontSize: 13,
    color: colors.inactive,
    fontWeight: '400',
    marginBottom: 8,
    textAlign: 'center',
  },
  weightInput: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: 'center',
    marginBottom: 8,
  },
  weightSaveBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  weightSaveBtnDisabled: { opacity: 0.4 },
  weightSaveBtnLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.card,
  },
});
