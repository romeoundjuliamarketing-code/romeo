import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { useStudioMembers } from '../../hooks/useStudioMembers';
import type { StudioMember } from '../../hooks/useStudioMembers';
import { useStudioTrainer } from '../../hooks/useStudioTrainer';
import { useStudio } from '../../hooks/useStudio';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'StudioMembers'>;

// Same palette as TeamScreen for visual consistency
const MEMBER_COLORS = [
  colors.accentBlue,
  colors.paletteRed,
  colors.paletteGreen,
  colors.paletteOrange,
  colors.paletteViolet,
  colors.paletteTeal,
  colors.paletteYellow,
  colors.palettePink,
];

function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

type SheetAction = {
  label: string;
  destructive?: boolean;
  onPress: () => Promise<{ error: string | null }>;
};

export default function StudioMembersScreen({ route, navigation }: Props) {
  const { studioId, studioName } = route.params;
  const { user } = useAuth();
  const { members, loading, refetch } = useStudioMembers(studioId);
  const { appoint, remove } = useStudioTrainer();
  const { removeMember } = useStudio();

  const [actionTarget, setActionTarget] = useState<StudioMember | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Sort members by total_points descending (ranking)
  const ranked = [...members].sort((a, b) => b.total_points - a.total_points);

  function buildSheetActions(member: StudioMember): SheetAction[] {
    const actions: SheetAction[] = [];

    if (!member.is_coach) {
      actions.push({
        label: 'Zum Trainer ernennen',
        onPress: () => appoint(member.id),
      });
    } else {
      actions.push({
        label: 'Trainer-Rolle entfernen',
        destructive: true,
        onPress: () => remove(member.id),
      });
    }

    actions.push({
      label: 'Aus Studio entfernen',
      destructive: true,
      onPress: () =>
        new Promise<{ error: string | null }>((resolve) => {
          Alert.alert(
            'Mitglied entfernen',
            `${member.name ?? 'Dieses Mitglied'} wirklich aus dem Studio entfernen?`,
            [
              { text: 'Abbrechen', style: 'cancel', onPress: () => resolve({ error: 'cancelled' }) },
              {
                text: 'Entfernen',
                style: 'destructive',
                onPress: async () => {
                  const result = await removeMember(member.id);
                  resolve(result);
                },
              },
            ],
          );
        }),
    });

    return actions;
  }

  async function runSheetAction(action: SheetAction) {
    setActionLoading(true);
    const { error } = await action.onPress();
    setActionLoading(false);
    if (error !== null && error !== 'cancelled') {
      Alert.alert('Fehler', error);
      return;
    }
    if (error === null) {
      refetch();
      setActionTarget(null);
    }
  }

  const sheetActions = actionTarget ? buildSheetActions(actionTarget) : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={colors.card} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>Mitglieder</Text>
          {studioName.length > 0 && (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {studioName}
            </Text>
          )}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.accentBlue} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.cardLabel}>
              {ranked.length} {ranked.length === 1 ? 'Mitglied' : 'Mitglieder'}
            </Text>

            {ranked.length === 0 && (
              <Text style={styles.emptyText}>Noch keine Mitglieder.</Text>
            )}

            {ranked.map((member, idx) => {
              const avatarColor = MEMBER_COLORS[idx % MEMBER_COLORS.length];
              const isCurrentUser = member.id === user?.id;
              const tappable = !isCurrentUser;

              return (
                <TouchableOpacity
                  key={member.id}
                  style={[styles.memberRow, idx > 0 && styles.memberRowBorder]}
                  onPress={tappable ? () => setActionTarget(member) : undefined}
                  activeOpacity={tappable ? 0.7 : 1}
                >
                  <View style={[styles.memberAvatar, { backgroundColor: avatarColor }]}>
                    <Text style={styles.memberAvatarText}>{getInitials(member.name)}</Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {member.name ?? 'Unbekannt'}
                      {isCurrentUser ? '  (Du)' : ''}
                    </Text>
                    <Text style={styles.memberRole}>
                      {member.is_coach ? 'Trainer' : 'Mitglied'}
                    </Text>
                  </View>
                  <Text style={styles.memberXP}>{member.total_points} XP</Text>
                  {tappable && (
                    <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Action Sheet */}
      <Modal
        visible={actionTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setActionTarget(null)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setActionTarget(null)}
          />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{actionTarget?.name ?? 'Mitglied'}</Text>
            {sheetActions.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={[styles.sheetBtn, action.destructive === true && styles.sheetBtnDestructive]}
                onPress={() => { void runSheetAction(action); }}
                disabled={actionLoading}
                activeOpacity={0.8}
              >
                {actionLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={action.destructive === true ? colors.deleteRed : colors.textPrimary}
                  />
                ) : (
                  <Text
                    style={[
                      styles.sheetBtnLabel,
                      action.destructive === true && styles.sheetBtnLabelDestructive,
                    ]}
                  >
                    {action.label}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.sheetCancel}
              onPress={() => setActionTarget(null)}
              activeOpacity={0.7}
            >
              <Text style={styles.sheetCancelLabel}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Header ──
  header: {
    backgroundColor: colors.dark,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  headerTitles: {
    flex: 1,
    gap: 4,
    paddingTop: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '500',
    color: colors.card,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
  },

  // ── Content ──
  loader: {
    marginTop: 48,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 48,
  },

  // ── Card ──
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 8,
  },

  // ── Member rows ──
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  memberRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.card,
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  memberRole: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  memberXP: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  // ── Action Sheet ──
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.mapOverlay,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 8,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 4,
  },
  sheetBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBtnDestructive: {
    backgroundColor: colors.deleteRedSoft,
  },
  sheetBtnLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  sheetBtnLabelDestructive: {
    color: colors.deleteRed,
  },
  sheetCancel: {
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.darkMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  sheetCancelLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
});
