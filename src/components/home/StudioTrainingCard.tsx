import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { StudioSchedule } from '../../types/database.types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  dark?: boolean;
  session: StudioSchedule | null;
  participating: boolean;
  onParticipate: () => void;
  onCancel: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudioTrainingCard({
  dark = false,
  session,
  participating,
  onParticipate,
  onCancel,
}: Props): React.ReactElement {
  return (
    <View style={[styles.card, dark && styles.cardDark]}>
      <Text style={[styles.cardTitle, dark && styles.cardTitleDark]}>
        Heutiges Studio-Training
      </Text>

      {session === null ? (
        <Text style={[styles.emptyText, dark && styles.emptyTextDark]}>
          Heute kein Studio-Training
        </Text>
      ) : (
        <View style={styles.sessionRow}>
          <View style={styles.sessionInfo}>
            <Text style={[styles.sessionName, dark && styles.sessionNameDark]}>
              {session.training_name}
            </Text>
            <View style={styles.metaRow}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={13}
                color={dark ? colors.headerTextSecondary : colors.inactive}
              />
              <Text style={[styles.metaText, dark && styles.metaTextDark]}>
                {session.start_time.slice(0, 5)} Uhr
              </Text>
              <View style={[styles.metaDivider, dark && styles.metaDividerDark]} />
              <Text style={[styles.metaText, dark && styles.metaTextDark]}>
                {session.duration_min} Min
              </Text>
              {session.coach_name !== null && (
                <>
                  <View style={[styles.metaDivider, dark && styles.metaDividerDark]} />
                  <Text style={[styles.metaText, dark && styles.metaTextDark]}>
                    {session.coach_name}
                  </Text>
                </>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              dark && styles.buttonDark,
              participating && styles.buttonCommitted,
            ]}
            onPress={participating ? onCancel : onParticipate}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.buttonLabel,
              dark && styles.buttonLabelDark,
              participating && styles.buttonLabelCommitted,
            ]}>
              {participating ? 'Zugesagt' : 'Teilnehmen'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Light variant (default) ──────────────────────────────────────────────────
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inactive,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: colors.inactive,
    fontWeight: '400',
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sessionInfo: {
    flex: 1,
    gap: 6,
  },
  sessionName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: colors.inactive,
    fontWeight: '400',
  },
  metaDivider: {
    width: 1,
    height: 10,
    backgroundColor: colors.tabBarBorder,
  },
  button: {
    borderWidth: 1.5,
    borderColor: colors.headerBg,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  buttonCommitted: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  buttonLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.headerBg,
  },
  buttonLabelCommitted: {
    color: '#FFFFFF',
  },

  // ── Dark variant overrides ───────────────────────────────────────────────────
  cardDark: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderLeftWidth: 3,
    borderLeftColor: colors.accentBlue,
    marginBottom: 16,
  },
  cardTitleDark: {
    color: colors.headerTextSecondary,
  },
  emptyTextDark: {
    color: colors.headerTextSecondary,
  },
  sessionNameDark: {
    color: colors.headerTextPrimary,
  },
  metaTextDark: {
    color: colors.headerTextSecondary,
  },
  metaDividerDark: {
    backgroundColor: colors.headerBorder,
  },
  buttonDark: {
    borderColor: colors.accentBlue,
    borderWidth: 1.5,
  },
  buttonLabelDark: {
    color: colors.accentBlue,
  },
});
