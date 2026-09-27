import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';
import type { FightRecord, ReportReason } from '../types/database.types';
import { supabase } from '../lib/supabase';
import { useSparringRatings } from '../hooks/useSparringRatings';
import { useUserReport }      from '../hooks/useUserReport';
import { SHOW_SPARRING_STARS } from '../data/sparringConfig';
import FightRecordCard        from '../components/profil/FightRecordCard';
import type { FighterCardData } from '../components/profil/FighterCard';
import ProfileHeader          from '../components/profil/ProfileHeader';
import ProfileShareSheet      from '../components/profil/ProfileShareSheet';
import {
  ProfileToolbar,
  PrimaryButton,
  SecondaryButton,
  ProfileSection,
  SectionDivider,
  FactList,
} from '../components/profil/ProfileParts';
import SparringActivityCard   from '../components/profil/SparringActivityCard';
import ProfileQrShareSheet    from '../components/profil/ProfileQrShareSheet';
import { useAuth }            from '../context/AuthContext';
import { getInitials }        from '../utils/initials';
import { cardBackFacts, trainingFacts } from '../utils/athleteProfile';
import { instagramProfileUrl } from '../utils/profileDraft';
import type { CardFrameId }   from '../data/cardFrames';
import type { Stance }        from '../utils/stance';

// ── constants ──────────────────────────────────────────────────────────────────

const STAR_LABELS: Record<number, string> = {
  1: 'Nicht empfehlenswert',
  2: 'War okay',
  3: 'Guter Sparringspartner',
  4: 'Sehr empfehlenswert',
  5: 'Immer wieder gerne',
};

const REPORT_OPTIONS: { value: ReportReason; label: string }[] = [
  { value: 'unsportliches_verhalten', label: 'Unsportliches Verhalten'  },
  { value: 'gefaehrliches_verhalten', label: 'Gefährliches Verhalten'   },
  { value: 'beleidigung',             label: 'Beleidigung / Harassment' },
];

// ── types ──────────────────────────────────────────────────────────────────────


interface PublicProfile {
  name:              string | null;
  age_years:         number | null;
  avatar_url:        string | null;
  gender:            string | null;
  disciplines:       string[];
  show_fight_record: boolean;
  coach_verified_at: string | null;
  studio_id:         string | null;
  nickname:          string | null;
  weight_class:      string | null;
  weight_kg:         number | null;
  height_cm:         number | null;
  arm_span_cm:       number | null;
  nationality:       string | null;
  hometown:          string | null;
  bio:               string | null;
  instagram_url:     string | null;
  profile_code:      string;
  stance:            Stance | null;
  training_since:    string | null;
  training_frequency: string | null;
  is_professional:   boolean | null;
  card_frame:        CardFrameId | null;
  motto:             string | null;
  favorite_move:     string | null;
  training_focus:    string | null;
}

interface CurrentUserCoachInfo {
  is_coach:  boolean;
  studio_id: string | null;
}

interface StudioInfo {
  name: string;
  city: string;
}

// ── component ──────────────────────────────────────────────────────────────────

type NavProp    = NativeStackNavigationProp<RootStackParamList, 'PublicProfile'>;
type RoutePropT = RouteProp<RootStackParamList, 'PublicProfile'>;

