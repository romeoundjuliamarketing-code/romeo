import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';

interface StudioMember {
  id: string;
  name: string | null;
  avatar_url: string | null;
}

interface Props {
  visible: boolean;
  studioId: string;
  excludeIds: string[];
  title: string;
  onClose: () => void;
  onConfirm: (userIds: string[]) => Promise<void>;
}

function getInitials(name: string | null): string {
  if (name === null || name.trim().length === 0) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function MemberMultiPickerSheet({
  visible,
  studioId,
  excludeIds,
  title,
  onClose,
  onConfirm,
}: Props): React.ReactElement {
  const [members, setMembers] = useState<StudioMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);

  const loadMembers = useCallback(async (): Promise<void> => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .eq('studio_id', studioId);
    if (error !== null) {
      Alert.alert('Fehler', 'Mitglieder konnten nicht geladen werden.');
    }
    setMembers((data ?? []) as StudioMember[]);
    setLoading(false);
  }, [studioId]);

  // Reset state and (re)load whenever the sheet opens
  useEffect(() => {
    if (!visible) return;
    setSearch('');
    setSelected(new Set());
    void loadMembers();
  }, [visible, loadMembers]);

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConfirm(): Promise<void> {
    if (selected.size === 0) return;
    setConfirming(true);
    await onConfirm(Array.from(selected));
    setConfirming(false);
    onClose();
  }

  const excludeSet = new Set(excludeIds);
  const query = search.trim().toLowerCase();
  const available = members.filter((m) => !excludeSet.has(m.id));
  const visibleMembers = query.length === 0
    ? available
    : available.filter((m) => (m.name ?? '').toLowerCase().includes(query));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Suchen..."
              placeholderTextColor={colors.textSecondary}
              returnKeyType="search"
            />
          </View>

          {loading ? (
            <ActivityIndicator color={colors.accentBlue} style={styles.loader} />
          ) : available.length === 0 ? (
            <Text style={styles.emptyText}>Keine weiteren Mitglieder verfügbar.</Text>
          ) : visibleMembers.length === 0 ? (
            <Text style={styles.emptyText}>Keine Treffer.</Text>
          ) : (
            <FlatList
              data={visibleMembers}
              keyExtractor={(item) => item.id}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected = selected.has(item.id);
                return (
                  <TouchableOpacity
                    style={styles.memberRow}
                    activeOpacity={0.8}
                    onPress={() => toggle(item.id)}
                  >
                    {item.avatar_url !== null ? (
                      <Image source={{ uri: item.avatar_url }} style={styles.memberAvatar} />
                    ) : (
                      <View style={[styles.memberAvatar, styles.memberAvatarPlaceholder]}>
                        <Text style={styles.memberInitials}>{getInitials(item.name)}</Text>
                      </View>
                    )}
                    <Text style={styles.memberName}>{item.name ?? 'Unbekannt'}</Text>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={isSelected ? colors.accentBlue : colors.textSecondary}
                    />
                  </TouchableOpacity>
                );
              }}
            />
          )}

          <TouchableOpacity
            style={[styles.confirmBtn, (selected.size === 0 || confirming) && styles.confirmBtnDisabled]}
            onPress={() => { void handleConfirm(); }}
            disabled={selected.size === 0 || confirming}
            activeOpacity={0.85}
          >
            {confirming ? (
              <ActivityIndicator size="small" color={colors.card} />
            ) : (
              <Text style={styles.confirmText}>Hinzufügen ({selected.size})</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}


const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.mapOverlay,
  },
  sheet: {
    height: '80%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 32,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 10,
  },
  loader: {
    marginVertical: 24,
  },
  emptyText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 24,
  },
  list: {
    flex: 1,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  memberAvatarPlaceholder: {
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.accentBlue,
  },
  memberName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  confirmBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.card,
  },
});
