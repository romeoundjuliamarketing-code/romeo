import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { Profile } from '../../types/database.types';

interface Props {
  visible: boolean;
  members: Profile[];
  presentUserIds: Set<string>;
  loadingAttendance: boolean;
  onMark: (userId: string) => Promise<void>;
  onUnmark: (userId: string) => Promise<void>;
  onClose: () => void;
}

// Derives initials from a profile name
function initials(name: string | null): string {
  if (name === null || name.trim().length === 0) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

export default function AttendanceSheet({
  visible,
  members,
  presentUserIds,
  loadingAttendance,
  onMark,
  onUnmark,
  onClose,
}: Props) {
  const presentCount = presentUserIds.size;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Anwesenheit</Text>
              <Text style={styles.subtitle}>
                {presentCount} von {members.length} anwesend
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.doneBtn}>
              <Text style={styles.doneBtnLabel}>Fertig</Text>
            </TouchableOpacity>
          </View>

          {loadingAttendance ? (
            <ActivityIndicator color={colors.accentBlue} style={styles.loader} />
          ) : (
            <FlatList
              data={members}
              keyExtractor={(item) => item.id}
              style={styles.list}
              renderItem={({ item }) => {
                const isPresent = presentUserIds.has(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.row, isPresent && styles.rowPresent]}
                    onPress={() => { void (isPresent ? onUnmark(item.id) : onMark(item.id)); }}
                    activeOpacity={0.7}
                  >
                    {/* Avatar */}
                    <View style={[styles.avatar, isPresent && styles.avatarPresent]}>
                      <Text style={[styles.avatarText, isPresent && styles.avatarTextPresent]}>
                        {initials(item.name)}
                      </Text>
                    </View>

                    {/* Name */}
                    <View style={styles.nameBlock}>
                      <Text style={styles.name}>{item.name ?? 'Unbekannt'}</Text>
                      {item.is_coach && (
                        <Text style={styles.coachBadge}>Trainer</Text>
                      )}
                    </View>

                    {/* Check indicator */}
                    <MaterialCommunityIcons
                      name={isPresent ? 'check-circle' : 'circle-outline'}
                      size={24}
                      color={isPresent ? colors.accentBlue : colors.border}
                    />
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.empty}>Keine Mitglieder im Team.</Text>
              }
            />
          )}
        </View>
      </View>
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
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  doneBtn: {
    backgroundColor: colors.dark,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  doneBtnLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  loader: {
    marginVertical: 32,
  },
  list: {
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  rowPresent: {
    backgroundColor: colors.accentBlueSoft,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPresent: {
    backgroundColor: colors.accentBlueMuted,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  avatarTextPresent: {
    color: colors.accentBlue,
  },
  nameBlock: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  coachBadge: {
    fontSize: 11,
    color: colors.accentBlue,
    fontWeight: '600',
    marginTop: 1,
  },
  empty: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 24,
  },
});
