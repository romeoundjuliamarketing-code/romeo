import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { Studio } from '../../hooks/useStudio';

interface Props {
  currentStudio: Studio | null;
  onJoin: (studioId: string) => Promise<void>;
  onSearch: (query: string) => Promise<Studio[]>;
  onCreate: (name: string, city: string) => Promise<Studio | null>;
  onRedeemCode?: (code: string) => Promise<{ error: string | null }>;
  canCreateStudio?: boolean;
  onCreateBlocked?: () => void;
  onViewTeam?: () => void;
  inline?: boolean;
}

export default function TeamPickerCard({
  currentStudio,
  onJoin,
  onSearch,
  onCreate,
  onRedeemCode,
  canCreateStudio = true,
  onCreateBlocked,
  onViewTeam,
  inline = false,
}: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Studio[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  // Create-studio form state
  const [createMode, setCreateMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCity, setNewCity] = useState('');
  const [creating, setCreating] = useState(false);

  // Invite code state
  const [inviteCode, setInviteCode] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  // Load all studios when modal opens
  useEffect(() => {
    if (!modalVisible) return;
    setQuery('');
    runSearch('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalVisible]);

  async function runSearch(q: string): Promise<void> {
    setSearching(true);
    const studios = await onSearch(q);
    setResults(studios);
    setSearching(false);
  }

  function handleQueryChange(text: string): void {
    setQuery(text);
    runSearch(text);
  }

  function closeModal(): void {
    setModalVisible(false);
    setCreateMode(false);
    setNewName('');
    setNewCity('');
    setInviteCode('');
    setRedeemError(null);
  }

  async function handleJoin(studio: Studio): Promise<void> {
    setSaving(true);
    await onJoin(studio.id);
    setSaving(false);
    closeModal();
  }

  async function handleRedeemCode(): Promise<void> {
    if (onRedeemCode === undefined || inviteCode.length !== 6) return;
    setRedeemLoading(true);
    setRedeemError(null);
    const result = await onRedeemCode(inviteCode);
    setRedeemLoading(false);
    if (result.error !== null) {
      setRedeemError(result.error);
      return;
    }
    closeModal();
  }

  async function handleCreate(): Promise<void> {
    if (newName.trim().length === 0 || newCity.trim().length === 0) return;
    setCreating(true);
    await onCreate(newName, newCity);
    setCreating(false);
    closeModal();
  }

  const cardContent = (
    <>
      <View style={styles.cardHeader}>
        <Ionicons name="people-outline" size={20} color={colors.accentBlue} />
        <Text style={styles.cardTitle}>Dein Team</Text>
      </View>

      {currentStudio !== null ? (
        <View style={styles.studioRow}>
          <TouchableOpacity style={styles.studioInfo} onPress={onViewTeam} activeOpacity={0.7} disabled={onViewTeam === undefined}>
            <Text style={styles.studioName}>{currentStudio.name}</Text>
            <Text style={styles.studioCity}>{currentStudio.city}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.changeBtn} onPress={() => setModalVisible(true)}>
            <Text style={styles.changeBtnText}>Wechseln</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.joinBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add-circle-outline" size={18} color={colors.accentBlue} />
          <Text style={styles.joinBtnText}>Team beitreten</Text>
        </TouchableOpacity>
      )}
    </>
  );

  return (
    <>
      {inline ? (
        <View style={styles.inlineWrapper}>{cardContent}</View>
      ) : (
        <View style={styles.card}>{cardContent}</View>
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalSafe}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Studio suchen</Text>
            <TouchableOpacity onPress={closeModal} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Search input */}
          <View style={styles.searchWrapper}>
            <Ionicons name="search-outline" size={18} color={colors.inactive} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Name oder Stadt..."
              placeholderTextColor={colors.inactive}
              value={query}
              onChangeText={handleQueryChange}
              autoFocus
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => handleQueryChange('')}>
                <Ionicons name="close-circle" size={18} color={colors.inactive} />
              </TouchableOpacity>
            )}
          </View>

          {/* Results */}
          {searching ? (
            <ActivityIndicator style={styles.loader} color={colors.accentBlue} />
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isActive = currentStudio?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.resultItem, isActive && styles.resultItemActive]}
                    onPress={() => { void handleJoin(item); }}
                    disabled={saving}
                  >
                    <View style={styles.resultInfo}>
                      <Text style={[styles.resultName, isActive && styles.resultNameActive]}>
                        {item.name}
                      </Text>
                      <Text style={styles.resultCity}>{item.city}</Text>
                    </View>
                    {isActive && <Ionicons name="checkmark-circle" size={22} color={colors.accentBlue} />}
                    {saving && !isActive && <ActivityIndicator size="small" color={colors.accentBlue} />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Kein Studio gefunden.</Text>
              }
              ListFooterComponent={
                <>
                  {createMode ? (
                    <View style={styles.createForm}>
                      <Text style={styles.createTitle}>Neues Studio erstellen</Text>
                      <TextInput
                        style={styles.createInput}
                        placeholder="Name des Studios"
                        placeholderTextColor={colors.inactive}
                        value={newName}
                        onChangeText={setNewName}
                        returnKeyType="next"
                      />
                      <TextInput
                        style={styles.createInput}
                        placeholder="Stadt"
                        placeholderTextColor={colors.inactive}
                        value={newCity}
                        onChangeText={setNewCity}
                        returnKeyType="done"
                        onSubmitEditing={() => { void handleCreate(); }}
                      />
                      <View style={styles.createActions}>
                        <TouchableOpacity
                          style={styles.createCancelBtn}
                          onPress={() => setCreateMode(false)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.createCancelLabel}>Abbrechen</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.createConfirmBtn, (newName.trim().length === 0 || newCity.trim().length === 0) && styles.createConfirmBtnDisabled]}
                          onPress={() => { void handleCreate(); }}
                          disabled={creating || newName.trim().length === 0 || newCity.trim().length === 0}
                          activeOpacity={0.8}
                        >
                          {creating
                            ? <ActivityIndicator size="small" color={colors.headerTextPrimary} />
                            : <Text style={styles.createConfirmLabel}>Erstellen</Text>}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.createHint}
                      onPress={() => {
                        if (canCreateStudio) {
                          setCreateMode(true);
                          return;
                        }
                        onCreateBlocked?.();
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add-circle-outline" size={18} color={colors.accentBlue} />
                      <Text style={styles.createHintLabel}>
                        {canCreateStudio
                          ? 'Studio nicht gefunden? Neu erstellen'
                          : 'Studio erstellen (Studio-Abo erforderlich)'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {onRedeemCode !== undefined && (
                    <View style={styles.inviteSection}>
                      <Text style={styles.inviteSectionTitle}>Einladungscode eingeben</Text>
                      <View style={styles.inviteRow}>
                        <TextInput
                          style={styles.inviteInput}
                          placeholder="z.B. AB3X7Y"
                          placeholderTextColor={colors.inactive}
                          autoCapitalize="characters"
                          maxLength={6}
                          value={inviteCode}
                          onChangeText={(t) => { setInviteCode(t.toUpperCase()); setRedeemError(null); }}
                          returnKeyType="done"
                          onSubmitEditing={() => { void handleRedeemCode(); }}
                        />
                        <TouchableOpacity
                          style={[styles.redeemBtn, inviteCode.length !== 6 && styles.redeemBtnDisabled]}
                          onPress={() => { void handleRedeemCode(); }}
                          disabled={inviteCode.length !== 6 || redeemLoading}
                          activeOpacity={0.8}
                        >
                          {redeemLoading
                            ? <ActivityIndicator size="small" color={colors.headerTextPrimary} />
                            : <Text style={styles.redeemBtnLabel}>Beitreten</Text>}
                        </TouchableOpacity>
                      </View>
                      {redeemError !== null && <Text style={styles.redeemErrorText}>{redeemError}</Text>}
                    </View>
                  )}
                </>
              }
            />
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const RADIUS = 16;

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
});

const styles = StyleSheet.create({
  // ── Card ──────────────────────────────────────────────────────────────────
  inlineWrapper: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 5,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: RADIUS,
    padding: 16,
    marginBottom: 16,
    ...cardShadow,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  studioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  studioInfo: {
    flex: 1,
  },
  studioName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  studioCity: {
    fontSize: 13,
    color: colors.inactive,
    marginTop: 2,
  },
  changeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: colors.accentBlueSoft,
  },
  changeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  joinBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accentBlue,
  },

  // ── Modal ─────────────────────────────────────────────────────────────────
  modalSafe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  closeBtn: {
    padding: 4,
  },

  // ── Search ────────────────────────────────────────────────────────────────
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchIcon: {
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },

  // ── Results ───────────────────────────────────────────────────────────────
  loader: {
    marginTop: 32,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 8,
  },
  resultItem: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultItemActive: {
    backgroundColor: colors.accentBlueSoft,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  resultNameActive: {
    color: colors.accentBlue,
  },
  resultCity: {
    fontSize: 13,
    color: colors.inactive,
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.inactive,
    fontSize: 14,
    marginTop: 32,
  },

  // ── Create studio ──────────────────────────────────────────────────────────
  createHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  createHintLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  createForm: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    gap: 10,
  },
  createTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  createInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  createActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  createCancelBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  createCancelLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.inactive,
  },
  createConfirmBtn: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: colors.text,
    paddingVertical: 12,
    alignItems: 'center',
  },
  createConfirmBtnDisabled: { opacity: 0.4 },
  createConfirmLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },

  // ── Invite code redemption ────────────────────────────────────────────────
  inviteSection: {
    marginTop: 8,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 14,
    gap: 10,
  },
  inviteSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  inviteRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  inviteInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 3,
  },
  redeemBtn: {
    borderRadius: 10,
    backgroundColor: colors.text,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redeemBtnDisabled: { opacity: 0.35 },
  redeemBtnLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  redeemErrorText: {
    fontSize: 12,
    color: colors.deleteRed,
    marginTop: -4,
  },
});
