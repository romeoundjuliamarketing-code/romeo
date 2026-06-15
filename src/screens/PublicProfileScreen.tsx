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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';
import type { FightRecord, ReportReason } from '../types/database.types';
import { supabase } from '../lib/supabase';
import { useSparringRatings } from '../hooks/useSparringRatings';
import { useUserReport }      from '../hooks/useUserReport';
import FightRecordCard        from '../components/profil/FightRecordCard';
import { useAuth }            from '../context/AuthContext';
import { getInitials }        from '../components/profil/ProfileHero';
import { stanceLabel }        from '../utils/stance';
import type { Stance }        from '../utils/stance';

// ── constants ──────────────────────────────────────────────────────────────────

const BANNER_HEIGHT = 120;
const AVATAR_SIZE   = 80;
const AVATAR_OFFSET = AVATAR_SIZE / 2;

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

type PublicTab = 'overview' | 'record';

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
}

interface CurrentUserCoachInfo {
  is_coach:  boolean;
  studio_id: string | null;
}

interface StudioInfo {
  name: string;
  city: string;
}

// ── helper components ──────────────────────────────────────────────────────────

function SteckbriefRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <View style={styles.steckbriefRow}>
      <MaterialCommunityIcons name={icon} size={16} color={colors.textSecondary} />
      <Text style={styles.steckbriefLabel}>{label}</Text>
      <Text style={styles.steckbriefValue}>{value}</Text>
    </View>
  );
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
  const [activeTab,      setActiveTab]      = useState<PublicTab>('overview');

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
      .select('name, age_years, avatar_url, gender, disciplines, show_fight_record, coach_verified_at, studio_id, nickname, weight_class, weight_kg, height_cm, arm_span_cm, nationality, hometown, bio, instagram_url, profile_code, stance, training_since')
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

  const handleShare = useCallback(async () => {
    if (profile === null) return;
    await Share.share({
      message: `Kämpferprofil: ${profile.name ?? 'Unbekannt'} — Code: ${profile.profile_code}`,
    });
  }, [profile]);

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

  const isVerified     = profile?.coach_verified_at != null || vouched;
  const totalFights    = targetFights.length;
  const totalWins      = targetFights.filter((f) => f.result === 'win').length;

  const stanceText = stanceLabel(profile?.stance);

  const metaParts = [profile?.weight_class, profile?.nationality, stanceText]
    .filter((v): v is string => v !== null && v !== undefined && v.length > 0);

  // Steckbrief rows — same fields as OverviewTab
  const steckbriefRows: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; value: string }[] = [];
  if (profile?.weight_class !== null && profile?.weight_class !== undefined && profile.weight_class.length > 0) {
    steckbriefRows.push({ icon: 'trophy-outline', label: 'Gewichtsklasse', value: profile.weight_class });
  }
  if (profile?.weight_kg !== null && profile?.weight_kg !== undefined) {
    steckbriefRows.push({ icon: 'weight-kilogram', label: 'Kampfgewicht', value: `${profile.weight_kg} kg` });
  }
  if (profile?.height_cm !== null && profile?.height_cm !== undefined) {
    steckbriefRows.push({ icon: 'human-male-height', label: 'Körpergrösse', value: `${profile.height_cm} cm` });
  }
  if (profile?.arm_span_cm !== null && profile?.arm_span_cm !== undefined) {
    steckbriefRows.push({ icon: 'arrow-left-right', label: 'Spannweite', value: `${profile.arm_span_cm} cm` });
  }
  if (profile?.age_years !== null && profile?.age_years !== undefined) {
    steckbriefRows.push({ icon: 'calendar-account-outline', label: 'Alter', value: `${profile.age_years} Jahre` });
  }
  if (profile?.nationality !== null && profile?.nationality !== undefined && profile.nationality.length > 0) {
    steckbriefRows.push({ icon: 'flag-outline', label: 'Nationalität', value: profile.nationality });
  }
  if (profile?.hometown !== null && profile?.hometown !== undefined && profile.hometown.length > 0) {
    steckbriefRows.push({ icon: 'map-marker-outline', label: 'Heimatstadt', value: profile.hometown });
  }
  if (profile?.stance !== null && profile?.stance !== undefined) {
    steckbriefRows.push({
      icon: 'boxing-glove',
      label: 'Auslage',
      value: stanceLabel(profile.stance) ?? '',
    });
  }

  // ── render ────────────────────────────────────────────────────────────────────

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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <View style={styles.heroContainer}>
          {/* Dark banner with navigation and action icons */}
          <View style={styles.banner}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.topBarBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-back" size={22} color={colors.headerTextPrimary} />
            </TouchableOpacity>
            <View style={styles.topBarRight}>
              <TouchableOpacity
                onPress={() => { setReportModalVisible(true); setReportConfirmed(false); }}
                style={styles.topBarBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="flag-outline" size={20} color={colors.deleteRed} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setQrSheetVisible(true)}
                style={styles.topBarBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="qr-code-outline" size={20} color={colors.headerTextPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Avatar overlapping the banner */}
          <View style={styles.avatarTouch}>
            <View style={styles.avatarWrapper}>
              {profile?.avatar_url !== null && profile?.avatar_url !== undefined ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Name, meta, counters, actions */}
          <View style={styles.heroBody}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{profile?.name ?? 'Kämpfer'}</Text>
              {isVerified && (
                <Ionicons name="checkmark-circle" size={20} color={colors.accentBlue} />
              )}
            </View>

            {profile?.nickname !== null && profile?.nickname !== undefined && profile.nickname.length > 0 && (
              <Text style={styles.nickname}>"{profile.nickname}"</Text>
            )}

            {profile?.profile_code !== undefined && profile.profile_code.length > 0 && (
              <Text style={styles.handle}>@{profile.profile_code}</Text>
            )}

            {metaParts.length > 0 && (
              <Text style={styles.meta}>{metaParts.join(' · ')}</Text>
            )}

            {/* Kämpfe / Siege counters */}
            <View style={styles.countersRow}>
              <View style={styles.counterItem}>
                <Text style={styles.counterValue}>{totalFights}</Text>
                <Text style={styles.counterLabel}>Kämpfe</Text>
              </View>
              <View style={styles.counterDivider} />
              <View style={styles.counterItem}>
                <Text style={styles.counterValue}>{totalWins}</Text>
                <Text style={styles.counterLabel}>Siege</Text>
              </View>
            </View>

            {/* Average rating */}
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons
                  key={s}
                  name={averageStars !== null && s <= Math.round(averageStars) ? 'star' : 'star-outline'}
                  size={18}
                  color={colors.accent}
                />
              ))}
              <Text style={styles.ratingCount}>
                {ratingCount === 0
                  ? 'Noch keine Bewertungen'
                  : `(${ratingCount} ${ratingCount === 1 ? 'Bewertung' : 'Bewertungen'})`}
              </Text>
            </View>

            {/* Action row: rate + vouch */}
            <View style={styles.actionsRow}>
              {canRateNow && (
                <TouchableOpacity
                  style={styles.rateBtn}
                  activeOpacity={0.8}
                  onPress={() => setRatingModalVisible(true)}
                >
                  <Text style={styles.rateBtnText}>Jetzt bewerten</Text>
                </TouchableOpacity>
              )}
              {canVouch && !vouched && (
                <TouchableOpacity
                  style={styles.vouchBtn}
                  onPress={() => { void handleVouch(); }}
                  disabled={vouching}
                  activeOpacity={0.8}
                >
                  {vouching
                    ? <ActivityIndicator size="small" color={colors.headerTextPrimary} />
                    : (
                      <>
                        <Ionicons name="shield-checkmark-outline" size={16} color={colors.headerTextPrimary} />
                        <Text style={styles.vouchBtnText}>Als Mitglied bestätigen</Text>
                      </>
                    )
                  }
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* ── Tab bar: ÜBERSICHT | REKORD ─────────────────────────────── */}
        <View style={styles.tabBar}>
          {(['overview', 'record'] as PublicTab[]).map((tab) => {
            const label = tab === 'overview' ? 'ÜBERSICHT' : 'REKORD';
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Tab content ──────────────────────────────────────────────── */}
        <View style={styles.tabContent}>
          {activeTab === 'overview' && (
            <>
              {/* Bio */}
              {profile?.bio !== null && profile?.bio !== undefined && profile.bio.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.bioText}>{profile.bio}</Text>
                </View>
              )}

              {/* Team (read-only) */}
              {studio !== null && (
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Team</Text>
                  <View style={styles.teamRow}>
                    <Text style={styles.teamName}>{studio.name}</Text>
                    <Text style={styles.teamCity}>{studio.city}</Text>
                  </View>
                </View>
              )}

              {/* Steckbrief */}
              {steckbriefRows.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Steckbrief</Text>
                  {steckbriefRows.map((row) => (
                    <SteckbriefRow key={row.label} icon={row.icon} label={row.label} value={row.value} />
                  ))}
                </View>
              )}

              {/* Disciplines */}
              {profile?.disciplines !== null && profile?.disciplines !== undefined && profile.disciplines.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Disziplinen</Text>
                  <View style={styles.chipsRow}>
                    {profile.disciplines.map((d) => (
                      <View key={d} style={styles.chip}>
                        <Text style={styles.chipText}>{d}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Instagram */}
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

              {/* Own existing rating */}
              {existingRating !== null && (
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Deine Bewertung</Text>
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
            </>
          )}

          {activeTab === 'record' && (
            profile?.show_fight_record === true ? (
              <FightRecordCard
                fights={targetFights}
                loading={targetFightsLoading}
                readOnly
              />
            ) : (
              <View style={styles.emptyRecord}>
                <Text style={styles.emptyRecordText}>Kämpfe werden nicht öffentlich gezeigt.</Text>
              </View>
            )
          )}
        </View>
      </ScrollView>

      {/* ── Rating Modal ──────────────────────────────────────────────── */}
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

      {/* ── QR Share Modal ────────────────────────────────────────────── */}
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

// ── styles ────────────────────────────────────────────────────────────────────

const cardShadow = Platform.select({
  ios: {
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  android: { elevation: 1 },
});

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
    paddingBottom: 40,
    backgroundColor: colors.background,
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  heroContainer: {
    backgroundColor: colors.card,
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: colors.dark,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  banner: {
    height: BANNER_HEIGHT,
    backgroundColor: colors.dark,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  topBarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarRight: {
    flexDirection: 'row',
    gap: 8,
  },
  avatarTouch: {
    marginTop: -AVATAR_OFFSET,
    marginLeft: 16,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  avatarWrapper: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    borderColor: colors.card,
    overflow: 'hidden',
    backgroundColor: colors.accentBlueSoft,
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarCircle: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.accentBlue,
  },
  heroBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  nickname: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  handle: {
    fontSize: 13,
    color: colors.inactive,
    fontWeight: '500',
  },
  meta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  countersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: 12,
    alignSelf: 'stretch',
  },
  counterItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  counterDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  counterValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  counterLabel: {
    fontSize: 11,
    color: colors.inactive,
    fontWeight: '500',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  ratingCount: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  rateBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.card,
  },
  vouchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.dark,
  },
  vouchBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },

  // ── Tab bar ───────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.accentBlue,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.inactive,
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: colors.accentBlue,
  },

  // ── Tab content ───────────────────────────────────────────────────────────
  tabContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    ...cardShadow,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  bioText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },

  // Team row (read-only)
  teamRow: {
    gap: 2,
  },
  teamName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  teamCity: {
    fontSize: 13,
    color: colors.inactive,
  },

  // Steckbrief
  steckbriefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  steckbriefLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
  },
  steckbriefValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },

  // Disciplines
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: colors.accentBlueSoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentBlue,
  },

  // Instagram
  instagramBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    ...cardShadow,
  },
  instagramBtnText: {
    fontSize: 14,
    fontWeight: '500',
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

  // Empty record
  emptyRecord: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyRecordText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
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
    backgroundColor: colors.accentBlueMuted,
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
    backgroundColor: colors.accentBlueSoft,
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
  qrSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 16,
  },
  qrCodeLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 2,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accentBlue,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  shareBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.card,
  },
});
