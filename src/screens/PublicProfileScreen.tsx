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
import { useTranslation } from 'react-i18next';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';
import type { FightRecord, ReportReason } from '../types/database.types';
import { supabase } from '../lib/supabase';
import { useSparringRatings } from '../hooks/useSparringRatings';
import { useUserReport }      from '../hooks/useUserReport';
import { useBlockedUsers }    from '../hooks/useBlockedUsers';
import { SHOW_SPARRING_STARS } from '../data/sparringConfig';
import FightRecordCard        from '../components/profil/FightRecordCard';
import type { FighterCardData } from '../components/profil/FighterCard';
import ProfileHeader          from '../components/profil/ProfileHeader';
import ProfileShareSheet      from '../components/profil/ProfileShareSheet';
import {
  PrimaryButton,
  SecondaryButton,
  ProfileSection,
} from '../components/profil/ProfileParts';
import { BlockTitle, BodyStats, ProfileBio, TrainingStatement } from '../components/profil/ProfileFacts';
import HomeGymBlock from '../components/profil/HomeGymBlock';
import FocusedStatusBar from '../components/common/FocusedStatusBar';
import { useGym } from '../hooks/useGyms';
import { stanceLabel } from '../utils/stance';
import SparringActivityCard   from '../components/profil/SparringActivityCard';
import ProfileQrShareSheet    from '../components/profil/ProfileQrShareSheet';
import { useAuth }            from '../context/AuthContext';
import { bodyStats, cardBackFacts, trainingHeadline } from '../utils/athleteProfile';
import { instagramProfileUrl } from '../utils/profileDraft';
import type { CardFrameId }   from '../data/cardFrames';
import type { Stance }        from '../utils/stance';

// ── constants ──────────────────────────────────────────────────────────────────

const STAR_LABEL_KEYS = {
  1: 'profile.public.star1',
  2: 'profile.public.star2',
  3: 'profile.public.star3',
  4: 'profile.public.star4',
  5: 'profile.public.star5',
} as const;

const REPORT_OPTIONS = [
  { value: 'unsportliches_verhalten', labelKey: 'profile.public.reportUnsporting'  },
  { value: 'gefaehrliches_verhalten', labelKey: 'profile.public.reportDangerous'   },
  { value: 'beleidigung',             labelKey: 'profile.public.reportHarassment' },
] as const satisfies readonly { value: ReportReason; labelKey: string }[];

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
  country_code:      string | null;
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
  cover_url:         string | null;
  cover_focus_x:     number;
  cover_focus_y:     number;
  home_gym_id:       string | null;
}

interface CurrentUserCoachInfo {
  is_coach:  boolean;
  studio_id: string | null;
}

// ── component ──────────────────────────────────────────────────────────────────

type NavProp    = NativeStackNavigationProp<RootStackParamList, 'PublicProfile'>;
type RoutePropT = RouteProp<RootStackParamList, 'PublicProfile'>;

