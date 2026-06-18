import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useStudioInvite } from '../../hooks/useStudioInvite';
import { useEntitlement } from '../../hooks/useEntitlement';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'StudioInvite'>;

export default function StudioInviteScreen({ route, navigation }: Props): React.ReactElement {
  const { studioId } = route.params;

  const { code, loading: inviteLoading, error: inviteError, createInvite } = useStudioInvite();
  const { entitlement } = useEntitlement();

  const totalSeats = entitlement.includedSeats + entitlement.extraSeats;
  const freeSeats = totalSeats - entitlement.usedSeats;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => { navigation.goBack(); }} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Einladungscode</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {!entitlement.canManageStudio ? (
          // No studio plan — show hint instead of code
          <View style={styles.card}>
            <Text style={styles.cardSectionLabel}>Einladungscode</Text>
            <Text style={styles.noAccessText}>
              Der Einladungscode erfordert einen aktiven Studio-Plan.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardSectionLabel}>Einladungscode</Text>

            {code !== null ? (
              <>
                {/* Code + copy button */}
                <View style={styles.inviteCodeRow}>
                  <Text style={styles.inviteCodeText}>{code}</Text>
                  <TouchableOpacity
                    style={styles.inviteCopyBtn}
                    onPress={() => {
                      void Share.share({
                        message: `Tritt unserem Team bei! Gib diesen Code in der Sparr-App ein: ${code}`,
                      });
                    }}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="content-copy" size={16} color={colors.accentBlue} />
                    <Text style={styles.inviteCopyLabel}>Kopieren</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.inviteValidText}>Gültig für 7 Tage</Text>

                {/* Seat capacity bar */}
                {totalSeats > 0 && (
                  <>
                    <Text style={styles.inviteCapacityText}>
                      {entitlement.usedSeats} von {totalSeats} Plätzen belegt · {freeSeats} frei
                    </Text>
                    <View style={styles.capacityTrack}>
                      <View style={[styles.capacityFill, { flex: entitlement.usedSeats }]} />
                      <View style={[styles.capacityEmpty, { flex: Math.max(0, totalSeats - entitlement.usedSeats) }]} />
                    </View>
                  </>
                )}

                {/* Refresh button */}
                <TouchableOpacity
                  style={styles.inviteRefreshBtn}
                  onPress={() => { void createInvite(studioId); }}
                  disabled={inviteLoading}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="refresh" size={16} color={colors.textSecondary} />
                  <Text style={styles.inviteRefreshLabel}>Neu erstellen</Text>
                </TouchableOpacity>
              </>
            ) : (
              // No code yet — generate button
              <TouchableOpacity
                style={styles.inviteGenerateBtn}
                onPress={() => { void createInvite(studioId); }}
                disabled={inviteLoading}
                activeOpacity={0.8}
              >
                {inviteLoading ? (
                  <ActivityIndicator size="small" color={colors.accentBlue} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="key-outline" size={18} color={colors.accentBlue} />
                    <Text style={styles.inviteGenerateLabel}>Einladungscode erstellen</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {inviteError !== null && <Text style={styles.inviteErrorText}>{inviteError}</Text>}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  cardSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  noAccessText: {
    fontSize: 14,
    color: colors.textSecondary,
    paddingVertical: 8,
  },
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inviteCodeText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.accentBlue,
    letterSpacing: 3,
    fontVariant: ['tabular-nums'],
  },
  inviteCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inviteCopyLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  inviteValidText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  inviteCapacityText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  capacityTrack: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  capacityFill: {
    backgroundColor: colors.accentBlue,
  },
  capacityEmpty: {
    backgroundColor: 'transparent',
  },
  inviteRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  inviteRefreshLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  inviteGenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inviteGenerateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  inviteErrorText: {
    fontSize: 12,
    color: colors.deleteRed,
  },
});
