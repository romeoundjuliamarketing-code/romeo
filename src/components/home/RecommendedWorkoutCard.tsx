import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useRecommendedWorkout } from '../../hooks/useRecommendedWorkout';
import type { FitnessGroup } from '../../hooks/useRecommendedWorkout';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// Presentation metadata per fitness group — kept in the component layer
const GROUP_META: Record<FitnessGroup, { icon: IoniconName; accentColor: string }> = {
  schlagkraft:  { icon: 'flash-outline',      accentColor: colors.catSchlagkraft },
  trittkraft:   { icon: 'footsteps-outline',  accentColor: colors.catTrittkraft  },
  ausdauer:     { icon: 'pulse-outline',       accentColor: colors.catCardio      },
  schulter:     { icon: 'barbell-outline',     accentColor: colors.catSchulter    },
  nackenhals:   { icon: 'fitness-outline',      accentColor: colors.catSchulter    },
  griffkraft:   { icon: 'hand-left-outline',    accentColor: colors.catGriffkraft  },
  beinarbeit:   { icon: 'walk-outline',        accentColor: colors.catCore        },
  koordination: { icon: 'sync-outline',        accentColor: colors.accentBlue     },
  mobilitaet:   { icon: 'body-outline',        accentColor: colors.catMobility       },
  partnertraining: { icon: 'people-outline',      accentColor: colors.catPartnertraining   },
};

interface Props {
  refetchTrigger?: number;
}

export default function RecommendedWorkoutCard({ refetchTrigger = 0 }: Props) {
  const { recommendation, loading } = useRecommendedWorkout(refetchTrigger);

  if (loading || recommendation === null) return null;

  const { group, label, reason, tip } = recommendation;
  const meta = GROUP_META[group];

  return (
    <View style={styles.card}>
      {/* Left accent strip */}
      <View style={styles.accentStrip} />

      <View style={styles.content}>
        {/* Header row: icon + label + reason */}
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name={meta.icon} size={22} color={colors.accentBlue} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.reason}>{reason}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Empfohlen</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Tip text */}
        <Text style={styles.tip}>{tip}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  accentStrip: {
    width: 4,
    backgroundColor: colors.accentBlue,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentBlueSoft,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  reason: {
    fontSize: 12,
    color: colors.inactive,
    fontWeight: '400',
  },
  badge: {
    backgroundColor: colors.accentBlueSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accentBlue,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  tip: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '400',
    lineHeight: 19,
  },
});
