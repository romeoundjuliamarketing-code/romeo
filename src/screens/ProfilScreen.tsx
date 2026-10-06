import React, { useState } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useFocusRefetch } from '../hooks/useFocusRefetch';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import FightRecordCard from '../components/profil/FightRecordCard';
import AddFightSheet from '../components/profil/AddFightSheet';
import type { FighterCardData } from '../components/profil/FighterCard';
import ProfileHeader from '../components/profil/ProfileHeader';
import ProfileShareSheet from '../components/profil/ProfileShareSheet';
import TeamPickerCard from '../components/profil/TeamPickerCard';
import SparringActivityCard from '../components/profil/SparringActivityCard';
import { SecondaryButton } from '../components/profil/ProfileParts';
import { BodyStats, ProfileBio, TrainingStatement } from '../components/profil/ProfileFacts';
import HomeGymBlock from '../components/profil/HomeGymBlock';
import GymPickerSheet from '../components/gym/GymPickerSheet';
import FocusedStatusBar from '../components/common/FocusedStatusBar';
import { useGym } from '../hooks/useGyms';
import type { Gym } from '../hooks/useGyms';
import { bodyStats, cardBackFacts, trainingHeadline } from '../utils/athleteProfile';
import { stanceLabel } from '../utils/stance';
import { useFightRecord } from '../hooks/useFightRecord';
import { useStudio } from '../hooks/useStudio';
import { useMyStudioRequests } from '../hooks/useMyStudioRequests';
import { useProfile } from '../hooks/useProfile';
import { useStudioInvite } from '../hooks/useStudioInvite';
import { useVerification } from '../hooks/useVerification';
import { useMyVenue } from '../hooks/useMyVenue';
import { supabase } from '../lib/supabase';
import QRScannerModal from '../components/profil/QRScannerModal';
import ProfileQrShareSheet from '../components/profil/ProfileQrShareSheet';

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfilScreen(): React.ReactElement {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [focusTrigger, setFocusTrigger] = useState(0);
  useFocusRefetch(() => setFocusTrigger((n) => n + 1));

  // ── Hooks ──
  const { currentStudio, requestJoin, leaveStudio, removeMember: _removeMember, searchStudios, createStudio } = useStudio(focusTrigger);
  const { joinRequests, cancelJoinRequest, refetch: refetchMyRequests } = useMyStudioRequests(focusTrigger);
  const { profile, updateProfile } = useProfile(focusTrigger);
  const { acceptInvite } = useStudioInvite();
  const { fights, loading: fightsLoading, addFight, deleteFight } = useFightRecord(focusTrigger);
  const { tier } = useVerification(focusTrigger);
  const { venueId } = useMyVenue(focusTrigger);
  const { gym: homeGym } = useGym(profile?.home_gym_id ?? null, focusTrigger);

  // ── Local state ──
  // "Profil teilen": preview of the collectible fighter card
  const [shareVisible, setShareVisible] = useState(false);
  const [fightSheetVisible, setFightSheetVisible] = useState(false);
  const [qrSheetVisible, setQrSheetVisible] = useState(false);
  const [gymPickerVisible, setGymPickerVisible] = useState(false);

  // Fighter search modal
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchCode,  setSearchCode]  = useState('');
  const [searching,   setSearching]   = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);

  // ── Handlers ──

  async function handleRedeemCode(code: string): Promise<{ error: string | null }> {
    // accept_studio_invite RPC already sets profiles.studio_id server-side.
    // Just redeem, then bump focusTrigger so useStudio reloads.
    const result = await acceptInvite(code);
    if (result.error !== null) return { error: result.error };
    setFocusTrigger((n) => n + 1);
    return { error: null };
  }

  // Pending join request (first one if any)
  const pendingJoinRequest = joinRequests.length > 0 ? joinRequests[0] : null;
  const pendingStudioName = pendingJoinRequest?.studio_name ?? null;

  async function handleRequestJoin(studioId: string): Promise<{ error: string | null }> {
    const result = await requestJoin(studioId);
    if (result.error === null) {
      setFocusTrigger((n) => n + 1);
      refetchMyRequests();
    }
    return result;
  }

  async function handleLeaveStudio(): Promise<{ error: string | null }> {
    const result = await leaveStudio();
    if (result.error === null) {
      setFocusTrigger((n) => n + 1);
      refetchMyRequests();
    }
    return result;
  }

  async function handleCancelJoinRequest(): Promise<void> {
    if (pendingJoinRequest === null) return;
    const { error } = await cancelJoinRequest(pendingJoinRequest.id);
    if (error !== null) {
      Alert.alert('Fehler', error);
      return;
    }
    setFocusTrigger((n) => n + 1);
    refetchMyRequests();
  }

  async function handleSearchByCode(codeArg?: string): Promise<void> {
    const trimmed = (codeArg ?? searchCode).trim().toUpperCase();
    if (trimmed.length === 0) return;
    setSearching(true);
    setSearchError(null);
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('profile_code', trimmed)
      .single();
    setSearching(false);
    if (error !== null || data === null) {
      setSearchError('Kein Kämpfer mit diesem Code gefunden.');
      return;
    }
    setSearchCode('');
    setSearchModalVisible(false);
    navigation.navigate('PublicProfile', { userId: (data as { id: string }).id });
  }



  const cardData: FighterCardData = {
    name:          profile?.name ?? null,
    nickname:      profile?.nickname ?? null,
    avatarUrl:     profile?.avatar_url ?? null,
    isVerified:    tier === 'verified',
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
  const bio = profile?.bio?.trim() ?? '';
  const openEdit = () => navigation.navigate('EditProfile');
  const openGym = (gymId: string) => navigation.navigate('GymDetail', { gymId });

  async function handleSelectHomeGym(gym: Gym): Promise<boolean> {
    const { error } = await updateProfile({ home_gym_id: gym.id });
    if (error !== null) {
      Alert.alert('Nicht gespeichert', 'Dein Gym konnte nicht gespeichert werden. Bitte versuche es erneut.');
      return false;
    }
    return true;
  }

  return (
    <View style={styles.safe}>
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
          toolbar={[
            {
              icon: 'search',
              label: 'Kämpfer suchen',
              onPress: () => {
                setSearchCode('');
                setSearchError(null);
                setSearchModalVisible(true);
              },
            },
            { icon: 'qr-code-outline', label: 'QR-Code und Profil-ID', onPress: () => setQrSheetVisible(true) },
            { icon: 'settings-outline', label: 'Einstellungen', onPress: () => navigation.navigate('Settings') },
          ]}
          actions={(
            <View style={styles.headerActions}>
              <SecondaryButton icon="create-outline" label="Bearbeiten" onPress={openEdit} />
              <SecondaryButton icon="share-social-outline" label="Teilen" onPress={() => setShareVisible(true)} />
            </View>
          )}
        />

        <View style={styles.page}>
          {/* About: body numbers, description and training belong together */}
          <View style={styles.group}>
            <BodyStats stats={profile !== null ? bodyStats(profile, stanceLabel(profile.stance)) : []} />
            <ProfileBio bio={bio} onAdd={openEdit} />
            <TrainingStatement headline={profile !== null ? trainingHeadline(profile) : null} onAdd={openEdit} />
          </View>

          <HomeGymBlock gym={homeGym} onOpen={openGym} onAdd={() => setGymPickerVisible(true)} />

          <FightRecordCard
            fights={fights}
            loading={fightsLoading}
            compact
            onAdd={() => setFightSheetVisible(true)}
            onDelete={async (id) => { await deleteFight(id); }}
          />

          <SparringActivityCard
            userId={profile?.id ?? null}
            isOwn
            refetchTrigger={focusTrigger}
            onOpenSparring={(id) => navigation.navigate('SparringMap', { focusSparringId: id })}
          />

          {/* Account matters, kept quiet at the end */}
          <View style={styles.manage}>
            {tier !== 'verified' && (
              <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('Verification')} accessibilityRole="button">
                <Ionicons name="shield-checkmark-outline" size={22} color={colors.accentBlue} />
                <View style={styles.flex}>
                  <Text style={styles.linkTitle}>Verifizierung</Text>
                  <Text style={styles.linkSub}>{tier === 'basic' ? 'Fast geschafft – ein Nachweis fehlt' : 'Nicht verifiziert'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
            {venueId !== null && (
              <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('VenueDetail', { venueId })} accessibilityRole="button">
                <Ionicons name="business-outline" size={22} color={colors.accentBlue} />
                <View style={styles.flex}>
                  <Text style={styles.linkTitle}>Meine Location</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
            {/* Confirmed team membership (studio_id) — separate from "Hier trainiere ich" */}
            <TeamPickerCard
              currentStudio={currentStudio}
              onRequestJoin={handleRequestJoin}
              onLeave={handleLeaveStudio}
              onSearch={searchStudios}
              onRedeemCode={handleRedeemCode}
              pendingStudioName={pendingStudioName}
              onCancelRequest={handleCancelJoinRequest}
              onCreate={async (name, city) => {
                const created = await createStudio(name, city);
                if (created === null) {
                  Alert.alert('Fehler', 'Studio konnte nicht erstellt werden.');
                }
                return created;
              }}
              onViewTeam={
                currentStudio !== null
                  ? () => openGym(currentStudio.id)
                  : undefined
              }
              inline
            />
          </View>
        </View>
      </ScrollView>

      <GymPickerSheet
        visible={gymPickerVisible}
        title="Wo trainierst du?"
        currentGymId={profile?.home_gym_id ?? null}
        onClose={() => setGymPickerVisible(false)}
        onSelect={handleSelectHomeGym}
      />

      <ProfileShareSheet
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        data={cardData}
        profileCode={profile?.profile_code ?? null}
        isOwn
        onSelectFrame={(frame) => updateProfile({ card_frame: frame })}
      />

      {/* ── AddFight Sheet ── */}
      <AddFightSheet
        visible={fightSheetVisible}
        onClose={() => setFightSheetVisible(false)}
        onSaved={() => {}}
        addFight={addFight}
      />

      {/* ── QR / Share Sheet ── */}
      <ProfileQrShareSheet
        visible={qrSheetVisible}
        onClose={() => setQrSheetVisible(false)}
        name={profile?.name ?? null}
        profileCode={profile?.profile_code ?? null}
        isOwn
      />

      {/* ── Fighter search modal ── */}
      <Modal
        visible={searchModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSearchModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.modalBackdropDismiss}
            activeOpacity={1}
            onPress={() => setSearchModalVisible(false)}
          />
          <View style={styles.searchSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Kämpfer suchen</Text>
            <Text style={styles.searchSubtitle}>Profil-Code eingeben</Text>
            <View style={styles.codeSearchRow}>
              <TextInput
                style={styles.codeInput}
                value={searchCode}
                onChangeText={(t) => { setSearchCode(t.toUpperCase()); setSearchError(null); }}
                placeholder="Code eingeben..."
                placeholderTextColor={colors.brandMuted}
                autoCapitalize="characters"
                maxLength={12}
                autoFocus
                returnKeyType="search"
                onSubmitEditing={() => { void handleSearchByCode(); }}
              />
              <TouchableOpacity
                style={[styles.codeSearchBtn, searching && styles.codeSearchBtnDisabled]}
                onPress={() => { void handleSearchByCode(); }}
                disabled={searching}
                activeOpacity={0.8}
              >
                {searching
                  ? <ActivityIndicator size="small" color={colors.card} />
                  : <Ionicons name="search" size={18} color={colors.card} />
                }
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.qrScanBtn}
              onPress={() => setScannerVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="qr-code-outline" size={18} color={colors.brandPrimary} />
              <Text style={styles.qrScanBtnText}>QR scannen</Text>
            </TouchableOpacity>
            {searchError !== null && (
              <Text style={styles.codeSearchError}>{searchError}</Text>
            )}
            {/* Own profile code for sharing */}
            {profile?.profile_code !== undefined && profile.profile_code.length > 0 && (
              <View style={styles.ownCodeRow}>
                <Text style={styles.ownCodeLabel}>Mein Code</Text>
                <Text style={styles.ownCodeValue}>{profile.profile_code}</Text>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── QR Scanner ── */}
      <QRScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={(code) => {
          setScannerVisible(false);
          void handleSearchByCode(code);
        }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
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
  manage: {
    gap: 16,
  },
  flex: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 48,
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  linkSub: {
    fontSize: 13,
    color: colors.textMuted,
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
    color: colors.brandInk,
    textAlign: 'center',
  },

  // Search modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdropDismiss: {
    flex: 1,
    backgroundColor: colors.mapOverlay,
  },
  searchSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 48,
    gap: 12,
  },
  searchSubtitle: {
    fontSize: 14,
    color: colors.brandMuted,
    marginTop: -4,
  },
  codeSearchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  codeInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.brandInk,
    letterSpacing: 2,
  },
  codeSearchBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeSearchBtnDisabled: {
    backgroundColor: colors.brandPrimarySoft,
  },
  codeSearchError: {
    fontSize: 13,
    color: colors.deleteRed,
  },
  qrScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    paddingVertical: 12,
  },
  qrScanBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.brandPrimary,
  },
  ownCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ownCodeLabel: {
    fontSize: 13,
    color: colors.brandMuted,
  },
  ownCodeValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.brandPrimary,
    letterSpacing: 2,
  },
});
