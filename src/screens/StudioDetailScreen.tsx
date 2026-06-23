import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { uploadImage } from '../lib/uploadImage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useStudioProfile } from '../hooks/useStudioProfile';
import { useFeaturedFighters } from '../hooks/useFeaturedFighters';
import { useProfile } from '../hooks/useProfile';
import { useSchedule } from '../hooks/useSchedule';
import { useStudioSparrings } from '../hooks/useStudioSparrings';
import { useSparringActions } from '../hooks/useSparringActions';
import { useMyStudioRequests } from '../hooks/useMyStudioRequests';
import { useStudioMembershipPlans } from '../hooks/useStudioMembershipPlans';
import { useEntitlement } from '../hooks/useEntitlement';
import StudioHero from '../components/studio/StudioHero';
import DisciplineChips from '../components/studio/DisciplineChips';
import FeaturedFightersRow from '../components/studio/FeaturedFightersRow';
import StudioCoachesSection from '../components/studio/StudioCoachesSection';
import StudioOwnerBar from '../components/studio/StudioOwnerBar';
import TrialBookingSheet from '../components/studio/TrialBookingSheet';
import DropInSheet from '../components/studio/DropInSheet';
import MembershipPlansList from '../components/studio/MembershipPlansList';
import MemberMultiPickerSheet from '../components/studio/MemberMultiPickerSheet';
import StudioScheduleCalendar from '../components/studio/StudioScheduleCalendar';
import StudioRatingSheet from '../components/studio/StudioRatingSheet';
import QRScannerModal from '../components/profil/QRScannerModal';
import QRCode from 'react-native-qrcode-svg';
import { useStudioRatings } from '../hooks/useStudioRatings';
import { buildStudioQr, parseStudioQr } from '../utils/studioQr';
import type { StudioSchedule } from '../types/database.types';

type Props = NativeStackScreenProps<RootStackParamList, 'StudioDetail'>;

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const STATUS_LABELS: Record<string, string> = {
  pending:   'Ausstehend',
  confirmed: 'Bestätigt',
  declined:  'Abgelehnt',
  cancelled: 'Abgebrochen',
};

const ALL_DISCIPLINES = [
  'Boxen', 'Kickboxen', 'Muay Thai', 'BJJ', 'Wrestling',
  'MMA', 'Grappling', 'Judo', 'K-1', 'Freistil',
];

const MAX_DESCRIPTION = 300;

