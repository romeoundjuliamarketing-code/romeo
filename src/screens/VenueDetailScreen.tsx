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
import { useVenueProfile } from '../hooks/useVenueProfile';
import { useVenuePhotos } from '../hooks/useVenuePhotos';
import { useVenueEvents } from '../hooks/useVenueEvents';
import { useVenueRatings } from '../hooks/useVenueRatings';
import { geocodeAddress } from '../utils/geocoding';
import VenueHero from '../components/venue/VenueHero';
import VenuePhotoGallery from '../components/venue/VenuePhotoGallery';
import VenueInfoSection from '../components/venue/VenueInfoSection';
import VenueEventsList from '../components/venue/VenueEventsList';
import VenueOwnerBar from '../components/venue/VenueOwnerBar';
import VenueRatingSheet from '../components/venue/VenueRatingSheet';
import EventDetailSheet from '../components/sparring/EventDetailSheet';
import type { EventWithMeta } from '../hooks/useOpenEvents';

type Props = NativeStackScreenProps<RootStackParamList, 'VenueDetail'>;

const MAX_DESCRIPTION = 300;

// Day keys and labels must match VenueInfoSection exactly (DAY_ORDER / DAY_LABELS there).
const EDIT_DAY_ORDER: { key: string; label: string }[] = [
  { key: 'mon', label: 'Mo' },
  { key: 'tue', label: 'Di' },
  { key: 'wed', label: 'Mi' },
  { key: 'thu', label: 'Do' },
  { key: 'fri', label: 'Fr' },
  { key: 'sat', label: 'Sa' },
  { key: 'sun', label: 'So' },
];