export default function PublicProfileScreen(): React.ReactElement {
  const { t } = useTranslation();
  const navigation = useNavigation<NavProp>();
  const { params }  = useRoute<RoutePropT>();
  const { userId, sparringId, sparringScheduledAt } = params;

  const { user } = useAuth();
  const currentUserId = user?.id ?? null;

  const [profile,        setProfile]        = useState<PublicProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  // "Profil teilen": preview of the collectible fighter card
  const [shareVisible,   setShareVisible]   = useState(false);

  const [currentUserCoach, setCurrentUserCoach] = useState<CurrentUserCoachInfo | null>(null);

  const [vouching, setVouching] = useState(false);
  const [vouched,  setVouched]  = useState(false);

  const [ratingTrigger, setRatingTrigger] = useState(0);
  const { averageStars, ratingCount, existingRating, submitRating, canRate } =
    useSparringRatings(userId, sparringId ?? '', ratingTrigger);

  const { submitReport } = useUserReport();
  const { blockedIds, block, unblock } = useBlockedUsers();
  const isBlocked = blockedIds.has(userId);

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
      .select('name, age_years, avatar_url, gender, disciplines, show_fight_record, coach_verified_at, studio_id, nickname, weight_class, weight_kg, height_cm, arm_span_cm, nationality, country_code, hometown, bio, instagram_url, profile_code, stance, training_since, training_frequency, is_professional, card_frame, motto, favorite_move, training_focus, cover_url, cover_focus_x, cover_focus_y, home_gym_id')
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
            country_code:      data.country_code ?? null,
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
            cover_url:         data.cover_url ?? null,
            cover_focus_x:     data.cover_focus_x ?? 0.5,
            cover_focus_y:     data.cover_focus_y ?? 0.5,
            home_gym_id:       data.home_gym_id ?? null,
          });
        }
        setProfileLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  // "Hier trainiere ich" — the self-declared gym, not the team membership.
  const { gym: homeGym } = useGym(profile?.home_gym_id ?? null);

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
    if (error !== null) { Alert.alert(t('common.error'), error); return; }
    setRatingModalVisible(false);
    setRatingTrigger((n) => n + 1);
  }, [selectedStars, ratingComment, submitRating, sparringId, userId, t]);

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
    if (error !== null) { Alert.alert(t('common.error'), error); return; }
    setReportConfirmed(true);
  }, [selectedReason, reportDetails, submitReport, userId, sparringId, t]);

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
    gymName:       homeGym?.name ?? null,
    location:      homeGym?.city ?? profile?.hometown ?? null,
    frame:         profile?.card_frame ?? null,
    motto:         profile?.motto ?? null,
    favoriteMove:  profile?.favorite_move ?? null,
    trainingFocus: profile?.training_focus ?? null,
    backFacts:     profile !== null ? cardBackFacts(profile) : [],
  };

  const openGym = (gymId: string) => navigation.push('GymDetail', { gymId });

  const handleBlockToggle = (): void => {
    const displayName = profile?.name ?? t('profile.public.thisPerson');
    const onError = ({ error }: { error: string | null }): void => {
      if (error !== null) Alert.alert(t('common.error'), t('profile.public.genericError'));
    };
    if (isBlocked) {
      void unblock(userId).then(onError);
      return;
    }
    Alert.alert(
      t('profile.public.blockTitle', { name: displayName }),
      t('profile.public.blockText'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.public.block'),
          style: 'destructive',
          onPress: () => {
            void block({ id: userId, name: profile?.name ?? null, avatarUrl: profile?.avatar_url ?? null }).then(onError);
          },
        },
      ],
    );
  };

  return (
    <View style={styles.safeArea}>
      <FocusedStatusBar style="light" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ProfileHeader
          data={cardData}
          coverUrl={profile?.cover_url ?? null}
          coverFocus={{ x: profile?.cover_focus_x ?? 0.5, y: profile?.cover_focus_y ?? 0.5 }}
          isProfessional={profile?.is_professional === true}
          gym={homeGym !== null ? { id: homeGym.id, name: homeGym.name, city: homeGym.city } : null}
          hometown={profile?.hometown ?? null}
          countryCode={profile?.country_code ?? null}
          onPressGym={homeGym !== null ? () => openGym(homeGym.id) : undefined}
          onBack={() => navigation.goBack()}
          toolbar={[
            { icon: 'qr-code-outline', label: t('profile.public.qrLabel'), onPress: () => setQrSheetVisible(true) },
            {
              icon: 'flag-outline',
              label: t('profile.public.report'),
              onPress: () => { setReportModalVisible(true); setReportConfirmed(false); },
            },
            ...(currentUserId !== null && currentUserId !== userId ? [{
              icon: isBlocked ? 'lock-open-outline' as const : 'ban-outline' as const,
              label: isBlocked ? t('profile.public.unblock') : t('profile.public.block'),
              onPress: handleBlockToggle,
            }] : []),
          ]}
          actions={(
            <View style={styles.cardActions}>
              {/* Main action: only what this viewer can actually do here */}
              {canVouch && !vouched && (
                <PrimaryButton
                  icon="shield-checkmark-outline"
                  label={t('profile.public.vouch')}
                  loading={vouching}
                  onPress={() => { void handleVouch(); }}
                />
              )}
              {canRateNow && (
                <PrimaryButton icon="star-outline" label={t('profile.public.rateNow')} onPress={() => setRatingModalVisible(true)} />
              )}
              <View style={styles.shareRow}>
                <SecondaryButton icon="share-social-outline" label={t('profile.public.share')} onPress={() => setShareVisible(true)} />
              </View>
            </View>
          )}
        />

        <View style={styles.page}>
          {isBlocked && (
            <Text style={styles.blockedHint}>{t('profile.public.blockedHint')}</Text>
          )}
          {/* Empty parts of a foreign profile are simply left out */}
          <View style={styles.group}>
            <BodyStats stats={profile !== null ? bodyStats(profile, stanceLabel(profile.stance)) : []} />
            <ProfileBio bio={bio} />
            <TrainingStatement headline={profile !== null ? trainingHeadline(profile) : null} />
          </View>

          <HomeGymBlock gym={homeGym} onOpen={openGym} />

          {profile?.show_fight_record === true ? (
            <FightRecordCard
              fights={targetFights}
              loading={targetFightsLoading}
              ownerName={profile.nickname ?? profile.name}
              compact
              readOnly
            />
          ) : (
            <View style={styles.group}>
              <BlockTitle>{t('profile.fights.title')}</BlockTitle>
              <Text style={styles.emptyRecordText}>{t('profile.public.recordHidden')}</Text>
            </View>
          )}

          <SparringActivityCard userId={userId} isOwn={false} />

          {/* Star average — hidden behind SHOW_SPARRING_STARS in favour of the reliability quote */}
          {SHOW_SPARRING_STARS && (
            <>
              <ProfileSection title={t('profile.public.ratings')}>
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
                    ? t('profile.public.noRatings')
                    : t('profile.public.ratingCount', { count: ratingCount })}
                </Text>
              </ProfileSection>
            </>
          )}

          {SHOW_SPARRING_STARS && existingRating !== null && (
            <ProfileSection title={t('profile.public.yourRating')}>
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
              <Text style={styles.modalTitle}>{t('profile.public.rateTitle')}</Text>
              <Text style={styles.ratingSubtext}>{t('profile.public.rateSubtitle')}</Text>

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
                <Text style={styles.starLabel}>{t(STAR_LABEL_KEYS[selectedStars as 1 | 2 | 3 | 4 | 5])}</Text>
              )}

              <TextInput
                style={styles.commentInput}
                placeholder={t('profile.public.commentPlaceholder')}
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
                  : <Text style={styles.submitBtnText}>{t('common.save')}</Text>
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
                <Text style={styles.reportConfirmedText}>{t('profile.public.reportConfirmed')}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.modalTitle}>{t('profile.public.reportTitle')}</Text>

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
                      {t(opt.labelKey)}
                    </Text>
                    {selectedReason === opt.value && (
                      <Ionicons name="checkmark" size={16} color={colors.accentBlue} />
                    )}
                  </TouchableOpacity>
                ))}

                <TextInput
                  style={styles.commentInput}
                  placeholder={t('profile.public.detailsPlaceholder')}
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
                    : <Text style={styles.submitBtnText}>{t('profile.public.submit')}</Text>
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
    </View>
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
    paddingBottom: 48,
  },
  page: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 32,
    gap: 40,
  },
  group: {
    gap: 24,
  },
  cardActions: {
    gap: 8,
  },
  shareRow: {
    flexDirection: 'row',
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

  blockedHint: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
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
