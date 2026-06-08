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
  Image,
  Linking,
  Share,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
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
import FightRecordCard        from '../components/profil/FightRecordCard';
import { useAuth }            from '../context/AuthContext';

// ── helpers ────────────────────────────────────────────────────────────────────

function getInitials(name: string | null): string {
  if (name === null || name.trim().length === 0) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

const STAR_LABELS: Record<number, string> = {
  1: 'Nicht empfehlenswert',
  2: 'War okay',
  3: 'Guter Sparringspartner',
  4: 'Sehr empfehlenswert',
  5: 'Immer wieder gerne',
};

const REPORT_OPTIONS: { value: ReportReason; label: string }[] = [
  { value: 'unsportliches_verhalten', label: 'Unsportliches Verhalten' },
  { value: 'gefaehrliches_verhalten', label: 'Gefährliches Verhalten' },
  { value: 'beleidigung',             label: 'Beleidigung / Harassment' },
];

// ── types ──────────────────────────────────────────────────────────────────────

const GENDER_LABEL: Record<string, string> = {
  male:   'Männlich',
  female: 'Weiblich',
  other:  'Divers',
};

interface PublicProfile {
  name:              string | null;
  age_years:         number | null;
  avatar_url:        string | null;
  gender:            string | null;
  disciplines:       string[];
  show_fight_record: boolean;
  show_stats:        boolean;
  coach_verified_at: string | null;
  studio_id:         string | null;
  nickname:          string | null;
  weight_class:      string | null;
  weight_kg:         number | null;
  nationality:       string | null;
  hometown:          string | null;
  bio:               string | null;
  instagram_url:     string | null;
  profile_code:      string;
  height_cm:         number | null;
  stance:            'orthodox' | 'southpaw' | null;
  training_since:    string | null;
}

interface CurrentUserCoachInfo {
  is_coach:  boolean;
  studio_id: string | null;
}

// ── component ─────────────────────────────────────────────────────────────────

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

  // Current user's coach/studio info (for vouch button visibility)
  const [currentUserCoach, setCurrentUserCoach] = useState<CurrentUserCoachInfo | null>(null);

  // Vouch state
  const [vouching, setVouching] = useState(false);
  const [vouched,  setVouched]  = useState(false);

  // Rating
  const [ratingTrigger, setRatingTrigger] = useState(0);
  const { averageStars, ratingCount, existingRating, submitRating, canRate } =
    useSparringRatings(userId, sparringId ?? '', ratingTrigger);

  // Report
  const { submitReport } = useUserReport();

  // Rating modal
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedStars,      setSelectedStars]      = useState(0);
  const [ratingComment,      setRatingComment]      = useState('');
  const [ratingSubmitting,   setRatingSubmitting]   = useState(false);

  // Report modal
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedReason,     setSelectedReason]     = useState<ReportReason | null>(null);
  const [reportDetails,      setReportDetails]      = useState('');
  const [reportSubmitting,   setReportSubmitting]   = useState(false);
  const [reportConfirmed,    setReportConfirmed]    = useState(false);

  // Target user's fight record (fetched directly; useFightRecord only loads for the auth user)
  const [targetFights,        setTargetFights]        = useState<FightRecord[]>([]);
  const [targetFightsLoading, setTargetFightsLoading] = useState(true);

  const [qrSheetVisible, setQrSheetVisible] = useState(false);

  // Load public profile
  useEffect(() => {
    let cancelled = false;
    setProfileLoading(true);

    void supabase
      .from('profiles')
      .select('name, age_years, avatar_url, gender, disciplines, show_fight_record, show_stats, coach_verified_at, studio_id, nickname, weight_class, weight_kg, nationality, hometown, bio, instagram_url, profile_code, height_cm, stance, training_since')
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
            show_stats:        (data.show_stats as boolean) ?? true,
            coach_verified_at: data.coach_verified_at ?? null,
            studio_id:         data.studio_id ?? null,
            nickname:       data.nickname ?? null,
            weight_class:   data.weight_class ?? null,
            weight_kg:      data.weight_kg ?? null,
            nationality:    data.nationality ?? null,
            hometown:       data.hometown ?? null,
            bio:            data.bio ?? null,
            instagram_url:  data.instagram_url ?? null,
            profile_code:   (data.profile_code as string) ?? '',
            height_cm:      data.height_cm ?? null,
            stance:         (data.stance as 'orthodox' | 'southpaw' | null) ?? null,
            training_since: data.training_since ?? null,
          });
        }
        setProfileLoading(false);
      });

    return () => { cancelled = true; };
  }, [userId]);

  // Load target user's fight record
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

  // Load current user's coach/studio status for vouch button visibility
  useEffect(() => {
    if (currentUserId === null) return;
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
  }, [currentUserId]);

  // ── Vouch handler ────────────────────────────────────────────────────────────

  const handleVouch = useCallback(async () => {
    setVouching(true);
    const { error } = await supabase.rpc('verify_member', { p_user_id: userId });
    setVouching(false);
    if (error === null) setVouched(true);
  }, [userId]);

  const handleShare = useCallback(async () => {
    if (profile === null) return;
    await Share.share({
      message: `Kämpferprofil: ${profile.name ?? 'Unbekannt'} — Code: ${profile.profile_code}`,
    });
  }, [profile]);

  // ── Rating handlers ─────────────────────────────────────────────────────────

  const handleSubmitRating = useCallback(async () => {
    if (selectedStars === 0 || ratingComment.trim().length === 0) return;
    setRatingSubmitting(true);
    const { error } = await submitRating(sparringId ?? '', userId, selectedStars, ratingComment.trim());
    setRatingSubmitting(false);
    if (error !== null) {
      Alert.alert('Fehler', error);
      return;
    }
    setRatingModalVisible(false);
    setRatingTrigger((n) => n + 1);
  }, [selectedStars, ratingComment, submitRating, sparringId, userId]);

  // ── Report handlers ─────────────────────────────────────────────────────────

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
    if (error !== null) {
      Alert.alert('Fehler', error);
      return;
    }
    setReportConfirmed(true);
  }, [selectedReason, reportDetails, submitReport, userId, sparringId]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const canRateNow =
    sparringId !== undefined &&
    sparringScheduledAt !== undefined &&
    canRate(sparringScheduledAt) &&
    existingRating === null;

  // Show vouch button only when current user is a coach in the same studio as the viewed user,
  // not viewing their own profile, and the viewed user is not already verified.
  const canVouch =
    currentUserCoach !== null &&
    currentUserCoach.is_coach === true &&
    currentUserCoach.studio_id !== null &&
    currentUserCoach.studio_id === profile?.studio_id &&
    currentUserId !== userId &&
    (profile?.coach_verified_at === null || profile?.coach_verified_at === undefined);

  // Show the verified badge if the viewed user is coach-verified or was just vouched in this session.
  const isVerified = (profile?.coach_verified_at !== null && profile?.coach_verified_at !== undefined) || vouched;

  if (profileLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <ActivityIndicator size="large" color={colors.accentBlue} />
      </SafeAreaView>
    );
  }

  const initials = getInitials(profile?.name ?? null);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { setReportModalVisible(true); setReportConfirmed(false); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="flag-outline" size={22} color={colors.deleteRed} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setQrSheetVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="share-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        {profile?.avatar_url !== null && profile?.avatar_url !== undefined ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}

        {/* Name with optional verified badge */}
        <View style={styles.nameRow}>
          <Text style={styles.name}>{profile?.name ?? 'Unbekannt'}</Text>
          {isVerified && (
            <Ionicons name="checkmark-circle" size={22} color={colors.accentBlue} />
          )}
        </View>

        {profile?.nickname !== null && profile?.nickname !== undefined && (
          <Text style={styles.nickname}>"{profile.nickname}"</Text>
        )}
        <Text style={styles.profileCode}>{profile?.profile_code ?? ''}</Text>

        {/* Age + gender — always visible */}
        {(profile?.age_years !== null && profile?.age_years !== undefined) || (profile?.gender !== null && profile?.gender !== undefined) ? (
          <Text style={styles.meta}>
            {[
              profile?.age_years !== null && profile?.age_years !== undefined ? `${profile.age_years} Jahre` : null,
              profile?.gender !== null && profile?.gender !== undefined && GENDER_LABEL[profile.gender] !== undefined
                ? GENDER_LABEL[profile.gender]
                : null,
            ].filter(Boolean).join(' · ')}
          </Text>
        ) : null}

        {profile?.show_stats === true && (
          <View style={styles.statsRow}>
            {profile.weight_class !== null && (
              <View style={styles.statChip}>
                <Text style={styles.statChipText}>{profile.weight_class}</Text>
              </View>
            )}
            {profile.stance !== null && (
              <View style={styles.statChip}>
                <Text style={styles.statChipText}>
                  {profile.stance === 'orthodox' ? 'Orthodox' : 'Southpaw'}
                </Text>
              </View>
            )}
            {profile.height_cm !== null && (
              <View style={styles.statChip}>
                <Text style={styles.statChipText}>{profile.height_cm} cm</Text>
              </View>
            )}
            {profile.training_since !== null && (
              <View style={styles.statChip}>
                <Text style={styles.statChipText}>
                  seit {profile.training_since.split('-')[0]}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Average rating — always visible */}
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((s) => (
            <Ionicons
              key={s}
              name={averageStars !== null && s <= Math.round(averageStars) ? 'star' : 'star-outline'}
              size={20}
              color={colors.accent}
            />
          ))}
          <Text style={styles.ratingCount}>
            {ratingCount === 0
              ? 'Noch keine Bewertungen'
              : `(${ratingCount} ${ratingCount === 1 ? 'Bewertung' : 'Bewertungen'})`}
          </Text>
        </View>

        {profile?.bio !== null && profile?.bio !== undefined && (
          <View style={styles.bioCard}>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        )}

        {/* Disciplines — only if show_stats */}
        {profile?.show_stats === true && profile.disciplines.length > 0 && (
          <View style={styles.disciplinesRow}>
            {profile.disciplines.map((d) => (
              <View key={d} style={styles.disciplineBadge}>
                <Text style={styles.disciplineBadgeText}>{d}</Text>
              </View>
            ))}
          </View>
        )}

        {profile?.show_stats === true &&
          (profile?.hometown !== null || profile?.nationality !== null) && (
          <View style={styles.infoRow}>
            {profile?.nationality !== null && (
              <Text style={styles.infoText}>{profile.nationality}</Text>
            )}
            {profile?.hometown !== null && (
              <Text style={styles.infoText}>{profile.hometown}</Text>
            )}
          </View>
        )}

        {/* Fight record — only if show_fight_record */}
        {profile?.show_fight_record === true && (
          <FightRecordCard
            fights={targetFights}
            loading={targetFightsLoading}
            readOnly
          />
        )}

        {profile?.instagram_url !== null && profile?.instagram_url !== undefined && (
          <TouchableOpacity
            style={styles.instagramBtn}
            onPress={() => { void Linking.openURL(profile.instagram_url as string); }}
            activeOpacity={0.7}
          >
            <Ionicons name="logo-instagram" size={18} color={colors.text} />
            <Text style={styles.instagramBtnText}>Instagram</Text>
          </TouchableOpacity>
        )}

        {/* Rate button */}
        {canRateNow && (
          <TouchableOpacity
            style={styles.rateBtn}
            activeOpacity={0.8}
            onPress={() => setRatingModalVisible(true)}
          >
            <Text style={styles.rateBtnText}>Jetzt bewerten</Text>
          </TouchableOpacity>
        )}

        {/* Vouch button — only visible to coaches in the same studio */}
        {canVouch && !vouched && (
          <TouchableOpacity
            style={styles.vouchButton}
            onPress={() => { void handleVouch(); }}
            disabled={vouching}
            activeOpacity={0.8}
          >
            {vouching
              ? <ActivityIndicator size="small" color={colors.headerTextPrimary} />
              : (
                <>
                  <Ionicons name="shield-checkmark-outline" size={18} color={colors.headerTextPrimary} />
                  <Text style={styles.vouchText}>Als echtes Mitglied bestätigen</Text>
                </>
              )
            }
          </TouchableOpacity>
        )}

        {/* Own existing rating display */}
        {existingRating !== null && (
          <View style={styles.existingRatingBox}>
            <Text style={styles.existingRatingLabel}>Deine Bewertung</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons
                  key={s}
                  name={s <= existingRating.stars ? 'star' : 'star-outline'}
                  size={16}
                  color={colors.accent}
                />
              ))}
            </View>
            <Text style={styles.existingRatingComment}>{existingRating.comment}</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Rating Modal ──────────────────────────────────────────────────── */}
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

            {/* Stars */}
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

            {/* Comment input */}
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

      {/* ── Report Modal ──────────────────────────────────────────────────── */}
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

      <Modal
        visible={qrSheetVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setQrSheetVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setQrSheetVisible(false)}
        >
          <View style={styles.qrSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Profil teilen</Text>
            {profile !== null && (
              <QRCode
                value={profile.profile_code}
                size={200}
                color={colors.text}
                backgroundColor={colors.card}
              />
            )}
            <Text style={styles.qrCodeLabel}>{profile?.profile_code ?? ''}</Text>
            <TouchableOpacity
              style={styles.shareBtn}
              onPress={() => { void handleShare(); }}
              activeOpacity={0.8}
            >
              <Ionicons name="share-outline" size={18} color={colors.card} />
              <Text style={styles.shareBtnText}>Teilen</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex:            1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex:            1,
    backgroundColor: colors.background,
    alignItems:      'center',
    justifyContent:  'center',
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom:     40,
    alignItems:        'center',
    gap:               16,
  },
  avatarCircle: {
    width:           88,
    height:          88,
    borderRadius:    44,
    backgroundColor: colors.accentBlueSoft,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       8,
  },
  avatarInitials: {
    fontSize:   28,
    fontWeight: '700',
    color:      colors.accentBlue,
  },
  name: {
    fontSize:   22,
    fontWeight: '700',
    color:      colors.text,
    textAlign:  'center',
  },
  meta: {
    fontSize:  14,
    color:     colors.textSecondary,
    textAlign: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  ratingCount: {
    fontSize:   13,
    color:      colors.textSecondary,
    marginLeft: 4,
  },
  disciplinesRow: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            8,
    justifyContent: 'center',
  },
  disciplineBadge: {
    backgroundColor:   colors.accentBlueSoft,
    borderRadius:      8,
    paddingHorizontal: 12,
    paddingVertical:   4,
  },
  disciplineBadgeText: {
    fontSize:   13,
    fontWeight: '600',
    color:      colors.accentBlue,
  },
  rateBtn: {
    backgroundColor: colors.accentBlue,
    borderRadius:    14,
    height:          50,
    alignItems:      'center',
    justifyContent:  'center',
    alignSelf:       'stretch',
    marginTop:       8,
  },
  rateBtnText: {
    fontSize:   16,
    fontWeight: '700',
    color:      colors.card,
  },
  existingRatingBox: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         16,
    alignSelf:       'stretch',
    gap:             8,
  },
  existingRatingLabel: {
    fontSize:   13,
    fontWeight: '600',
    color:      colors.textSecondary,
  },
  starsRow: {
    flexDirection: 'row',
    gap:           4,
  },
  existingRatingComment: {
    fontSize: 14,
    color:    colors.text,
  },
  modalBackdrop: {
    flex:           1,
    justifyContent: 'flex-end',
  },
  modalDismiss: {
    flex:            1,
    backgroundColor: colors.mapOverlay,
  },
  modalSheet: {
    backgroundColor:      colors.card,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    padding:              24,
    paddingBottom:        40,
    gap:                  16,
  },
  modalHandle: {
    width:           32,
    height:          4,
    borderRadius:    2,
    backgroundColor: colors.border,
    alignSelf:       'center',
    marginBottom:    4,
  },
  modalTitle: {
    fontSize:   20,
    fontWeight: '700',
    color:      colors.text,
  },
  ratingSubtext: {
    fontSize:  13,
    color:     colors.textSecondary,
    marginTop: -8,
  },
  starLabel: {
    fontSize:  14,
    color:     colors.textSecondary,
    textAlign: 'center',
  },
  commentInput: {
    backgroundColor:   colors.background,
    borderRadius:      12,
    padding:           16,
    fontSize:          14,
    color:             colors.text,
    minHeight:         80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize:  12,
    color:     colors.textSecondary,
    textAlign: 'right',
    marginTop: -8,
  },
  submitBtn: {
    backgroundColor: colors.accentBlue,
    borderRadius:    14,
    height:          50,
    alignItems:      'center',
    justifyContent:  'center',
  },
  submitBtnDisabled: {
    backgroundColor: colors.accentBlueMuted,
  },
  submitBtnText: {
    fontSize:   16,
    fontWeight: '700',
    color:      colors.card,
  },
  reportOption: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingVertical:   12,
    paddingHorizontal: 16,
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       colors.border,
  },
  reportOptionSelected: {
    borderColor:     colors.accentBlue,
    backgroundColor: colors.accentBlueSoft,
  },
  reportOptionText: {
    fontSize:   14,
    fontWeight: '500',
    color:      colors.text,
  },
  reportOptionTextSelected: {
    color: colors.accentBlue,
  },
  reportConfirmedBox: {
    alignItems:      'center',
    paddingVertical: 24,
    gap:             16,
  },
  reportConfirmedText: {
    fontSize:   16,
    fontWeight: '600',
    color:      colors.text,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  vouchButton: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               8,
    height:            48,
    borderRadius:      12,
    backgroundColor:   colors.headerBg,
    alignSelf:         'stretch',
    marginTop:         8,
  },
  vouchText: {
    color:      colors.headerTextPrimary,
    fontSize:   14,
    fontWeight: '700',
  },
  avatarImage: {
    width:        88,
    height:       88,
    borderRadius: 44,
    marginTop:    8,
  },
  nickname: {
    fontSize:  15,
    color:     colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  profileCode: {
    fontSize:          12,
    color:             colors.inactive,
    textAlign:         'center',
    backgroundColor:   colors.background,
    paddingHorizontal: 10,
    paddingVertical:   3,
    borderRadius:      8,
  },
  statsRow: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            8,
    justifyContent: 'center',
  },
  statChip: {
    backgroundColor:   colors.background,
    borderRadius:      8,
    paddingHorizontal: 12,
    paddingVertical:   4,
  },
  statChipText: {
    fontSize:   13,
    fontWeight: '500',
    color:      colors.text,
  },
  bioCard: {
    backgroundColor: colors.card,
    borderRadius:    12,
    padding:         16,
    alignSelf:       'stretch',
  },
  bioText: {
    fontSize:   14,
    color:      colors.text,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection:  'row',
    gap:            16,
    justifyContent: 'center',
  },
  infoText: {
    fontSize: 13,
    color:    colors.textSecondary,
  },
  instagramBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 16,
    paddingVertical:   10,
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       colors.border,
  },
  instagramBtnText: {
    fontSize:   14,
    fontWeight: '500',
    color:      colors.text,
  },
  qrSheet: {
    backgroundColor:      colors.card,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    padding:              24,
    paddingBottom:        40,
    alignItems:           'center',
    gap:                  16,
  },
  qrCodeLabel: {
    fontSize:      15,
    fontWeight:    '700',
    color:         colors.text,
    letterSpacing: 2,
  },
  shareBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    backgroundColor:   colors.accentBlue,
    borderRadius:      12,
    paddingHorizontal: 24,
    paddingVertical:   12,
  },
  shareBtnText: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.card,
  },
});