export default function VenueDetailScreen({ route, navigation }: Props): React.ReactElement {
  const { venueId } = route.params;
  const { user } = useAuth();

  const { venue, loading: venueLoading, refetch: refetchVenue } = useVenueProfile(venueId);
  const { photos, refetch: refetchPhotos } = useVenuePhotos(venueId);
  const { events, refetch: refetchEvents } = useVenueEvents(venueId);

  const [ratingRefetch, setRatingRefetch] = useState(0);
  const { averageStars, ratingCount } = useVenueRatings(venueId, ratingRefetch);

  const [ratingSheetVisible, setRatingSheetVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventWithMeta | null>(null);

  // ── Edit-mode state ────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [draftName,         setDraftName]         = useState('');
  const [draftDescription,  setDraftDescription]  = useState('');
  const [draftVenueType,    setDraftVenueType]    = useState('');
  const [draftCapacity,     setDraftCapacity]     = useState('');
  const [draftHours,        setDraftHours]        = useState<Record<string, string>>({});
  const [draftInstagram,    setDraftInstagram]    = useState('');
  const [draftAddress,      setDraftAddress]      = useState('');
  const [draftLat,          setDraftLat]          = useState<number | null>(null);
  const [draftLng,          setDraftLng]          = useState<number | null>(null);
  const [draftBannerUri,    setDraftBannerUri]    = useState<string | null>(null);
  const [draftAvatarUri,    setDraftAvatarUri]    = useState<string | null>(null);
  const [geocoding,         setGeocoding]         = useState(false);
  const [geocodeLabel,      setGeocodeLabel]      = useState<string | null>(null);
  const [saving,            setSaving]            = useState(false);

  const isOwner = venue !== null && user !== null && venue.owner_user_id === user.id;

  // Seed draft state whenever venue data loads (or reloads after a save).
  useEffect(() => {
    if (venue === null) return;
    setDraftName(venue.name);
    setDraftDescription(venue.description ?? '');
    setDraftVenueType(venue.venue_type);
    setDraftCapacity(venue.capacity !== null ? String(venue.capacity) : '');
    setDraftHours({ ...(venue.opening_hours ?? {}) });
    setDraftInstagram(venue.instagram ?? '');
    setDraftAddress(venue.address ?? '');
    setDraftLat(venue.lat);
    setDraftLng(venue.lng);
    setGeocodeLabel(
      venue.lat !== null
        ? `${venue.lat.toFixed(4)}, ${venue.lng?.toFixed(4)}`
        : null,
    );
  }, [venue]);

  // ── Edit-mode helpers ──────────────────────────────────────────────────────

  function enterEditMode(): void {
    if (venue !== null) {
      setDraftName(venue.name);
      setDraftDescription(venue.description ?? '');
      setDraftVenueType(venue.venue_type);
      setDraftCapacity(venue.capacity !== null ? String(venue.capacity) : '');
      setDraftHours({ ...(venue.opening_hours ?? {}) });
      setDraftInstagram(venue.instagram ?? '');
      setDraftAddress(venue.address ?? '');
      setDraftLat(venue.lat);
      setDraftLng(venue.lng);
      setGeocodeLabel(
        venue.lat !== null
          ? `${venue.lat.toFixed(4)}, ${venue.lng?.toFixed(4)}`
          : null,
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

  async function handlePickGalleryPhoto(): Promise<void> {
    const uri = await pickImage([1, 1]);
    if (uri === null) return;
    const timestamp = Date.now();
    const { url, error } = await uploadImage(uri, 'venues', `${venueId}/photo-${timestamp}`);
    if (error !== null || url === null) {
      Alert.alert('Foto-Upload fehlgeschlagen', error ?? 'Unbekannter Fehler');
      return;
    }
    const { error: dbError } = await supabase
      .from('venue_photos')
      .insert({ venue_id: venueId, url, sort_order: timestamp });
    if (dbError !== null) {
      Alert.alert('Fehler beim Speichern', dbError.message);
      return;
    }
    refetchPhotos();
  }

  async function handleRemovePhoto(id: string): Promise<void> {
    Alert.alert('Foto entfernen', 'Dieses Foto wirklich entfernen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Entfernen',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('venue_photos').delete().eq('id', id);
          if (error !== null) Alert.alert('Fehler', error.message);
          else refetchPhotos();
        },
      },
    ]);
  }

  async function handleGeocode(): Promise<void> {
    const query = draftAddress.trim();
    if (query.length === 0) return;
    setGeocoding(true);
    setGeocodeLabel(null);
    const coords = await geocodeAddress(query);
    setGeocoding(false);
    if (coords === null) {
      setGeocodeLabel('Keine Ergebnisse gefunden.');
    } else {
      setDraftLat(coords.lat);
      setDraftLng(coords.lng);
      setGeocodeLabel(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
    }
  }

  async function handleSave(): Promise<void> {
    setSaving(true);
    try {
      const capacityNum = parseInt(draftCapacity, 10);

      // Build a cleaned opening_hours record — only include days with a non-empty value.
      const cleanedHours: Record<string, string> = {};
      for (const [k, v] of Object.entries(draftHours)) {
        if (v.trim().length > 0) cleanedHours[k] = v.trim();
      }

      const updates: Record<string, unknown> = {
        name:          draftName.trim().length > 0 ? draftName.trim() : venue?.name,
        description:   draftDescription.trim().length > 0 ? draftDescription.trim() : null,
        venue_type:    draftVenueType.trim().length > 0 ? draftVenueType.trim() : venue?.venue_type,
        capacity:      isNaN(capacityNum) || draftCapacity.trim().length === 0 ? null : capacityNum,
        opening_hours: Object.keys(cleanedHours).length > 0 ? cleanedHours : null,
        instagram:     draftInstagram.trim().length > 0 ? draftInstagram.trim() : null,
        address:       draftAddress.trim().length > 0 ? draftAddress.trim() : null,
        lat:           draftLat,
        lng:           draftLng,
      };

      if (draftBannerUri !== null) {
        const { url, error } = await uploadImage(draftBannerUri, 'venues', `${venueId}/banner`);
        if (error !== null) {
          Alert.alert('Banner-Upload fehlgeschlagen', error);
          return;
        }
        updates.banner_url = url;
      }

      if (draftAvatarUri !== null) {
        const { url, error } = await uploadImage(draftAvatarUri, 'venues', `${venueId}/avatar`);
        if (error !== null) {
          Alert.alert('Avatar-Upload fehlgeschlagen', error);
          return;
        }
        updates.avatar_url = url;
      }

      const { error } = await supabase
        .from('venues')
        .update(updates)
        .eq('id', venueId);

      if (error !== null) {
        Alert.alert('Fehler beim Speichern', error.message);
        return;
      }

      refetchVenue();
      setDraftBannerUri(null);
      setDraftAvatarUri(null);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  // Create event — Task 10 will wire up CreateEventSheet with venueId.
  // For now: show a placeholder Alert so the build stays green.
  function handleCreateEvent(): void {
    Alert.alert('Demnächst', 'Event-Erstellung folgt in einem der nächsten Updates.');
  }

  // Block the whole screen only while the venue itself has no data yet.
  const isLoading = venueLoading && venue === null;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator style={styles.loader} color={colors.accentBlue} />
      </SafeAreaView>
    );
  }

  if (venue === null) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TouchableOpacity style={styles.backBtnStandalone} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Derived display values in edit mode: prefer local draft URIs over stored URLs.
  const displayBanner = draftBannerUri ?? venue.banner_url ?? null;
  const displayAvatar = draftAvatarUri ?? venue.avatar_url ?? null;

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
          <TouchableOpacity
            onPress={() => { void handleSave(); }}
            disabled={saving}
            style={styles.editHeaderBtn}
          >
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
                      {venue.name.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.editAvatarBadge}>
                  <Ionicons name="camera" size={14} color={colors.card} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.editContent}>
              {/* Name */}
              <View style={styles.editSection}>
                <Text style={styles.editSectionLabel}>Name</Text>
                <TextInput
                  style={styles.editTextInput}
                  value={draftName}
                  onChangeText={setDraftName}
                  placeholder="Name des Venues"
                  placeholderTextColor={colors.textSecondary}
                  returnKeyType="done"
                />
              </View>

              {/* Venue type */}
              <View style={styles.editSection}>
                <Text style={styles.editSectionLabel}>Typ</Text>
                <TextInput
                  style={styles.editTextInput}
                  value={draftVenueType}
                  onChangeText={setDraftVenueType}
                  placeholder="z. B. Halle, Gym, Outdoor"
                  placeholderTextColor={colors.textSecondary}
                  returnKeyType="done"
                />
              </View>

              {/* Capacity */}
              <View style={styles.editSection}>
                <Text style={styles.editSectionLabel}>Kapazität (Personen)</Text>
                <TextInput
                  style={styles.editTextInput}
                  value={draftCapacity}
                  onChangeText={setDraftCapacity}
                  placeholder="z. B. 200"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                  returnKeyType="done"
                />
              </View>

              {/* Description */}
              <View style={styles.editSection}>
                <View style={styles.editSectionLabelRow}>
                  <Text style={styles.editSectionLabel}>Beschreibung</Text>
                  <Text style={styles.editCharCount}>
                    {draftDescription.length}/{MAX_DESCRIPTION}
                  </Text>
                </View>
                <TextInput
                  style={styles.editDescriptionInput}
                  value={draftDescription}
                  onChangeText={(t) => setDraftDescription(t.slice(0, MAX_DESCRIPTION))}
                  placeholder="Beschreibe dein Venue..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* Opening hours — 7-day structured editor (same keys/order as VenueInfoSection) */}
              <View style={styles.editSection}>
                <Text style={styles.editSectionLabel}>Öffnungszeiten</Text>
                {EDIT_DAY_ORDER.map(({ key, label }) => (
                  <View key={key} style={styles.editHoursRow}>
                    <Text style={styles.editHoursDayLabel}>{label}</Text>
                    <TextInput
                      style={styles.editHoursInput}
                      value={draftHours[key] ?? ''}
                      onChangeText={(t) => setDraftHours((prev) => ({ ...prev, [key]: t }))}
                      placeholder="17:00-23:00"
                      placeholderTextColor={colors.textSecondary}
                      returnKeyType="done"
                    />
                  </View>
                ))}
              </View>

              {/* Instagram */}
              <View style={styles.editSection}>
                <Text style={styles.editSectionLabel}>Instagram</Text>
                <TextInput
                  style={styles.editTextInput}
                  value={draftInstagram}
                  onChangeText={setDraftInstagram}
                  placeholder="https://instagram.com/dearvenue"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  keyboardType="url"
                  returnKeyType="done"
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
        <VenueHero
          venue={venue}
          onEditAvatar={isOwner ? () => { void handlePickAvatar(); } : undefined}
          onEditBanner={isOwner ? () => { void handlePickBanner(); } : undefined}
        />

        {isOwner && (
          <VenueOwnerBar
            onEditProfile={enterEditMode}
            onCreateEvent={handleCreateEvent}
          />
        )}

        {/* Ratings summary */}
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
          {!isOwner && (
            <TouchableOpacity
              style={styles.ratingActionBtn}
              onPress={() => setRatingSheetVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="star-outline" size={18} color={colors.accentBlue} />
              <Text style={styles.ratingActionText}>Venue bewerten</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Info section (description, type, address, capacity, hours, tags, instagram) */}
        <VenueInfoSection venue={venue} />

        {/* Photo gallery */}
        <View style={styles.gallerySection}>
          <Text style={styles.sectionLabelPad}>Fotos</Text>
          <VenuePhotoGallery
            photos={photos}
            editable={isOwner}
            onAdd={isOwner ? () => { void handlePickGalleryPhoto(); } : undefined}
            onRemovePhoto={isOwner ? handleRemovePhoto : undefined}
          />
        </View>

        {/* Events */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Kommende Events</Text>
          <VenueEventsList
            events={events}
            onPressEvent={(e) => setSelectedEvent(e)}
          />
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>

      {ratingSheetVisible && (
        <VenueRatingSheet
          visible
          venueId={venueId}
          venueName={venue.name}
          onClose={() => setRatingSheetVisible(false)}
          onSubmitted={() => setRatingRefetch((n) => n + 1)}
        />
      )}

      {/* EventDetailSheet — wired to the same pattern as SparringMapScreen */}
      <EventDetailSheet
        event={selectedEvent}
        currentUserId={user?.id ?? null}
        loading={false}
        onClose={() => setSelectedEvent(null)}
        onToggleSignup={() => { refetchEvents(); }}
        onDeactivate={() => { refetchEvents(); }}
        onOpenChat={() => {
          // Chat navigation is available once an event is selected.
          if (selectedEvent === null) return;
          setSelectedEvent(null);
          navigation.navigate('EventGroupChat', {
            eventId:     selectedEvent.id,
            eventTitle:  selectedEvent.title,
            scheduledAt: selectedEvent.scheduled_at,
            durationMin: selectedEvent.duration_min,
            isOrganizer: selectedEvent.created_by === user?.id,
          });
        }}
      />
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
  scroll: {
    flex: 1,
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
  gallerySection: {
    marginTop: 16,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionLabelPad: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
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
  bottomPad: {
    height: 48,
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
  editTextInput: {
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editDescriptionInput: {
    fontSize: 14,
    color: colors.text,
    minHeight: 80,
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
  editHoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  editHoursDayLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    width: 24,
  },
  editHoursInput: {
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
});
