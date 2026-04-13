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
}

export default function TeamPickerCard({ currentStudio, onJoin, onSearch }: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Studio[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

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

  async function handleJoin(studio: Studio): Promise<void> {
    setSaving(true);
    await onJoin(studio.id);
    setSaving(false);
    setModalVisible(false);
  }

  return (
    <>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="people-outline" size={20} color={colors.accentBlue} />
          <Text style={styles.cardTitle}>Dein Team</Text>
        </View>

        {currentStudio !== null ? (
          <View style={styles.studioRow}>
            <View style={styles.studioInfo}>
              <Text style={styles.studioName}>{currentStudio.name}</Text>
              <Text style={styles.studioCity}>{currentStudio.city}</Text>
            </View>
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
      </View>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Studio suchen</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
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
              renderItem={({ item }) => {
                const isActive = currentStudio?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.resultItem, isActive && styles.resultItemActive]}
                    onPress={() => handleJoin(item)}
                    disabled={saving}
                  >
                    <View style={styles.resultInfo}>
                      <Text style={[styles.resultName, isActive && styles.resultNameActive]}>
                        {item.name}
                      </Text>
                      <Text style={styles.resultCity}>{item.city}</Text>
                    </View>
                    {isActive && (
                      <Ionicons name="checkmark-circle" size={22} color={colors.accentBlue} />
                    )}
                    {saving && !isActive && (
                      <ActivityIndicator size="small" color={colors.accentBlue} />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Kein Studio gefunden.</Text>
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
});
