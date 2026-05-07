import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Profile, CoachNominationDetails } from '../types/database.types';
import { useCoachNominations } from '../hooks/useCoachNominations';
import { fetchTeamWeights } from '../hooks/useWeight';
import { useAnnouncement } from '../hooks/useAnnouncement';
import { useAttendance } from '../hooks/useAttendance';
import { useSchedule } from '../hooks/useSchedule';
import { useEntitlement } from '../hooks/useEntitlement';
import { useStudioInvite } from '../hooks/useStudioInvite';
import TeamMemberRow from '../components/team/TeamMemberRow';
import NominationCard from '../components/team/NominationCard';
import AttendanceSheet from '../components/team/AttendanceSheet';
import StudioScheduleSection from '../components/team/StudioScheduleSection';
import PaywallCard from '../components/common/PaywallCard';
import CreateSparringSheet from '../components/sparring/CreateSparringSheet';
import { useSparringActions } from '../hooks/useSparringActions';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Team'>;

type SheetAction = {
  label: string;
  destructive?: boolean;
  onPress: () => Promise<{ error: string | null }>;
};

type AnnouncementDuration = '1d' | '3d' | '1w' | 'forever';

type AnnouncementDurationOption = {
  value: AnnouncementDuration;
  label: string;
};

const ANNOUNCEMENT_DURATION_OPTIONS: AnnouncementDurationOption[] = [
  { value: '1d', label: '1 Tag' },
  { value: '3d', label: '3 Tage' },
  { value: '1w', label: '1 Woche' },
  { value: 'forever', label: 'Dauerhaft' },
];

function mapExpiresAtToDuration(expiresAt: string | null): AnnouncementDuration {
  if (expiresAt === null) return 'forever';

  const ms = new Date(expiresAt).getTime() - Date.now();
  const days = ms / (24 * 60 * 60 * 1000);

  if (days <= 2) return '1d';
  if (days <= 5) return '3d';
  return '1w';
}

function durationToExpiresAt(duration: AnnouncementDuration): string | null {
  if (duration === 'forever') return null;

  const daysByDuration: Record<Exclude<AnnouncementDuration, 'forever'>, number> = {
    '1d': 1,
    '3d': 3,
    '1w': 7,
  };

  const expiresAt = new Date(Date.now() + daysByDuration[duration] * 24 * 60 * 60 * 1000);
  return expiresAt.toISOString();
}

