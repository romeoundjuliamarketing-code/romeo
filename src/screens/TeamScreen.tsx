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
import NominationCard from '../components/team/NominationCard';
import AttendanceSheet from '../components/team/AttendanceSheet';
import StudioScheduleSection from '../components/team/StudioScheduleSection';
import PaywallCard from '../components/common/PaywallCard';
import CreateSparringSheet from '../components/sparring/CreateSparringSheet';
import { useSparringActions } from '../hooks/useSparringActions';
import { useStudioAddress } from '../hooks/useStudioAddress';
import { useStudioSparrings } from '../hooks/useStudioSparrings';
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

const MEMBER_COLORS = [
  '#4A90D9', '#E05252', '#52A86E', '#E07A52',
  '#7B52C4', '#52A8A8', '#D4B942', '#C052A8',
];

function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

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
    '1d': 1, '3d': 3, '1w': 7,
  };
  return new Date(Date.now() + daysByDuration[duration] * 24 * 60 * 60 * 1000).toISOString();
}

export default function TeamScreen({ route, navigation }: Props): React.ReactElement {
  const { studioId, studioName } = route.params;
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
  const [membersExpanded, setMembersExpanded] = useState(false);

  const [announcementVisible, setAnnouncementVisible] = useState(false);
  const [announcementDraft, setAnnouncementDraft] = useState('');
  const [announcementDuration, setAnnouncementDuration] = useState<AnnouncementDuration>('forever');
  const [announcementPosting, setAnnouncementPosting] = useState(false);

  const [attendanceVisible, setAttendanceVisible] = useState(false);
  const [scheduleEditorOpen, setScheduleEditorOpen] = useState(false);
  const { schedule: studioSchedule, loading: scheduleLoading, refetch: refetchSchedule } = useSchedule(undefined, studioId);

  const [sparringSheetVisible, setSparringSheetVisible] = useState(false);
  const { createSparring, deactivateSparring } = useSparringActions();
  const { sparrings: studioSparrings, refetch: refetchSparrings } = useStudioSparrings(studioId);

  const { address: studioAddress, loading: addressLoading, updateAddress } = useStudioAddress(studioId);
  const [addressDraft, setAddressDraft] = useState('');
  const [addressEditing, setAddressEditing] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);

  const { code: inviteCode, loading: inviteLoading, error: inviteError, createInvite } = useStudioInvite();

  const [teamWeights, setTeamWeights] = useState<Record<string, number>>({});
  useEffect(() => {
    if (teamMembers.length === 0) return;
    void fetchTeamWeights(teamMembers.map((m) => m.id)).then(setTeamWeights);
  }, [teamMembers]);

  const ranked = useMemo(
    () => [...teamMembers].sort((a, b) => b.total_points - a.total_points),
    [teamMembers],
  );

  const teamXP = useMemo(
    () => teamMembers.reduce((sum, m) => sum + m.total_points, 0),
    [teamMembers],
  );

  const nextSparring = useMemo(() => {
    const now = new Date();
    return studioSparrings
      .filter((s) => new Date(s.scheduled_at) > now)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0] ?? null;
  }, [studioSparrings]);

  const totalSeats = entitlement.includedSeats + entitlement.extraSeats;
  const freeSeats = totalSeats - entitlement.usedSeats;

  async function handleSaveAddress(): Promise<void> {
    if (addressDraft.trim().length === 0) return;
    setAddressSaving(true);
    const { error } = await updateAddress(addressDraft);
    setAddressSaving(false);
    if (error !== null) { Alert.alert('Fehler', error); return; }
    setAddressEditing(false);
  }

  function handleCancelSparring(sparringId: string, title: string): void {
    Alert.alert('Sparring absagen', `"${title}" wirklich absagen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Absagen', style: 'destructive',
        onPress: async () => {
          const { error } = await deactivateSparring(sparringId);
          if (error !== null) Alert.alert('Fehler', error);
          else refetchSparrings();
        },
      },
    ]);
  }

  async function handlePostAnnouncement(): Promise<void> {
    if (announcementDraft.trim().length === 0) return;
    setAnnouncementPosting(true);
    const result = await postAnnouncement(announcementDraft, durationToExpiresAt(announcementDuration));
    setAnnouncementPosting(false);
    if (result.error !== null) { Alert.alert('Fehler', result.error); return; }
    setAnnouncementDraft('');
    setAnnouncementDuration('forever');
    setAnnouncementVisible(false);
  }

  async function handleDeleteAnnouncement(): Promise<void> {
    const result = await deleteAnnouncement();
    if (result.error !== null) Alert.alert('Fehler', result.error);
  }

  function sheetActionsFor(target: Profile): SheetAction[] {
    const hasPendingPromote = pendingNominations.some(
      (n) => n.nominee_id === target.id && n.type === 'promote',
    );
    const hasPendingDemote = pendingNominations.some(
      (n) => n.nominee_id === target.id && n.type === 'demote',
    );
    if (target.id === user?.id && isCoach) {
      return [{ label: 'Trainer-Rolle abgeben', destructive: true, onPress: async () => nominateDemotion(target.id) }];
    }
    if (target.id === user?.id) return [];
    const actions: SheetAction[] = [];
    const coachCount = teamCoaches.length;
    if (!target.is_coach && !hasPendingPromote && (coachCount === 0 || isCoach)) {
      actions.push({ label: 'Als Trainer vorschlagen', onPress: async () => nominatePromotion(target.id) });
    }
    if (target.is_coach && isCoach && !hasPendingDemote) {
      actions.push({ label: 'Trainer-Rolle entfernen', destructive: true, onPress: async () => nominateDemotion(target.id) });
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
    if (result.error !== null) { Alert.alert('Fehler', result.error); return; }
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

      {/* ── 1. Dark Hero Header ── */}
      <View style={styles.hero}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-left" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.heroName}>{studioName}</Text>
        {!addressLoading && studioAddress !== null && (
          <View style={styles.heroAddressRow}>
            <Text style={styles.heroAddress} numberOfLines={1}>{studioAddress}</Text>
            {isCoach && (
              <TouchableOpacity
                onPress={() => { setAddressDraft(studioAddress); setAddressEditing(true); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="pencil-outline" size={13} color="rgba(255,255,255,0.45)" />
              </TouchableOpacity>
            )}
          </View>
        )}
        {!addressLoading && studioAddress === null && isCoach && (
          <TouchableOpacity onPress={() => { setAddressDraft(''); setAddressEditing(true); }}>
            <Text style={styles.heroAddressAdd}>Adresse hinzufügen</Text>
          </TouchableOpacity>
        )}
        {!loading && (
          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <Text style={styles.pillValue}>{teamMembers.length}</Text>
              <Text style={styles.pillLabel}>Mitglieder</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillValue}>{teamCoaches.length}</Text>
              <Text style={styles.pillLabel}>Trainer</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillValue}>{teamXP.toLocaleString('de-DE')}</Text>
              <Text style={styles.pillLabel}>Team-XP</Text>
            </View>
          </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.accentBlue} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >

          {/* ── 2. Nächstes Sparring ── */}
          {nextSparring !== null && (
            <View style={styles.sparringCard}>
              <Text style={styles.sparringCardEyebrow}>Nächstes Sparring</Text>
              <Text style={styles.sparringCardTitle}>{nextSparring.title}</Text>
              <View style={styles.sparringCardMeta}>
                <Text style={styles.sparringCardMetaText}>
                  {new Date(nextSparring.scheduled_at).toLocaleDateString('de-DE', {
                    day: '2-digit', month: '2-digit', year: '2-digit',
                  })}
                  {' · '}
                  {new Date(nextSparring.scheduled_at).toLocaleTimeString('de-DE', {
                    hour: '2-digit', minute: '2-digit',
                  })} Uhr
                </Text>
                <View style={styles.signupBadge}>
                  <Text style={styles.signupBadgeText}>
                    {nextSparring.signup_count} / {nextSparring.max_slots} Angemeldet
                  </Text>
                </View>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { flex: nextSparring.signup_count }]} />
                <View style={{ flex: Math.max(0, nextSparring.max_slots - nextSparring.signup_count) }} />
              </View>
            </View>
          )}

          {/* ── 3. Mitglieder ── */}
          <View style={styles.card}>
            <Text style={styles.cardSectionLabel}>Mitglieder</Text>
            {entitlement.hasAccess ? (
              <>
                {(membersExpanded ? ranked : ranked.slice(0, 3)).map((member, idx) => {
                  const avatarColor = MEMBER_COLORS[idx % MEMBER_COLORS.length];
                  return (
                    <TouchableOpacity
                      key={member.id}
                      style={[styles.memberRow, idx > 0 && styles.memberRowBorder]}
                      onPress={hasActions(member) ? () => setActionTarget(member) : undefined}
                      activeOpacity={hasActions(member) ? 0.7 : 1}
                    >
                      <View style={[styles.memberAvatar, { backgroundColor: avatarColor }]}>
                        <Text style={styles.memberAvatarText}>{getInitials(member.name)}</Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName} numberOfLines={1}>
                          {member.name ?? 'Unbekannt'}
                          {member.id === user?.id ? '  (Du)' : ''}
                        </Text>
                        <Text style={styles.memberRole}>
                          {member.is_coach ? 'Trainer' : 'Mitglied'}
                        </Text>
                      </View>
                      <Text style={styles.memberXP}>{member.total_points} XP</Text>
                      {hasActions(member) && (
                        <MaterialCommunityIcons name="dots-horizontal" size={18} color={colors.textSecondary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
                {ranked.length > 3 && (
                  <TouchableOpacity
                    style={styles.showMoreRow}
                    onPress={() => setMembersExpanded((v) => !v)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.showMoreText}>
                      {membersExpanded ? 'Weniger anzeigen' : `+${ranked.length - 3} weitere`}
                    </Text>
                    <MaterialCommunityIcons
                      name={membersExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.accentBlue}
                    />
                  </TouchableOpacity>
                )}
                {ranked.length === 0 && (
                  <Text style={styles.emptyText}>Noch keine Mitglieder.</Text>
                )}
              </>
            ) : (
              <PaywallCard
                title="Team-Ranking im Abo"
                message="Punkte-Ranking und erweiterte Team-Statistiken sind nur mit einem aktiven Abo verfügbar."
                onPressCta={() => navigation.navigate('Paywall')}
              />
            )}
          </View>

          {/* ── 4. Trainer-Aktionen ── */}
          {isCoach && (
            <View style={styles.card}>
              <Text style={styles.cardSectionLabel}>Trainer-Aktionen</Text>

              <View style={styles.coachGrid}>
                <TouchableOpacity
                  style={styles.coachGridBtn}
                  onPress={() => setAttendanceVisible(true)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="account-check-outline" size={22} color={colors.accentBlue} />
                  <Text style={styles.coachGridLabel}>Anwesenheit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.coachGridBtn}
                  onPress={() => {
                    setAnnouncementDraft(announcement?.message ?? '');
                    setAnnouncementDuration(mapExpiresAtToDuration(announcement?.expires_at ?? null));
                    setAnnouncementVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="bullhorn-outline" size={22} color={colors.accentBlue} />
                  <Text style={styles.coachGridLabel}>Ankündigung</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.coachFullBtn, scheduleEditorOpen && styles.coachFullBtnActive]}
                onPress={() => setScheduleEditorOpen((v) => !v)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="calendar-edit"
                  size={20}
                  color={scheduleEditorOpen ? '#fff' : colors.text}
                />
                <Text style={[styles.coachFullBtnLabel, scheduleEditorOpen && styles.coachFullBtnLabelActive]}>
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

              <TouchableOpacity
                style={styles.coachFullBtnDark}
                onPress={() => setSparringSheetVisible(true)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="sword-cross" size={20} color="#fff" />
                <Text style={styles.coachFullBtnDarkLabel}>Offenes Sparring planen</Text>
              </TouchableOpacity>

              {/* Address editing (inline, appears when pencil tapped in hero) */}
              {addressEditing && (
                <View style={styles.addressEditArea}>
                  <TextInput
                    style={styles.addressInput}
                    value={addressDraft}
                    onChangeText={setAddressDraft}
                    placeholder="Straße, Hausnummer, Stadt"
                    placeholderTextColor={colors.textSecondary}
                    autoFocus
                  />
                  <View style={styles.addressBtnRow}>
                    <TouchableOpacity
                      style={styles.addressCancelBtn}
                      onPress={() => setAddressEditing(false)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.addressCancelLabel}>Abbrechen</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.addressSaveBtn,
                        (addressSaving || addressDraft.trim().length === 0) && styles.addressSaveBtnDisabled,
                      ]}
                      onPress={() => { void handleSaveAddress(); }}
                      disabled={addressSaving || addressDraft.trim().length === 0}
                      activeOpacity={0.8}
                    >
                      {addressSaving ? (
                        <ActivityIndicator size="small" color={colors.card} />
                      ) : (
                        <Text style={styles.addressSaveLabel}>Speichern</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Geplante Sparrings (Coach-Liste) */}
              {studioSparrings.length > 0 && (
                <View style={styles.plannedSparrings}>
                  <Text style={styles.plannedSparringsLabel}>Geplante Sparrings</Text>
                  {studioSparrings.map((s) => {
                    const d = new Date(s.scheduled_at);
                    const dateStr = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                    const timeStr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <View key={s.id} style={styles.plannedSparringRow}>
                        <View style={styles.plannedSparringInfo}>
                          <Text style={styles.plannedSparringTitle} numberOfLines={1}>{s.title}</Text>
                          <Text style={styles.plannedSparringMeta}>
                            {dateStr} · {timeStr} · {s.signup_count}/{s.max_slots} Angemeldet
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleCancelSparring(s.id, s.title)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <MaterialCommunityIcons name="close-circle-outline" size={20} color={colors.deleteRed} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ── 5. Offene Nominierungen ── */}
          {pendingNominations.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardSectionLabel}>Offene Nominierungen</Text>
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
          )}

          {/* ── 6. Einladungscode ── */}
          {isCoach && entitlement.tier === 'studio' && (
            <View style={styles.card}>
              <Text style={styles.cardSectionLabel}>Einladungscode</Text>
              {inviteCode !== null ? (
                <>
                  <View style={styles.inviteCodeRow}>
                    <Text style={styles.inviteCodeText}>{inviteCode}</Text>
                    <TouchableOpacity
                      style={styles.inviteCopyBtn}
                      onPress={() => {
                        void Share.share({
                          message: `Tritt unserem Team bei! Gib diesen Code in der Kombat App ein: ${inviteCode}`,
                        });
                      }}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons name="content-copy" size={16} color={colors.accentBlue} />
                      <Text style={styles.inviteCopyLabel}>Kopieren</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.inviteValidText}>Gültig für 7 Tage</Text>
                  {totalSeats > 0 && (
                    <>
                      <Text style={styles.inviteCapacityText}>
                        {entitlement.usedSeats} von {totalSeats} Plätzen belegt · {freeSeats} frei
                      </Text>
                      <View style={styles.capacityTrack}>
                        <View style={[styles.capacityFill, { flex: entitlement.usedSeats }]} />
                        <View style={[styles.capacityEmpty, { flex: Math.max(0, totalSeats - entitlement.usedSeats) }]} />
                      </View>
                    </>
                  )}
                  <TouchableOpacity
                    style={styles.inviteRefreshBtn}
                    onPress={() => { void createInvite(studioId); }}
                    disabled={inviteLoading}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="refresh" size={16} color={colors.textSecondary} />
                    <Text style={styles.inviteRefreshLabel}>Neu erstellen</Text>
                  </TouchableOpacity>
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
                      <Text style={styles.inviteGenerateLabel}>Einladungscode erstellen</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              {inviteError !== null && <Text style={styles.inviteErrorText}>{inviteError}</Text>}
            </View>
          )}

          <View style={styles.bottomPad} />
        </ScrollView>
      )}

      {/* ── Attendance Sheet ── */}
      <AttendanceSheet
        visible={attendanceVisible}
        members={ranked}
        presentUserIds={presentUserIds}
        loadingAttendance={attendanceLoading}
        onMark={async (id) => { const r = await markPresent(id); if (r.error !== null) Alert.alert('Fehler', r.error); }}
        onUnmark={async (id) => { const r = await unmarkPresent(id); if (r.error !== null) Alert.alert('Fehler', r.error); }}
        onClose={() => setAttendanceVisible(false)}
      />

      {/* ── Announcement Modal ── */}
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
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.postBtnLabel}>Veröffentlichen</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Action Sheet ── */}
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

      {/* ── Sparring Sheet ── */}
      <CreateSparringSheet
        visible={sparringSheetVisible}
        studioId={route.params.studioId}
        onClose={() => setSparringSheetVisible(false)}
        onCreate={async (params) => {
          const { error } = await createSparring(params);
          if (error !== null) Alert.alert('Fehler', error);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // ── Hero ──
  hero: {
    backgroundColor: colors.dark,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 4,
  },
  heroAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  heroAddress: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    flex: 1,
  },
  heroAddressAdd: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 16,
    textDecorationLine: 'underline',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  pill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 2,
  },
  pillValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  pillLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },

  loader: { marginTop: 48 },
  scroll: { flex: 1 },
  content: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 48, gap: 16 },

  // ── Nächstes Sparring ──
  sparringCard: {
    backgroundColor: colors.accentBlue,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  sparringCardEyebrow: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sparringCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  sparringCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sparringCardMetaText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  signupBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  signupBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  progressTrack: {
    flexDirection: 'row',
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    backgroundColor: '#fff',
    borderRadius: 2,
  },

  // ── Cards ──
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  cardSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // ── Members ──
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  memberRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  memberRole: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  memberXP: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  showMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  showMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 8,
  },

  // ── Coach Actions ──
  coachGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  coachGridBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  coachGridLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  coachFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  coachFullBtnActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  coachFullBtnLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  coachFullBtnLabelActive: {
    color: '#fff',
  },
  coachFullBtnDark: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.dark,
  },
  coachFullBtnDarkLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },

  // ── Planned Sparrings (coach list) ──
  plannedSparrings: { gap: 8 },
  plannedSparringsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  plannedSparringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  plannedSparringInfo: { flex: 1, gap: 2 },
  plannedSparringTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  plannedSparringMeta: { fontSize: 11, color: colors.textSecondary },

  // ── Address Edit ──
  addressEditArea: { gap: 8 },
  addressInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addressBtnRow: { flexDirection: 'row', gap: 8 },
  addressCancelBtn: {
    flex: 1, height: 40, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  addressCancelLabel: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  addressSaveBtn: {
    flex: 1, height: 40, borderRadius: 10,
    backgroundColor: colors.accentBlue,
    alignItems: 'center', justifyContent: 'center',
  },
  addressSaveBtnDisabled: { opacity: 0.5 },
  addressSaveLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // ── Invite Code ──
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inviteCodeText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.accentBlue,
    letterSpacing: 3,
    fontVariant: ['tabular-nums'],
  },
  inviteCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inviteCopyLabel: { fontSize: 13, fontWeight: '600', color: colors.accentBlue },
  inviteValidText: { fontSize: 12, color: colors.textSecondary },
  inviteCapacityText: { fontSize: 12, color: colors.textSecondary },
  capacityTrack: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  capacityFill: { backgroundColor: colors.accentBlue },
  capacityEmpty: { backgroundColor: 'transparent' },
  inviteRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  inviteRefreshLabel: { fontSize: 12, color: colors.textSecondary },
  inviteGenerateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 44, borderRadius: 10,
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
  },
  inviteGenerateLabel: { fontSize: 14, fontWeight: '600', color: colors.accentBlue },
  inviteErrorText: { fontSize: 12, color: colors.deleteRed },

  // ── Modals ──
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
    height: 40, paddingHorizontal: 16, borderRadius: 18,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  durationChipActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  durationChipLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  durationChipLabelActive: { color: '#fff' },
  charCount: { fontSize: 11, color: colors.textSecondary, textAlign: 'right', marginTop: 4 },
  postBtn: {
    height: 52, borderRadius: 14, backgroundColor: colors.dark,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  postBtnDisabled: { opacity: 0.4 },
  postBtnLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },

  bottomPad: { height: 32 },
});