export default function PublicProfileScreen(): React.ReactElement {
  const navigation = useNavigation<NavProp>();
  const { params }  = useRoute<RoutePropT>();
  const { userId, sparringId, sparringScheduledAt } = params;

  const { user } = useAuth();
  const currentUserId = user?.id ?? null;

  const [profile,        setProfile]        = useState<PublicProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [studio,         setStudio]         = useState<StudioInfo | null>(null);
  // "Profil teilen": preview of the collectible fighter card
  const [shareVisible,   setShareVisible]   = useState(false);

  const [currentUserCoach, setCurrentUserCoach] = useState<CurrentUserCoachInfo | null>(null);

  const [vouching, setVouching] = useState(false);
  const [vouched,  setVouched]  = useState(false);

  const [ratingTrigger, setRatingTrigger] = useState(0);
  const { averageStars, ratingCount, existingRating, submitRating, canRate } =
    useSparringRatings(userId, sparringId ?? '', ratingTrigger);

  const { submitReport } = useUserReport();

  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedStars,      setSelectedStars]      = useState(0);
  const [ratingComment,      setRatingComment]      = useState('');
  const [ratingSubmitting,   setRatingSubmitting]   = useState(false);

  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedReason,     setSelectedReason]     = useState<ReportReason | null>(null);
  const [reportDetails,      setReportDetails]      = useState('');
  const [reportSubmitting,   setReportSubmitting]   = useState(false);
  const [reportConfirmed,    setReportConfirmed]    = useState(false);

  const [targetFights,        setTargetFights]        = useState<FightRecord[]>([]);
  const [targetFightsLoading, setTargetFightsLoading] = useState(true);

  const [qrSheetVisible, setQrSheetVisible] = useState(false);

  // Load public profile
  useEffect(() => {
    let cancelled = false;
    setProfileLoading(true);
    void supabase
      .from('profiles')
      .select('name, age_years, avatar_url, gender, disciplines, show_fight_record, coach_verified_at, studio_id, nickname, weight_class, weight_kg, height_cm, arm_span_cm, nationality, hometown, bio, instagram_url, profile_code, stance, training_since, training_frequency, is_professional, card_frame, motto, favorite_move, training_focus')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        if (data !== null) {
          setProfile({
            name:              data.name,
            age_years:         data.age_years,
            avatar_url:        data.avatar_url,
            gender:            data.gender ?? null,
            disciplines:       (data.disciplines as string[]) ?? [],
            show_fight_record: (data.show_fight_record as boolean) ?? true,
            coach_verified_at: data.coach_verified_at ?? null,
            studio_id:         data.studio_id ?? null,
            nickname:          data.nickname ?? null,
            weight_class:      data.weight_class ?? null,
            weight_kg:         data.weight_kg ?? null,
            height_cm:         data.height_cm ?? null,
            arm_span_cm:       data.arm_span_cm ?? null,
            nationality:       data.nationality ?? null,
            hometown:          data.hometown ?? null,
            bio:               data.bio ?? null,
            instagram_url:     data.instagram_url ?? null,
            profile_code:      (data.profile_code as string) ?? '',
            stance:            (data.stance as Stance | null) ?? null,
            training_since:    data.training_since ?? null,
            training_frequency: data.training_frequency ?? null,
            is_professional:   data.is_professional ?? null,
            card_frame:        data.card_frame ?? null,
            motto:             data.motto ?? null,
            favorite_move:     data.favorite_move ?? null,
            training_focus:    data.training_focus ?? null,
          });
        }
        setProfileLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  // Load studio info once profile has studio_id
  useEffect(() => {
    if (profile?.studio_id === null || profile?.studio_id === undefined) return;
    void supabase
      .from('studios')
      .select('name, city')
      .eq('id', profile.studio_id)
      .single()
      .then(({ data }) => {
        if (data !== null) setStudio({ name: data.name as string, city: data.city as string });
      });
  }, [profile?.studio_id]);

  // Load target fight record
  useEffect(() => {
    let cancelled = false;
    setTargetFightsLoading(true);
    void supabase
      .from('fight_records')
      .select('*')
      .eq('user_id', userId)
      .order('fight_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) {
          setTargetFights((data ?? []) as FightRecord[]);
          setTargetFightsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [userId]);

  // Load current user's coach info for vouch visibility
  useEffect(() => {
    if (currentUserId === null || currentUserId === userId) return;
    let cancelled = false;
    void supabase
      .from('profiles')
      .select('is_coach, studio_id')
      .eq('id', currentUserId)
      .single()
      .then(({ data }) => {
        if (cancelled || data === null) return;
        setCurrentUserCoach({ is_coach: data.is_coach, studio_id: data.studio_id ?? null });
      });
    return () => { cancelled = true; };
  }, [currentUserId, userId]);

  // ── handlers ──────────────────────────────────────────────────────────────────

  const handleVouch = useCallback(async () => {
    setVouching(true);
    const { error } = await supabase.rpc('verify_member', { p_user_id: userId });
    setVouching(false);
    if (error === null) setVouched(true);
  }, [userId]);


  const handleSubmitRating = useCallback(async () => {
    if (selectedStars === 0 || ratingComment.trim().length === 0) return;
    setRatingSubmitting(true);
    const { error } = await submitRating(sparringId ?? '', userId, selectedStars, ratingComment.trim());
    setRatingSubmitting(false);
    if (error !== null) { Alert.alert('Fehler', error); return; }
    setRatingModalVisible(false);
    setRatingTrigger((n) => n + 1);
  }, [selectedStars, ratingComment, submitRating, sparringId, userId]);

  const handleSubmitReport = useCallback(async () => {
    if (selectedReason === null) return;
    setReportSubmitting(true);
    const { error } = await submitReport(
      userId,
      sparringId ?? '',
      selectedReason,
      reportDetails.trim().length > 0 ? reportDetails.trim() : undefined,
    );
    setReportSubmitting(false);
    if (error !== null) { Alert.alert('Fehler', error); return; }
    setReportConfirmed(true);
  }, [selectedReason, reportDetails, submitReport, userId, sparringId]);

  // ── derived values ────────────────────────────────────────────────────────────

  const canRateNow =
    SHOW_SPARRING_STARS &&
    sparringId !== undefined &&
    sparringScheduledAt !== undefined &&
    canRate(sparringScheduledAt) &&
    existingRating === null;

  const canVouch =
    currentUserCoach !== null &&
    currentUserCoach.is_coach === true &&
    currentUserCoach.studio_id !== null &&
    currentUserCoach.studio_id === profile?.studio_id &&
    currentUserId !== userId &&
    profile?.coach_verified_at == null;

  // Existing meaning: confirmed by a coach of the studio (or just vouched).
  const isVerified = profile?.coach_verified_at != null || vouched;
  const training   = profile !== null ? trainingFacts(profile) : [];
  const bio        = profile?.bio?.trim() ?? '';

  // ── render ────────────────────────────────────────────────────────────────────

  if (profileLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <ActivityIndicator size="large" color={colors.accentBlue} />
      </SafeAreaView>
    );
  }

  const cardData: FighterCardData = {
    name:          profile?.name ?? null,
    nickname:      profile?.nickname ?? null,
    avatarUrl:     profile?.avatar_url ?? null,
    isVerified,
    disciplines:   profile?.disciplines ?? [],
    weightKg:      profile?.weight_kg ?? null,
    heightCm:      profile?.height_cm ?? null,
    stance:        profile?.stance ?? null,
    gymName:       studio?.name ?? null,
    location:      studio?.city ?? profile?.hometown ?? null,
    frame:         profile?.card_frame ?? null,
    motto:         profile?.motto ?? null,
    favoriteMove:  profile?.favorite_move ?? null,
    trainingFocus: profile?.training_focus ?? null,
    backFacts:     profile !== null ? cardBackFacts(profile) : [],
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ProfileToolbar
        onBack={() => navigation.goBack()}
        actions={[
          { icon: 'qr-code-outline', label: 'QR-Code und Profil-ID', onPress: () => setQrSheetVisible(true) },
          {
            icon: 'flag-outline',
            label: 'Profil melden',
            onPress: () => { setReportModalVisible(true); setReportConfirmed(false); },
          },
        ]}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.page}>
          <ProfileHeader
            data={cardData}
            actions={(
              <View style={styles.cardActions}>
                {/* Main action: only what this viewer can actually do here */}
                {canVouch && !vouched && (
                  <PrimaryButton
                    icon="shield-checkmark-outline"
                    label="Als Mitglied bestätigen"
                    loading={vouching}
                    onPress={() => { void handleVouch(); }}
                  />
                )}
                {canRateNow && (
                  <PrimaryButton icon="star-outline" label="Jetzt bewerten" onPress={() => setRatingModalVisible(true)} />
                )}
                <SecondaryButton icon="share-social-outline" label="Profil teilen" onPress={() => setShareVisible(true)} />
              </View>
            )}
          />

          {bio.length > 0 && (
            <>
              <SectionDivider />
              <ProfileSection title="Über mich">
                <Text style={styles.bioText}>{bio}</Text>
              </ProfileSection>
            </>
          )}

          {training.length > 0 && (
            <>
              <SectionDivider />
              <ProfileSection title="So trainiere ich">
                <FactList rows={training} />
              </ProfileSection>
            </>
          )}

          {/* Gym (read-only). Studios have no logo — initials instead. */}
          {studio !== null && (
            <>
              <SectionDivider />
              <ProfileSection title="Gym">
                <View style={styles.teamRow}>
                  <View style={styles.teamLogo}>
                    <Text style={styles.teamLogoText}>{getInitials(studio.name)}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.teamName} numberOfLines={2}>{studio.name}</Text>
                    {studio.city.length > 0 && <Text style={styles.teamCity}>{studio.city}</Text>}
                  </View>
                </View>
              </ProfileSection>
            </>
          )}

          <SectionDivider />
          {profile?.show_fight_record === true ? (
            <FightRecordCard
              fights={targetFights}
              loading={targetFightsLoading}
              ownerName={profile.nickname ?? profile.name}
              compact
              readOnly
            />
          ) : (
            <ProfileSection title="Kampfrekord">
              <Text style={styles.emptyRecordText}>Die Kämpfe werden in diesem Profil nicht öffentlich gezeigt.</Text>
            </ProfileSection>
          )}

          <SectionDivider />
          <SparringActivityCard userId={userId} isOwn={false} />

          {/* Star average — hidden behind SHOW_SPARRING_STARS in favour of the reliability quote */}
          {SHOW_SPARRING_STARS && (
            <>
              <SectionDivider />
              <ProfileSection title="Bewertungen">
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Ionicons
                      key={s}
                      name={averageStars !== null && s <= Math.round(averageStars) ? 'star' : 'star-outline'}
                      size={18}
                      color={colors.accentBlue}
                    />
                  ))}
                </View>
                <Text style={styles.existingRatingComment}>
                  {ratingCount === 0
                    ? 'Noch keine Bewertungen'
                    : `${ratingCount} ${ratingCount === 1 ? 'Bewertung' : 'Bewertungen'}`}
                </Text>
              </ProfileSection>
            </>
          )}

          {SHOW_SPARRING_STARS && existingRating !== null && (
            <ProfileSection title="Deine Bewertung">
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Ionicons
                    key={s}
                    name={s <= existingRating.stars ? 'star' : 'star-outline'}
                    size={16}
                    color={colors.accentBlue}
                  />
                ))}
              </View>
              <Text style={styles.existingRatingComment}>{existingRating.comment}</Text>
            </ProfileSection>
          )}

          {profile?.instagram_url !== null && profile?.instagram_url !== undefined && (
            <TouchableOpacity
              style={styles.instagramRow}
              onPress={() => {
                // Stored as the bare handle — build the real profile URL.
                const url = instagramProfileUrl(profile.instagram_url as string);
                if (url !== null) void Linking.openURL(url);
              }}
              activeOpacity={0.7}
              accessibilityRole="link"
            >
              <Ionicons name="logo-instagram" size={20} color={colors.accentBlue} />
              <Text style={styles.instagramText}>Instagram</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <ProfileShareSheet
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        data={cardData}
        profileCode={profile?.profile_code ?? null}
        isOwn={false}
      />

      {/* ── Rating Modal (hidden behind SHOW_SPARRING_STARS) ────────────── */}
      {SHOW_SPARRING_STARS && (
        <Modal
          visible={ratingModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setRatingModalVisible(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalBackdrop}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <TouchableOpacity
              style={styles.modalDismiss}
              activeOpacity={1}
              onPress={() => setRatingModalVisible(false)}
            />
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Bewertung abgeben</Text>
              <Text style={styles.ratingSubtext}>Bewerte das Verhalten – nicht den Skill</Text>

              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setSelectedStars(s)}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  >
                    <Ionicons
                      name={s <= selectedStars ? 'star' : 'star-outline'}
                      size={36}
                      color={colors.accent}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              {selectedStars > 0 && (
                <Text style={styles.starLabel}>{STAR_LABELS[selectedStars]}</Text>
              )}

              <TextInput
                style={styles.commentInput}
                placeholder="Kurzer Kommentar..."
                placeholderTextColor={colors.textSecondary}
                value={ratingComment}
                onChangeText={setRatingComment}
                maxLength={200}
                multiline
              />
              <Text style={styles.charCount}>{ratingComment.length}/200</Text>

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (selectedStars === 0 || ratingComment.trim().length === 0) && styles.submitBtnDisabled,
                ]}
                onPress={() => { void handleSubmitRating(); }}
                disabled={ratingSubmitting || selectedStars === 0 || ratingComment.trim().length === 0}
              >
                {ratingSubmitting
                  ? <ActivityIndicator color={colors.card} />
                  : <Text style={styles.submitBtnText}>Speichern</Text>
                }
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* ── Report Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={reportModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setReportModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={styles.modalDismiss}
            activeOpacity={1}
            onPress={() => setReportModalVisible(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {reportConfirmed ? (
              <View style={styles.reportConfirmedBox}>
                <Ionicons name="checkmark-circle" size={40} color={colors.difficultyGreen} />
                <Text style={styles.reportConfirmedText}>Meldung wurde übermittelt</Text>
              </View>
            ) : (
              <>
                <Text style={styles.modalTitle}>Nutzer melden</Text>

                {REPORT_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.reportOption,
                      selectedReason === opt.value && styles.reportOptionSelected,
                    ]}
                    onPress={() => setSelectedReason(opt.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.reportOptionText,
                      selectedReason === opt.value && styles.reportOptionTextSelected,
                    ]}>
                      {opt.label}
                    </Text>
                    {selectedReason === opt.value && (
                      <Ionicons name="checkmark" size={16} color={colors.accentBlue} />
                    )}
                  </TouchableOpacity>
                ))}

                <TextInput
                  style={styles.commentInput}
                  placeholder="Details (optional)..."
                  placeholderTextColor={colors.textSecondary}
                  value={reportDetails}
                  onChangeText={setReportDetails}
                  multiline
                />

                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    selectedReason === null && styles.submitBtnDisabled,
                  ]}
                  onPress={() => { void handleSubmitReport(); }}
                  disabled={reportSubmitting || selectedReason === null}
                >
                  {reportSubmitting
                    ? <ActivityIndicator color={colors.card} />
                    : <Text style={styles.submitBtnText}>Absenden</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── QR Share Sheet ──────────────────────────────────────────── */}
      <ProfileQrShareSheet
        visible={qrSheetVisible}
        onClose={() => setQrSheetVisible(false)}
        name={profile?.name ?? null}
        profileCode={profile?.profile_code ?? null}
        isOwn={false}
      />
    </SafeAreaView>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 48,
  },
  page: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    gap: 24,
  },
  flex: {
    flex: 1,
  },
  cardActions: {
    gap: 8,
  },
  bioText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },

  // Gym (read-only)
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  teamLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamLogoText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.card,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  teamCity: {
    fontSize: 13,
    color: colors.textMuted,
  },

  // Instagram
  instagramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
  },
  instagramText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },

  // Existing rating
  starsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  existingRatingComment: {
    fontSize: 14,
    color: colors.text,
  },

  // Record hidden by the owner
  emptyRecordText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },

  // ── Modals ────────────────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalDismiss: {
    flex: 1,
    backgroundColor: colors.mapOverlay,
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  modalHandle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  ratingSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: -8,
  },
  starLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  commentInput: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: -8,
  },
  submitBtn: {
    backgroundColor: colors.accentBlue,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: colors.background,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.card,
  },
  reportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reportOptionSelected: {
    borderColor: colors.accentBlue,
    backgroundColor: colors.background,
  },
  reportOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  reportOptionTextSelected: {
    color: colors.accentBlue,
  },
  reportConfirmedBox: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 16,
  },
  reportConfirmedText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
});
