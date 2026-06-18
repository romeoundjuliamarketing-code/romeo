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
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useFocusRefetch } from '../hooks/useFocusRefetch';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import FightRecordCard from '../components/profil/FightRecordCard';
import AddFightSheet from '../components/profil/AddFightSheet';
import ProfileHero from '../components/profil/ProfileHero';
import ProfileTabBar from '../components/profil/ProfileTabBar';
import type { ProfileTab } from '../components/profil/ProfileTabBar';
import OverviewTab from '../components/profil/OverviewTab';
import StatsTab from '../components/profil/StatsTab';
import { useWorkoutStats } from '../hooks/useWorkoutStats';
import { useFightRecord } from '../hooks/useFightRecord';
import { useStudio } from '../hooks/useStudio';
import { useMyStudioRequests } from '../hooks/useMyStudioRequests';
import { useProfile } from '../hooks/useProfile';
import { useWeight } from '../hooks/useWeight';
import { useEntitlement } from '../hooks/useEntitlement';
import { useStudioInvite } from '../hooks/useStudioInvite';
import { useVerification } from '../hooks/useVerification';
import { supabase } from '../lib/supabase';
import QRScannerModal from '../components/profil/QRScannerModal';

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfilScreen(): React.ReactElement {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [focusTrigger, setFocusTrigger] = useState(0);
  useFocusRefetch(() => setFocusTrigger((n) => n + 1));

  // ── Hooks ──
  const { totalPoints, totalWorkouts, streak, rank } = useWorkoutStats(focusTrigger);
  const { currentStudio, requestJoin, leaveStudio: _leaveStudio, removeMember: _removeMember, searchStudios, createStudio } = useStudio(focusTrigger);
  const { joinRequests, cancelJoinRequest, refetch: refetchMyRequests } = useMyStudioRequests(focusTrigger);
  const { profile, uploadAvatar, updateProfile } = useProfile(focusTrigger);
  const { acceptInvite } = useStudioInvite();
  const { currentWeight, isNewWeek, logWeight } = useWeight(focusTrigger);
  const { entitlement } = useEntitlement(focusTrigger);
  const { fights, loading: fightsLoading, addFight, deleteFight } = useFightRecord(focusTrigger);
  const { tier } = useVerification(focusTrigger);

  // ── Local state ──
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [fightSheetVisible, setFightSheetVisible] = useState(false);
  const [qrSheetVisible, setQrSheetVisible] = useState(false);

  // Fighter search modal
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchCode,  setSearchCode]  = useState('');
  const [searching,   setSearching]   = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);

  // Weekly weight tracking modal
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [weightDraft, setWeightDraft] = useState('');
  const [weightSaving, setWeightSaving] = useState(false);

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

  async function handleShare(): Promise<void> {
    if (profile === null) return;
    await Share.share({
      message: `Kämpferprofil: ${profile.name ?? 'Unbekannt'} — Code: ${profile.profile_code}`,
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero header ── */}
        <ProfileHero
          profile={profile}
          tier={tier}
          fights={fights}
          totalPoints={totalPoints}
          streak={streak}
          onPressSettings={() => navigation.navigate('Settings')}
          onPressSearch={() => {
            setSearchCode('');
            setSearchError(null);
            setSearchModalVisible(true);
          }}
          onPressShare={() => setQrSheetVisible(true)}
          onPressEdit={() => navigation.navigate('EditProfile')}
          onUploadAvatar={uploadAvatar}
          onPressFights={() => setActiveTab('record')}
          onPressPoints={() => navigation.navigate('PointsBreakdown')}
          onPressStreak={() => navigation.navigate('AttendanceHistory')}
        />

        {/* ── Tab bar ── */}
        <ProfileTabBar activeTab={activeTab} onTabPress={setActiveTab} />

        {/* ── Tab content ── */}
        <View style={styles.tabContent}>
          {activeTab === 'overview' && (
            <OverviewTab
              profile={profile}
              tier={tier}
              currentStudio={currentStudio}
              focusTrigger={focusTrigger}
              canCreateStudio={entitlement.canCreateStudio}
              onRequestJoin={handleRequestJoin}
              onSearchStudios={searchStudios}
              onCreateStudio={createStudio}
              onRedeemCode={handleRedeemCode}
              pendingStudioName={pendingStudioName}
              onCancelRequest={handleCancelJoinRequest}
              onViewTeam={
                currentStudio !== null
                  ? () => navigation.navigate('StudioDetail', { studioId: currentStudio.id })
                  : undefined
              }
              onOpenVerification={() => navigation.navigate('Verification')}
            />
          )}

          {activeTab === 'record' && (
            <View style={styles.recordTab}>
              <FightRecordCard
                fights={fights}
                loading={fightsLoading}
                onAdd={() => setFightSheetVisible(true)}
                onDelete={async (id) => { await deleteFight(id); }}
              />
            </View>
          )}

          {activeTab === 'stats' && (
            <StatsTab
              totalPoints={totalPoints}
              streak={streak}
              totalWorkouts={totalWorkouts}
              rank={rank}
              hasAccess={entitlement.hasAccess}
              currentWeight={currentWeight}
              isNewWeek={isNewWeek}
              onPressPoints={() => navigation.navigate('PointsBreakdown')}
              onPressStreak={() => navigation.navigate('AttendanceHistory')}
              onPressWorkouts={() => navigation.navigate('WorkoutHistory')}
              onPressWeightLog={() => {
                setWeightDraft(currentWeight !== null ? String(currentWeight) : '');
                setWeightModalVisible(true);
              }}
              onPressWeightHistory={() => navigation.navigate('WeightHistory')}
              onPressPaywall={() => navigation.navigate('Paywall')}
            />
          )}
        </View>
      </ScrollView>

      {/* ── AddFight Sheet ── */}
      <AddFightSheet
        visible={fightSheetVisible}
        onClose={() => setFightSheetVisible(false)}
        onSaved={() => {}}
        addFight={addFight}
      />

      {/* ── QR / Share Sheet ── */}
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
                placeholderTextColor={colors.textSecondary}
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
              <Ionicons name="qr-code-outline" size={18} color={colors.accentBlue} />
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

      {/* ── Weekly body-weight tracking modal ── */}
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
          <TouchableOpacity
            style={styles.weightBackdrop}
            activeOpacity={1}
            onPress={() => setWeightModalVisible(false)}
          />
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  tabContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  recordTab: {
    paddingBottom: 32,
  },

  // QR Sheet
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.mapOverlay,
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
    textAlign: 'center',
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
    color: colors.textSecondary,
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
    color: colors.text,
    letterSpacing: 2,
  },
  codeSearchBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeSearchBtnDisabled: {
    backgroundColor: colors.accentBlueMuted,
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
    borderColor: colors.accentBlue,
    paddingVertical: 12,
  },
  qrScanBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accentBlue,
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
    color: colors.textSecondary,
  },
  ownCodeValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.accentBlue,
    letterSpacing: 2,
  },

  // Weekly weight modal
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