export default function TeamScreen({ route, navigation }: Props): React.ReactElement {
  const { studioId, studioName, studioCity } = route.params;
  const { user } = useAuth();

  const {
    pendingNominations, teamCoaches, teamMembers, isCoach, loading,
    nominatePromotion, nominateDemotion, confirmNomination, rejectNomination,
  } = useCoachNominations();
  const { entitlement } = useEntitlement();

  const { announcement, postAnnouncement, deleteAnnouncement } = useAnnouncement();
  const { presentUserIds, loading: attendanceLoading, markPresent, unmarkPresent } = useAttendance(studioId);

  const [actionTarget, setActionTarget] = useState<Profile | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [nominationLoading, setNominationLoading] = useState<string | null>(null);

  // Announcement modal
  const [announcementVisible, setAnnouncementVisible] = useState(false);
  const [announcementDraft, setAnnouncementDraft] = useState('');
  const [announcementDuration, setAnnouncementDuration] = useState<AnnouncementDuration>('forever');
  const [announcementPosting, setAnnouncementPosting] = useState(false);

  // Attendance sheet
  const [attendanceVisible, setAttendanceVisible] = useState(false);

  // Studio schedule editor
  const [scheduleEditorOpen, setScheduleEditorOpen] = useState(false);
  const { schedule: studioSchedule, loading: scheduleLoading, refetch: refetchSchedule } = useSchedule(undefined, studioId);

  // Sparring sheet
  const [sparringSheetVisible, setSparringSheetVisible] = useState(false);
  const { createSparring } = useSparringActions();

  // Invite code
  const { code: inviteCode, loading: inviteLoading, error: inviteError, createInvite } = useStudioInvite();

  // Team weights: userId → kg
  const [teamWeights, setTeamWeights] = useState<Record<string, number>>({});

  useEffect(() => {
    if (teamMembers.length === 0) return;
    void fetchTeamWeights(teamMembers.map((m) => m.id)).then(setTeamWeights);
  }, [teamMembers]);

  async function handlePostAnnouncement(): Promise<void> {
    if (announcementDraft.trim().length === 0) return;
    setAnnouncementPosting(true);
    const result = await postAnnouncement(announcementDraft, durationToExpiresAt(announcementDuration));
    setAnnouncementPosting(false);
    if (result.error !== null) {
      Alert.alert('Fehler', result.error);
      return;
    }
    setAnnouncementDraft('');
    setAnnouncementDuration('forever');
    setAnnouncementVisible(false);
  }

  async function handleDeleteAnnouncement(): Promise<void> {
    const result = await deleteAnnouncement();
    if (result.error !== null) Alert.alert('Fehler', result.error);
  }

  // Members sorted by total_points descending
  const ranked = useMemo(
    () => [...teamMembers].sort((a, b) => b.total_points - a.total_points),
    [teamMembers],
  );

  // Compute available actions for a given member
  function sheetActionsFor(target: Profile): SheetAction[] {
    const hasPendingPromote = pendingNominations.some(
      (n) => n.nominee_id === target.id && n.type === 'promote',
    );
    const hasPendingDemote = pendingNominations.some(
      (n) => n.nominee_id === target.id && n.type === 'demote',
    );

    // Self: step down as coach
    if (target.id === user?.id && isCoach) {
      return [{ label: 'Trainer-Rolle abgeben', destructive: true, onPress: async () => nominateDemotion(target.id) }];
    }
    // No actions on own row when not a coach (self-nomination not allowed)
    if (target.id === user?.id) return [];

    const actions: SheetAction[] = [];
    const coachCount = teamCoaches.length;

    if (!target.is_coach && !hasPendingPromote && (coachCount === 0 || isCoach)) {
      actions.push({
        label: 'Als Trainer vorschlagen',
        onPress: async () => nominatePromotion(target.id),
      });
    }
    if (target.is_coach && isCoach && !hasPendingDemote) {
      actions.push({
        label: 'Trainer-Rolle entfernen',
        destructive: true,
        onPress: async () => nominateDemotion(target.id),
      });
    }
    return actions;
  }

  function hasActions(member: Profile): boolean {
    return sheetActionsFor(member).length > 0;
  }

  async function runSheetAction(action: SheetAction): Promise<void> {
    setActionLoading(true);
    const result = await action.onPress();
    setActionLoading(false);
    if (result.error !== null) {
      Alert.alert('Fehler', result.error);
      return;
    }
    setActionTarget(null);
  }

  async function handleNominationAction(
    nom: CoachNominationDetails,
    type: 'confirm' | 'reject',
  ): Promise<void> {
    setNominationLoading(nom.id);
    if (type === 'confirm') await confirmNomination(nom.id);
    else await rejectNomination(nom.id);
    setNominationLoading(null);
  }

  const sheetActions = actionTarget !== null ? sheetActionsFor(actionTarget) : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Dark header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left" size={18} color={colors.headerTextPrimary} />
        </TouchableOpacity>
        <Text style={styles.teamName}>{studioName}</Text>
        <Text style={styles.teamMeta}>
          {studioCity}
          {!loading && teamMembers.length > 0 ? `  ·  ${teamMembers.length} Mitglieder` : ''}
          {!loading && teamCoaches.length > 0 ? `  ·  ${teamCoaches.length} Trainer` : ''}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.accentBlue} />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* Coach actions */}
          {isCoach && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Trainer-Aktionen</Text>
              <View style={styles.coachActionRow}>
                <TouchableOpacity
                  style={styles.coachActionBtn}
                  onPress={() => setAttendanceVisible(true)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="account-check-outline" size={20} color={colors.accentBlue} />
                  <Text style={styles.coachActionLabel}>Anwesenheit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.coachActionBtn}
                  onPress={() => {
                    setAnnouncementDraft(announcement?.message ?? '');
                    setAnnouncementDuration(mapExpiresAtToDuration(announcement?.expires_at ?? null));
                    setAnnouncementVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="bullhorn-outline" size={20} color={colors.accentBlue} />
                  <Text style={styles.coachActionLabel}>Ankündigung</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.coachActionBtnWide, scheduleEditorOpen && styles.coachActionBtnActive]}
                onPress={() => setScheduleEditorOpen((v) => !v)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="calendar-edit"
                  size={20}
                  color={scheduleEditorOpen ? colors.headerTextPrimary : colors.accentBlue}
                />
                <Text style={[styles.coachActionLabel, scheduleEditorOpen && styles.coachActionLabelActive]}>
                  Stundenplan bearbeiten
                </Text>
              </TouchableOpacity>

              {scheduleEditorOpen && (
                <StudioScheduleSection
                  studioId={studioId}
                  schedule={studioSchedule}
                  loading={scheduleLoading}
                  onRefetch={refetchSchedule}
                />
              )}

              {entitlement?.tier === 'studio' && (
                <View style={styles.inviteCard}>
                  <View style={styles.inviteCardHeader}>
                    <Text style={styles.inviteCardLabel}>Einladungscode</Text>
                    <Text style={styles.seatCounter}>
                      {entitlement.usedSeats} / {entitlement.includedSeats + entitlement.extraSeats} Plätze belegt
                    </Text>
                  </View>
                  {inviteCode !== null ? (
                    <>
                      <Text style={styles.inviteCodeText}>{inviteCode}</Text>
                      <Text style={styles.inviteCodeHint}>Gültig für 7 Tage</Text>
                      <View style={styles.inviteCardActions}>
                        <TouchableOpacity
                          style={styles.inviteCardBtn}
                          onPress={() => {
                            void Share.share({ message: `Tritt unserem Team bei! Gib diesen Code in der Kombat App ein: ${inviteCode}` });
                          }}
                          activeOpacity={0.8}
                        >
                          <MaterialCommunityIcons name="share-outline" size={18} color={colors.accentBlue} />
                          <Text style={styles.inviteCardBtnLabel}>Teilen</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.inviteCardBtn}
                          onPress={() => { void createInvite(studioId); }}
                          disabled={inviteLoading}
                          activeOpacity={0.8}
                        >
                          <MaterialCommunityIcons name="refresh" size={18} color={colors.accentBlue} />
                          <Text style={styles.inviteCardBtnLabel}>Neu erstellen</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={styles.inviteGenerateBtn}
                      onPress={() => { void createInvite(studioId); }}
                      disabled={inviteLoading}
                      activeOpacity={0.8}
                    >
                      {inviteLoading ? (
                        <ActivityIndicator size="small" color={colors.accentBlue} />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="key-outline" size={18} color={colors.accentBlue} />
                          <Text style={styles.inviteGenerateBtnLabel}>Einladungscode erstellen</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                  {inviteError !== null && <Text style={styles.inviteErrorText}>{inviteError}</Text>}
                </View>
              )}

              {isCoach && (
                <TouchableOpacity
                  style={styles.sparringBtn}
                  onPress={() => setSparringSheetVisible(true)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="boxing-glove" size={20} color={colors.accentBlue} />
                  <Text style={styles.sparringBtnText}>Sparring planen</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Pending nominations */}
          {pendingNominations.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Offene Nominierungen</Text>
              <View style={styles.nominationList}>
                {pendingNominations.map((nom) => (
                  <NominationCard
                    key={nom.id}
                    nomination={nom}
                    loading={nominationLoading === nom.id}
                    onConfirm={() => { void handleNominationAction(nom, 'confirm'); }}
                    onReject={() => { void handleNominationAction(nom, 'reject'); }}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Ranking */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Ranking</Text>
            {entitlement.hasAccess ? (
              <View style={styles.rankingCard}>
                {ranked.map((member, idx) => (
                  <TeamMemberRow
                    key={member.id}
                    rank={idx + 1}
                    member={member}
                    isCurrentUser={member.id === user?.id}
                    hasActions={hasActions(member)}
                    weightKg={member.show_weight_in_group !== false ? (teamWeights[member.id] ?? null) : null}
                    onActionPress={() => setActionTarget(member)}
                  />
                ))}
                {ranked.length === 0 && (
                  <Text style={styles.emptyText}>Noch keine Mitglieder.</Text>
                )}
              </View>
            ) : (
              <PaywallCard
                title="Team-Ranking im Abo"
                message="Punkte-Ranking und erweiterte Team-Statistiken sind nur mit einem aktiven Abo verfügbar."
                onPressCta={() => navigation.navigate('Paywall')}
              />
            )}
          </View>

        </ScrollView>
      )}

      {/* Attendance sheet */}
      <AttendanceSheet
        visible={attendanceVisible}
        members={ranked}
        presentUserIds={presentUserIds}
        loadingAttendance={attendanceLoading}
        onMark={async (id) => { const r = await markPresent(id); if (r.error !== null) Alert.alert('Fehler', r.error); }}
        onUnmark={async (id) => { const r = await unmarkPresent(id); if (r.error !== null) Alert.alert('Fehler', r.error); }}
        onClose={() => setAttendanceVisible(false)}
      />

      {/* Announcement modal */}
      <Modal
        visible={announcementVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAnnouncementVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setAnnouncementVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.announcementHeader}>
              <Text style={styles.sheetTitle}>Ankündigung</Text>
              {announcement !== null && (
                <TouchableOpacity onPress={() => { void handleDeleteAnnouncement(); setAnnouncementVisible(false); }}>
                  <Text style={styles.deleteAnnouncementLabel}>Löschen</Text>
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={styles.announcementInput}
              placeholder="Nachricht für dein Team..."
              placeholderTextColor={colors.textSecondary}
              value={announcementDraft}
              onChangeText={setAnnouncementDraft}
              multiline
              maxLength={500}
              autoFocus
            />
            <View style={styles.durationSection}>
              <Text style={styles.durationLabel}>Sichtbar für</Text>
              <View style={styles.durationRow}>
                {ANNOUNCEMENT_DURATION_OPTIONS.map((option) => {
                  const selected = option.value === announcementDuration;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.durationChip, selected && styles.durationChipActive]}
                      onPress={() => setAnnouncementDuration(option.value)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.durationChipLabel, selected && styles.durationChipLabelActive]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <Text style={styles.charCount}>{announcementDraft.length}/500</Text>
            <TouchableOpacity
              style={[styles.postBtn, announcementDraft.trim().length === 0 && styles.postBtnDisabled]}
              onPress={() => { void handlePostAnnouncement(); }}
              disabled={announcementPosting || announcementDraft.trim().length === 0}
              activeOpacity={0.8}
            >
              {announcementPosting ? (
                <ActivityIndicator size="small" color={colors.headerTextPrimary} />
              ) : (
                <Text style={styles.postBtnLabel}>Veröffentlichen</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Action sheet */}
      <Modal
        visible={actionTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setActionTarget(null)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setActionTarget(null)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{actionTarget?.name ?? 'Mitglied'}</Text>
            {sheetActions.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={[styles.sheetBtn, action.destructive === true && styles.sheetBtnDestructive]}
                onPress={() => { void runSheetAction(action); }}
                disabled={actionLoading}
                activeOpacity={0.8}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={action.destructive === true ? colors.deleteRed : colors.textPrimary} />
                ) : (
                  <Text style={[styles.sheetBtnLabel, action.destructive === true && styles.sheetBtnLabelDestructive]}>
                    {action.label}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.sheetCancel} onPress={() => setActionTarget(null)} activeOpacity={0.7}>
              <Text style={styles.sheetCancelLabel}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sparring sheet */}
      <CreateSparringSheet
        visible={sparringSheetVisible}
        studioId={route.params.studioId}
        onClose={() => setSparringSheetVisible(false)}
        onCreate={async (params) => {
          const { error } = await createSparring(params);
          if (error !== null) {
            Alert.alert('Fehler', error);
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // Header
  header: { backgroundColor: colors.dark, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.headerCard,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  teamName: { fontSize: 26, fontWeight: '700', color: colors.headerTextPrimary, marginBottom: 4 },
  teamMeta: { fontSize: 13, color: colors.headerTextSecondary, fontWeight: '400' },

  loader: { marginTop: 48 },
  scroll: { flex: 1 },
  content: { paddingTop: 24, paddingBottom: 48, gap: 24 },

  section: { gap: 10, paddingHorizontal: 16 },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  nominationList: { gap: 10 },
  rankingCard: {
    backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
  },
  emptyText: { fontSize: 14, color: colors.textSecondary, padding: 16, textAlign: 'center' },

  // Action sheet
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, gap: 10,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  sheetBtn: {
    height: 52, borderRadius: 14, backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetBtnDestructive: { backgroundColor: 'rgba(217,74,74,0.08)', borderColor: 'rgba(217,74,74,0.3)' },
  sheetBtnLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  sheetBtnLabelDestructive: { color: colors.deleteRed },
  sheetCancel: {
    height: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  sheetCancelLabel: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },

  // Coach actions
  coachActionRow: { flexDirection: 'row', gap: 12 },
  coachActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 48, borderRadius: 14,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  coachActionLabel: { fontSize: 14, fontWeight: '600', color: colors.accentBlue },
  coachActionBtnWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  coachActionBtnActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  coachActionLabelActive: { color: colors.headerTextPrimary },

  // Announcement modal
  announcementHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  deleteAnnouncementLabel: { fontSize: 14, fontWeight: '600', color: colors.deleteRed },
  announcementInput: {
    backgroundColor: colors.background, borderRadius: 12, padding: 12,
    fontSize: 15, color: colors.textPrimary, minHeight: 96,
    textAlignVertical: 'top', borderWidth: 1, borderColor: colors.border,
  },
  durationSection: { gap: 8, marginTop: 16 },
  durationLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  durationRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  durationChip: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationChipActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  durationChipLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  durationChipLabelActive: { color: colors.headerTextPrimary },
  charCount: { fontSize: 11, color: colors.textSecondary, textAlign: 'right', marginTop: 4 },
  postBtn: {
    height: 52, borderRadius: 14, backgroundColor: colors.dark,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  postBtnDisabled: { opacity: 0.4 },
  postBtnLabel: { fontSize: 15, fontWeight: '700', color: colors.headerTextPrimary },

  // Invite code card
  inviteCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
    marginTop: 8,
  },
  inviteCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inviteCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  seatCounter: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  inviteCodeText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.accentBlue,
    letterSpacing: 4,
  },
  inviteCodeHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: -4,
  },
  inviteCardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  inviteCardBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inviteCardBtnLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  inviteGenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  inviteGenerateBtnLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  inviteErrorText: {
    fontSize: 12,
    color: colors.deleteRed,
    marginTop: 4,
  },

  // Sparring button
  sparringBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.accentBlueSoft,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 16,
  },
  sparringBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accentBlue,
  },
});