export default function StudioDetailScreen({ route, navigation }: Props): React.ReactElement {
  const { studioId } = route.params;
  const { user } = useAuth();

  const { studio, loading: studioLoading, refetch: refetchStudio } = useStudioProfile(studioId);
  const { fighters, loading: fightersLoading, addFighters, removeFighter } = useFeaturedFighters(studioId);
  const { profile: myProfile } = useProfile();
  const { schedule, loading: scheduleLoading, refetch: refetchSchedule } = useSchedule(undefined, studioId);
  const { sparrings: studioSparrings, refetch: refetchSparrings } = useStudioSparrings(studioId);
  const { deactivateSparring } = useSparringActions();
  const { trialBookings, contracts, refetch } = useMyStudioRequests();
  const { plans, loading: plansLoading } = useStudioMembershipPlans(studioId);
  const { entitlement } = useEntitlement();

  const [ratingRefetch, setRatingRefetch] = useState(0);
  const { averageStars, ratingCount } = useStudioRatings(studioId, ratingRefetch);

  const [ratingScannerVisible, setRatingScannerVisible] = useState(false);
  const [ratingSheetVisible, setRatingSheetVisible] = useState(false);
  const [ownerQrVisible, setOwnerQrVisible] = useState(false);

  const [bookingSheetVisible, setBookingSheetVisible] = useState(false);
  const [dropInEntry, setDropInEntry] = useState<StudioSchedule | null>(null);
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const [scheduleEditorOpen, setScheduleEditorOpen] = useState(false);
  const [memberPickerVisible, setMemberPickerVisible] = useState(false);

  // ── Edit-mode state ────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [draftDescription, setDraftDescription] = useState('');
  const [draftDisciplines, setDraftDisciplines] = useState<string[]>([]);
  const [draftAddress, setDraftAddress] = useState('');
  const [draftLat, setDraftLat] = useState<number | null>(null);
  const [draftLng, setDraftLng] = useState<number | null>(null);
  const [draftBannerUri, setDraftBannerUri] = useState<string | null>(null);
  const [draftAvatarUri, setDraftAvatarUri] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeLabel, setGeocodeLabel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isOwner = studio !== null && user !== null && studio.owner_user_id === user.id;
  const canManage = isOwner || (myProfile?.is_coach === true && myProfile?.studio_id === studioId);

  // Seed draft state whenever the studio data loads (or reloads after a save).
  useEffect(() => {
    if (studio === null) return;
    setDraftDescription(studio.description ?? '');
    setDraftDisciplines(studio.disciplines);
    setDraftAddress(studio.address ?? '');
    setDraftLat(studio.lat);
    setDraftLng(studio.lng);
    setGeocodeLabel(
      studio.lat !== null ? `${studio.lat.toFixed(4)}, ${studio.lng?.toFixed(4)}` : null,
    );
  }, [studio]);

  const studioBooking = trialBookings.find((b) => b.studio_id === studioId) ?? null;
  const activeBooking =
    studioBooking !== null &&
    (studioBooking.status === 'pending' || studioBooking.status === 'confirmed')
      ? studioBooking
      : null;

  const activeContract =
    contracts.find(
      (c) =>
        c.studio_id === studioId &&
        (c.status === 'pending' || c.status === 'active' || c.status === 'cancellation_requested'),
    ) ?? null;

  // Handle a scanned studio QR. Only this studio's own code opens the rating sheet.
  function handleRatingScan(code: string): void {
    setRatingScannerVisible(false);
    if (parseStudioQr(code) !== studioId.toLowerCase()) {
      Alert.alert('Falscher QR-Code', 'Dieser QR-Code gehört nicht zu diesem Studio.');
      return;
    }
    setRatingSheetVisible(true);
  }

  // ── Edit-mode helpers ──────────────────────────────────────────────────────

  function enterEditMode(): void {
    // Re-seed drafts from the current studio data before opening.
    if (studio !== null) {
      setDraftDescription(studio.description ?? '');
      setDraftDisciplines(studio.disciplines);
      setDraftAddress(studio.address ?? '');
      setDraftLat(studio.lat);
      setDraftLng(studio.lng);
      setGeocodeLabel(
        studio.lat !== null ? `${studio.lat.toFixed(4)}, ${studio.lng?.toFixed(4)}` : null,
      );
      setDraftBannerUri(null);
      setDraftAvatarUri(null);
    }
    setEditing(true);
  }

  function cancelEdit(): void {
    setDraftBannerUri(null);
    setDraftAvatarUri(null);
    setEditing(false);
  }

  function toggleDiscipline(d: string): void {
    setDraftDisciplines((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  }

  async function pickImage(aspect: [number, number]): Promise<string | null> {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Zugriff erforderlich', 'Bitte Foto-Zugriff in den Einstellungen erlauben.');
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect,
      quality: 0.85,
    });
    if (result.canceled || result.assets.length === 0) return null;
    return result.assets[0].uri;
  }

  async function handlePickBanner(): Promise<void> {
    const uri = await pickImage([16, 9]);
    if (uri !== null) setDraftBannerUri(uri);
  }

  async function handlePickAvatar(): Promise<void> {
    const uri = await pickImage([1, 1]);
    if (uri !== null) setDraftAvatarUri(uri);
  }

  async function handleGeocode(): Promise<void> {
    const query = draftAddress.trim();
    if (query.length === 0) return;
    setGeocoding(true);
    setGeocodeLabel(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Sparr-App/1.0 (kontakt@sparr.app)' },
      });
      const json = (await res.json()) as { lat: string; lon: string; display_name: string }[];
      if (json.length === 0) {
        setGeocodeLabel('Keine Ergebnisse gefunden.');
        return;
      }
      const result = json[0];
      setDraftLat(parseFloat(result.lat));
      setDraftLng(parseFloat(result.lon));
      setGeocodeLabel(result.display_name.split(',').slice(0, 3).join(','));
    } catch {
      setGeocodeLabel('Fehler bei der Standortsuche.');
    } finally {
      setGeocoding(false);
    }
  }

  async function handleSave(): Promise<void> {
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        description: draftDescription.trim().length > 0 ? draftDescription.trim() : null,
        disciplines: draftDisciplines,
        address: draftAddress.trim().length > 0 ? draftAddress.trim() : null,
        lat: draftLat,
        lng: draftLng,
      };

      if (draftBannerUri !== null) {
        const { url, error } = await uploadImage(draftBannerUri, 'studio-assets', `${studioId}/banner`);
        if (error !== null) {
          Alert.alert('Banner-Upload fehlgeschlagen', error);
          return;
        }
        updates.banner_url = url;
      }

      if (draftAvatarUri !== null) {
        const { url, error } = await uploadImage(draftAvatarUri, 'studio-assets', `${studioId}/avatar`);
        if (error !== null) {
          Alert.alert('Avatar-Upload fehlgeschlagen', error);
          return;
        }
        updates.avatar_url = url;
      }

      const { error } = await supabase
        .from('studios')
        .update(updates)
        .eq('id', studioId);

      if (error !== null) {
        Alert.alert('Fehler beim Speichern', error.message);
        return;
      }

      refetchStudio();
      setDraftBannerUri(null);
      setDraftAvatarUri(null);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveSelf(): Promise<void> {
    if (user === null) return;
    Alert.alert(
      'Featured-Status entfernen',
      'Dein Profil wird nicht mehr auf dieser Studioseite angezeigt.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entfernen',
          style: 'destructive',
          onPress: async () => {
            const { error } = await removeFighter(user.id);
            if (error !== null) Alert.alert('Fehler', error);
          },
        },
      ],
    );
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

  // Block the whole screen only while the studio itself has no data yet.
  const isLoading = studioLoading && studio === null;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator style={styles.loader} color={colors.accentBlue} />
      </SafeAreaView>
    );
  }

  if (studio === null) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TouchableOpacity style={styles.backBtnStandalone} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Derived display values in edit mode: prefer the local draft URIs over stored URLs.
  const displayBanner = draftBannerUri ?? studio.banner_url ?? null;
  const displayAvatar = draftAvatarUri ?? studio.avatar_url ?? null;

  // ── Edit mode layout ───────────────────────────────────────────────────────
  if (editing) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Edit-mode header with save / cancel */}
        <View style={styles.editHeader}>
          <TouchableOpacity onPress={cancelEdit} style={styles.editHeaderBtn}>
            <Text style={styles.editCancelText}>Abbrechen</Text>
          </TouchableOpacity>
          <Text style={styles.editHeaderTitle}>Profil bearbeiten</Text>
          <TouchableOpacity onPress={() => { void handleSave(); }} disabled={saving} style={styles.editHeaderBtn}>
            {saving
              ? <ActivityIndicator size="small" color={colors.accentBlue} />
              : <Text style={styles.editSaveText}>Speichern</Text>
            }
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Banner picker */}
            <TouchableOpacity onPress={() => { void handlePickBanner(); }} activeOpacity={0.85}>
              <ImageBackground
                source={displayBanner !== null ? { uri: displayBanner } : undefined}
                style={styles.editBanner}
                imageStyle={styles.editBannerImage}
              >
                <View style={styles.editBannerOverlay} />
                <View style={styles.editBannerHint}>
                  <Ionicons name="image-outline" size={22} color={colors.card} />
                  <Text style={styles.editBannerHintText}>Banner ändern</Text>
                </View>
              </ImageBackground>
            </TouchableOpacity>

            {/* Avatar picker */}
            <View style={styles.editAvatarRow}>
              <TouchableOpacity
                onPress={() => { void handlePickAvatar(); }}
                activeOpacity={0.85}
                style={styles.editAvatarWrap}
              >
                {displayAvatar !== null ? (
                  <Image source={{ uri: displayAvatar }} style={styles.editAvatar} />
                ) : (
                  <View style={styles.editAvatarPlaceholder}>
                    <Text style={styles.editAvatarInitials}>
                      {studio.name.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.editAvatarBadge}>
                  <Ionicons name="camera" size={14} color={colors.card} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.editContent}>
              {/* Map visibility / WhatsApp CTA */}
              <View style={styles.editSection}>
                <Text style={styles.editSectionLabel}>Karte</Text>
                <View style={styles.editAboRow}>
                  <View style={[
                    styles.editAboDot,
                    entitlement.canManageStudio
                      ? styles.editAboDotActive
                      : styles.editAboDotInactive,
                  ]} />
                  <Text style={styles.editAboStatus}>
                    {entitlement.canManageStudio
                      ? 'Dein Studio ist auf der Karte sichtbar'
                      : 'Nicht auf der Karte sichtbar'}
                  </Text>
                </View>
                {!entitlement.canManageStudio && (
                  <TouchableOpacity
                    style={styles.editAboBtn}
                    activeOpacity={0.85}
                    onPress={() => {
                      void Linking.openURL(
                        `https://wa.me/4915566574802?text=${encodeURIComponent('Hallo, ich möchte mein Studio auf der Karte freischalten.')}`,
                      );
                    }}
                  >
                    <Text style={styles.editAboBtnText}>Per WhatsApp freischalten — 29 EUR/Monat</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Disciplines */}
              <View style={styles.editSection}>
                <Text style={styles.editSectionLabel}>Disziplinen</Text>
                <View style={styles.editDisciplinesGrid}>
                  {ALL_DISCIPLINES.map((d) => {
                    const active = draftDisciplines.includes(d);
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[styles.editDisciplineChip, active && styles.editDisciplineChipActive]}
                        onPress={() => toggleDiscipline(d)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.editDisciplineText, active && styles.editDisciplineTextActive]}>
                          {d}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Description */}
              <View style={styles.editSection}>
                <View style={styles.editSectionLabelRow}>
                  <Text style={styles.editSectionLabel}>Über uns</Text>
                  <Text style={styles.editCharCount}>
                    {draftDescription.length}/{MAX_DESCRIPTION}
                  </Text>
                </View>
                <TextInput
                  style={styles.editDescriptionInput}
                  value={draftDescription}
                  onChangeText={(t) => setDraftDescription(t.slice(0, MAX_DESCRIPTION))}
                  placeholder="Beschreibe dein Studio..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* Address / geocoding */}
              <View style={styles.editSection}>
                <Text style={styles.editSectionLabel}>Standort</Text>
                <View style={styles.editAddressRow}>
                  <TextInput
                    style={styles.editAddressInput}
                    value={draftAddress}
                    onChangeText={(t) => {
                      setDraftAddress(t);
                      setGeocodeLabel(null);
                      setDraftLat(null);
                      setDraftLng(null);
                    }}
                    placeholder="Straße, Hausnummer, Stadt"
                    placeholderTextColor={colors.textSecondary}
                    returnKeyType="search"
                    onSubmitEditing={() => { void handleGeocode(); }}
                  />
                  <TouchableOpacity
                    style={[styles.editGeocodeBtn, geocoding && styles.editGeocodeBtnDisabled]}
                    onPress={() => { void handleGeocode(); }}
                    disabled={geocoding}
                    activeOpacity={0.8}
                  >
                    {geocoding
                      ? <ActivityIndicator size="small" color={colors.card} />
                      : <Ionicons name="search" size={18} color={colors.card} />
                    }
                  </TouchableOpacity>
                </View>
                {geocodeLabel !== null && (
                  <Text style={[
                    styles.editGeocodeLabel,
                    draftLat !== null ? styles.editGeocodeLabelOk : styles.editGeocodeLabelErr,
                  ]}>
                    {draftLat !== null ? 'Gefunden: ' : ''}{geocodeLabel}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.bottomPad} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Read-only layout ───────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
      >
        <Ionicons name="chevron-back" size={22} color={colors.card} />
      </TouchableOpacity>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <StudioHero
          name={studio.name}
          city={studio.city}
          address={studio.address}
          bannerUrl={studio.banner_url}
          avatarUrl={studio.avatar_url}
          isOwner={isOwner}
          onEditPress={enterEditMode}
        />

        {canManage && <StudioOwnerBar studioId={studioId} studioName={studio.name} />}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Bewertungen</Text>
          <View style={styles.ratingSummaryRow}>
            <Ionicons name="star" size={18} color={colors.accentBlue} />
            <Text style={styles.ratingAvg}>
              {averageStars !== null ? averageStars.toFixed(1) : '–'}
            </Text>
            <Text style={styles.ratingCount}>
              {ratingCount === 0
                ? 'Noch keine Bewertungen'
                : `${ratingCount} ${ratingCount === 1 ? 'Bewertung' : 'Bewertungen'}`}
            </Text>
          </View>
          {isOwner ? (
            <TouchableOpacity
              style={styles.ratingActionBtn}
              onPress={() => setOwnerQrVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="qr-code-outline" size={18} color={colors.accentBlue} />
              <Text style={styles.ratingActionText}>Bewertungs-QR anzeigen</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.ratingActionBtn}
              onPress={() => setRatingScannerVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="qr-code-outline" size={18} color={colors.accentBlue} />
              <Text style={styles.ratingActionText}>Studio bewerten (QR scannen)</Text>
            </TouchableOpacity>
          )}
        </View>

        {studio.disciplines.length > 0 && (
          <DisciplineChips disciplines={studio.disciplines} />
        )}

        {studio.description !== null && studio.description.trim().length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Über uns</Text>
            <Text style={styles.description}>{studio.description}</Text>
          </View>
        )}

        {/* Map visibility status — always visible for the owner */}
        {isOwner && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Karte</Text>
            <View style={styles.aboRow}>
              <View style={[
                styles.aboDot,
                entitlement.canManageStudio
                  ? styles.aboDotActive
                  : styles.aboDotInactive,
              ]} />
              <Text style={styles.aboStatus}>
                {entitlement.canManageStudio
                  ? 'Dein Studio ist auf der Karte sichtbar'
                  : 'Nicht auf der Karte sichtbar'}
              </Text>
            </View>
            {!entitlement.canManageStudio && (
              <TouchableOpacity
                style={styles.aboBtn}
                activeOpacity={0.85}
                onPress={() => {
                  void Linking.openURL(
                    `https://wa.me/4915566574802?text=${encodeURIComponent('Hallo, ich möchte mein Studio auf der Karte freischalten.')}`,
                  );
                }}
              >
                <Text style={styles.aboBtnText}>Per WhatsApp freischalten — 29 EUR/Monat</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <StudioCoachesSection
          studioId={studioId}
          canManage={canManage}
          currentUserId={user?.id ?? null}
        />

        {/* Featured Fighters: row for all visitors, + add button for owner */}
        <View style={styles.sectionNopad}>
          <View style={styles.fightersHeader}>
            <Text style={[styles.sectionLabel, styles.sectionLabelPad]}>Featured Fighters</Text>
            {isOwner && (
              <TouchableOpacity
                style={[styles.addBtn, styles.sectionLabelPad]}
                onPress={() => setMemberPickerVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={18} color={colors.accentBlue} />
                <Text style={styles.addBtnText}>Hinzufügen</Text>
              </TouchableOpacity>
            )}
          </View>
          {(fighters.length > 0 || fightersLoading) && (
            <FeaturedFightersRow
              fighters={fighters}
              loading={fightersLoading}
              currentUserId={user?.id ?? null}
              onRemoveSelf={handleRemoveSelf}
            />
          )}
          {!fightersLoading && fighters.length === 0 && isOwner && (
            <Text style={styles.emptyTextPad}>Noch keine Featured Fighters hinzugefügt.</Text>
          )}
        </View>

        <View style={styles.content}>
          {activeBooking !== null ? (
            <View style={styles.statusCard}>
              <Ionicons
                name={activeBooking.status === 'confirmed' ? 'checkmark-circle' : 'time-outline'}
                size={20}
                color={activeBooking.status === 'confirmed' ? colors.difficultyGreen : colors.accentBlue}
              />
              <View style={styles.statusTextBlock}>
                <Text style={styles.statusTitle}>Probetraining-Anfrage</Text>
                <Text style={styles.statusValue}>
                  {STATUS_LABELS[activeBooking.status] ?? activeBooking.status}
                  {'  ·  '}
                  {activeBooking.requested_date.split('-').reverse().join('.')}
                </Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.bookBtn}
              onPress={() => setBookingSheetVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.card} />
              <Text style={styles.bookBtnText}>Probetraining buchen</Text>
            </TouchableOpacity>
          )}

          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setScheduleExpanded((prev) => !prev)}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionLabel}>Stundenplan</Text>
              <Ionicons
                name={scheduleExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.text}
              />
            </TouchableOpacity>
            {scheduleExpanded && (
              scheduleLoading ? (
                <ActivityIndicator color={colors.accentBlue} style={styles.loaderInline} />
              ) : schedule.length === 0 ? (
                <Text style={styles.emptyText}>Noch kein Stundenplan vorhanden.</Text>
              ) : (
                schedule.map((entry) => (
                  <View key={entry.id} style={styles.scheduleRow}>
                    <View style={styles.dayBadge}>
                      <Text style={styles.dayBadgeText}>{DAY_LABELS[entry.day_of_week]}</Text>
                    </View>
                    <View style={styles.scheduleInfo}>
                      <Text style={styles.scheduleName}>{entry.training_name}</Text>
                      <Text style={styles.scheduleMeta}>
                        {entry.start_time.slice(0, 5)}  ·  {entry.duration_min} Min.
                      </Text>
                    </View>
                    {entry.drop_in_enabled && (
                      <TouchableOpacity
                        style={styles.dropInBtn}
                        onPress={() => setDropInEntry(entry)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.dropInBtnText}>Drop-in</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )
            )}
            {canManage && (
              <TouchableOpacity
                style={[styles.scheduleEditToggle, scheduleEditorOpen && styles.scheduleEditToggleActive]}
                onPress={() => setScheduleEditorOpen((v) => !v)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="create-outline"
                  size={18}
                  color={scheduleEditorOpen ? colors.card : colors.text}
                />
                <Text style={[styles.scheduleEditToggleLabel, scheduleEditorOpen && styles.scheduleEditToggleLabelActive]}>
                  Stundenplan bearbeiten
                </Text>
              </TouchableOpacity>
            )}
            {canManage && scheduleEditorOpen && (
              <StudioScheduleCalendar
                studioId={studioId}
                schedule={schedule}
                loading={scheduleLoading}
                onRefetch={refetchSchedule}
              />
            )}
          </View>

          {/* Owner-only: planned sparrings management */}
          {canManage && studioSparrings.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Geplante Sparrings</Text>
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
                      <Ionicons name="close-circle-outline" size={20} color={colors.deleteRed} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

          <MembershipPlansList
            studioId={studioId}
            plans={plans}
            loading={plansLoading}
            activeContract={activeContract}
          />
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>

      <TrialBookingSheet
        visible={bookingSheetVisible}
        studioId={studioId}
        schedule={schedule}
        onClose={() => setBookingSheetVisible(false)}
        onBooked={() => { refetch(); }}
      />
      <DropInSheet
        visible={dropInEntry !== null}
        studioId={studioId}
        entry={dropInEntry}
        onClose={() => setDropInEntry(null)}
        onBooked={() => { refetch(); }}
      />
      <MemberMultiPickerSheet
        visible={memberPickerVisible}
        studioId={studioId}
        excludeIds={fighters.map((f) => f.userId)}
        title="Fighters hinzufügen"
        onClose={() => setMemberPickerVisible(false)}
        onConfirm={async (ids) => {
          const { error } = await addFighters(ids);
          if (error !== null) Alert.alert('Fehler', error);
        }}
      />

      <QRScannerModal
        visible={ratingScannerVisible}
        onClose={() => setRatingScannerVisible(false)}
        onScanned={handleRatingScan}
        headerTitle="Studio bewerten"
        hintText="QR-Code des Studios scannen"
      />

      {ratingSheetVisible && (
        <StudioRatingSheet
          visible
          studioId={studioId}
          studioName={studio.name}
          onClose={() => setRatingSheetVisible(false)}
          onSubmitted={() => setRatingRefetch((n) => n + 1)}
        />
      )}

      <Modal
        visible={ownerQrVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setOwnerQrVisible(false)}
      >
        <TouchableOpacity
          style={styles.qrModalBackdrop}
          activeOpacity={1}
          onPress={() => setOwnerQrVisible(false)}
        >
          <View style={styles.qrModalSheet}>
            <View style={styles.qrModalHandle} />
            <Text style={styles.qrModalTitle}>Bewertungs-QR</Text>
            <QRCode
              value={buildStudioQr(studioId)}
              size={200}
              color={colors.text}
              backgroundColor={colors.card}
            />
            <Text style={styles.qrModalHint}>
              Hänge diesen Code im Studio aus. Mitglieder scannen ihn in Sparr, um dein Studio zu bewerten.
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  backBtn: {
    position: 'absolute',
    top: 56,
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.heroFloatingBtn,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  backBtnStandalone: {
    margin: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    marginTop: 48,
  },
  loaderInline: {
    marginVertical: 8,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
  },
  sectionNopad: {
    marginTop: 16,
  },
  ratingSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingAvg: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  ratingCount: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  ratingActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accentBlueSoft,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 8,
  },
  ratingActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accentBlue,
  },
  qrModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.mapOverlay,
  },
  qrModalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  qrModalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  qrModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  qrModalHint: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabelPad: {
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.accentBlue,
  },
  bookBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.card,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  statusTextBlock: {
    flex: 1,
    gap: 2,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  statusValue: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 8,
  },
  emptyTextPad: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dayBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  scheduleInfo: {
    flex: 1,
    gap: 2,
  },
  scheduleName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  scheduleMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  dropInBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.accentBlue,
  },
  dropInBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  bottomPad: {
    height: 48,
  },

  // ── Always-on owner: map status card ──────────────────────────────────────
  aboRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aboDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  aboDotActive: {
    backgroundColor: colors.accentBlue,
  },
  aboDotInactive: {
    backgroundColor: colors.textSecondary,
  },
  aboStatus: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  aboBtn: {
    backgroundColor: colors.accentBlue,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  aboBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.card,
  },

  // ── Always-on owner: Featured Fighters add button ─────────────────────────
  fightersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentBlue,
  },

  // ── Edit-mode styles ───────────────────────────────────────────────────────
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  editHeaderBtn: {
    minWidth: 80,
    alignItems: 'flex-start',
  },
  editHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  editCancelText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  editSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accentBlue,
    textAlign: 'right',
  },
  editBanner: {
    height: 180,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBannerImage: {
    resizeMode: 'cover',
  },
  editBannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.heroBannerScrim,
  },
  editBannerHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.heroFloatingBtn,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editBannerHintText: {
    color: colors.card,
    fontSize: 14,
    fontWeight: '600',
  },
  editAvatarRow: {
    paddingHorizontal: 16,
    marginTop: -36,
    marginBottom: 8,
  },
  editAvatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: colors.card,
  },
  editAvatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
  },
  editAvatarPlaceholder: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAvatarInitials: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.card,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  editContent: {
    padding: 16,
    gap: 16,
  },
  editSection: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  editSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  editSectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editCharCount: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  editAboRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editAboDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  editAboDotActive: {
    backgroundColor: colors.accentBlue,
  },
  editAboDotInactive: {
    backgroundColor: colors.textSecondary,
  },
  editAboStatus: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  editAboBtn: {
    backgroundColor: colors.accentBlue,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editAboBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.card,
  },
  editDisciplinesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  editDisciplineChip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editDisciplineChipActive: {
    backgroundColor: colors.accentBlueSoft,
    borderColor: colors.accentBlue,
  },
  editDisciplineText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  editDisciplineTextActive: {
    color: colors.accentBlue,
    fontWeight: '600',
  },
  editDescriptionInput: {
    fontSize: 14,
    color: colors.text,
    minHeight: 100,
    lineHeight: 20,
  },
  editAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editAddressInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editGeocodeBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editGeocodeBtnDisabled: {
    opacity: 0.5,
  },
  editGeocodeLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  editGeocodeLabelOk: {
    color: colors.accentBlue,
  },
  editGeocodeLabelErr: {
    color: colors.deleteRed,
  },

  // ── Owner schedule editor toggle ───────────────────────────────────────────
  scheduleEditToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
  },
  scheduleEditToggleActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  scheduleEditToggleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  scheduleEditToggleLabelActive: {
    color: colors.card,
  },

  // ── Owner: planned sparrings list ──────────────────────────────────────────
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
});
