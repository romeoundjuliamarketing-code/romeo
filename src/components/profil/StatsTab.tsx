import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import PaywallCard from '../common/PaywallCard';

interface StatsTabProps {
  totalPoints: number;
  streak: number;
  totalWorkouts: number;
  rank: number | null;
  hasAccess: boolean;
  currentWeight: number | null;
  isNewWeek: boolean;
  onPressPoints: () => void;
  onPressStreak: () => void;
  onPressWorkouts: () => void;
  onPressWeightLog: () => void;
  onPressWeightHistory: () => void;
  onPressPaywall: () => void;
}

export default function StatsTab({
  totalPoints,
  streak,
  totalWorkouts,
  rank,
  hasAccess,
  currentWeight,
  isNewWeek,
  onPressPoints,
  onPressStreak,
  onPressWorkouts,
  onPressWeightLog,
  onPressWeightHistory,
  onPressPaywall,
}: StatsTabProps): React.ReactElement {
  if (!hasAccess) {
    return (
      <View style={styles.container}>
        <View style={styles.paywallContainer}>
          <PaywallCard
            title="Stats & Punkte im Abo"
            message="Punkte, Rang und detaillierte Auswertungen sind nur mit einem aktiven Abo verfügbar."
            onPressCta={onPressPaywall}
          />
        </View>
      </View>
    );
  }

  const streakCaption =
    streak > 0
      ? 'Ununterbrochene Trainingstage bis heute oder gestern.'
      : 'Trainiere heute, um eine Serie zu starten.';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Training & Punkte</Text>

      <View style={styles.surface}>
        {/* Training */}
        <View style={styles.twoCol}>
          <TouchableOpacity
            style={styles.colItem}
            onPress={onPressStreak}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Trainingsserie anzeigen"
          >
            <View style={styles.colHeaderRow}>
              <MaterialCommunityIcons name="fire" size={18} color={colors.accentBlue} />
              <Text style={styles.colLabel}>Trainingsserie</Text>
            </View>
            <Text
              style={styles.colValue}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {streak} Tage
            </Text>
            <Text style={styles.colCaption}>{streakCaption}</Text>
          </TouchableOpacity>

          <View style={styles.colDivider} />

          <TouchableOpacity
            style={styles.colItem}
            onPress={onPressWorkouts}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Trainings gesamt anzeigen"
          >
            <View style={styles.colHeaderRow}>
              <MaterialCommunityIcons name="dumbbell" size={18} color={colors.accentBlue} />
              <Text style={styles.colLabel}>Trainings gesamt</Text>
            </View>
            <Text
              style={styles.colValue}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {totalWorkouts}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hDivider} />

        {/* App-Punkte */}
        <View style={styles.twoCol}>
          <TouchableOpacity
            style={styles.colItem}
            onPress={onPressPoints}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Punkte anzeigen"
          >
            <View style={styles.colHeaderRow}>
              <MaterialCommunityIcons name="star" size={18} color={colors.accentBlue} />
              <Text style={styles.colLabel}>Punkte</Text>
            </View>
            <Text
              style={styles.colValue}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {totalPoints} XP
            </Text>
          </TouchableOpacity>

          {rank !== null && (
            <>
              <View style={styles.colDivider} />
              <View style={styles.colItem}>
                <View style={styles.colHeaderRow}>
                  <MaterialCommunityIcons name="trophy" size={18} color={colors.accentBlue} />
                  <Text style={styles.colLabel}>Rang im Studio</Text>
                </View>
                <Text
                  style={styles.colValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  #{rank}
                </Text>
              </View>
            </>
          )}
        </View>

        <Text style={styles.pointsExplanation}>
          Punkte sammelst du für Trainings, die du in der App abschliesst – sie sind keine Wertung
          deines Könnens.
        </Text>
        <TouchableOpacity
          onPress={onPressPoints}
          activeOpacity={0.7}
          accessibilityRole="link"
          accessibilityLabel="So entstehen Punkte"
          style={styles.linkRow}
        >
          <Text style={styles.link}>So entstehen Punkte</Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color={colors.accentBlue} />
        </TouchableOpacity>

        <View style={styles.hDivider} />

        {/* Weekly weight tracking */}
        <TouchableOpacity
          style={[styles.trackingRow, isNewWeek && styles.trackingRowHighlight]}
          onPress={onPressWeightLog}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Gewicht eintragen"
        >
          <MaterialCommunityIcons
            name="scale-bathroom"
            size={20}
            color={isNewWeek ? colors.accentBlue : colors.textMuted}
          />
          <View style={styles.trackingInfo}>
            <Text style={[styles.trackingLabel, isNewWeek && styles.trackingLabelHighlight]}>
              Gewicht
            </Text>
            {isNewWeek && <Text style={styles.trackingHint}>Neuer Eintrag fällig</Text>}
          </View>
          <Text
            style={[styles.trackingValue, currentWeight === null && styles.trackingValueEmpty]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {currentWeight !== null ? `${currentWeight} kg` : 'Eintragen'}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.trackingRow, styles.trackingRowBordered]}
          onPress={onPressWeightHistory}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Gewichtsverlauf anzeigen"
        >
          <MaterialCommunityIcons name="chart-line" size={20} color={colors.textMuted} />
          <View style={styles.trackingInfo}>
            <Text style={styles.trackingLabel}>Gewichtsverlauf</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingBottom: 32,
  },
  paywallContainer: {
    paddingTop: 8,
  },

  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },

  surface: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 16,
  },
  hDivider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginVertical: 16,
  },

  // Two-column stat layout (shared by Training + App-Punkte)
  twoCol: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  colItem: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    gap: 4,
  },
  colDivider: {
    width: 1,
    backgroundColor: colors.hairline,
    marginHorizontal: 16,
  },
  colHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  colLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  colValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  colCaption: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
    lineHeight: 16,
  },

  pointsExplanation: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: 16,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    minHeight: 44,
  },
  link: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },

  // Weekly tracking rows
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    paddingVertical: 8,
  },
  trackingRowBordered: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  trackingRowHighlight: {
    backgroundColor: colors.accentBlueSoft,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  trackingInfo: {
    flex: 1,
    gap: 2,
  },
  trackingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  trackingLabelHighlight: {
    color: colors.text,
    fontWeight: '700',
  },
  trackingHint: {
    fontSize: 11,
    color: colors.text,
    fontWeight: '700',
  },
  trackingValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    maxWidth: 100,
  },
  trackingValueEmpty: {
    color: colors.text,
    fontWeight: '700',
  },
});
