import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export const STORY_CARD_WIDTH = 1080;
export const STORY_CARD_HEIGHT = 1920;

export interface SparringStoryCardProps {
  title: string;
  discipline: string;
  areaLabel: string;
  dateTimeLabel: string;
  slotsLeftLabel: string;
}

export default function SparringStoryCard({
  title, discipline, areaLabel, dateTimeLabel, slotsLeftLabel,
}: SparringStoryCardProps): React.JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>SPARRING</Text>
      <Text style={styles.discipline}>{discipline}</Text>
      <Text style={styles.title} numberOfLines={3}>{title}</Text>

      <View style={styles.metaBlock}>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={48} color={colors.card} />
          <Text style={styles.metaText}>{areaLabel}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={48} color={colors.card} />
          <Text style={styles.metaText}>{dateTimeLabel}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="people-outline" size={48} color={colors.card} />
          <Text style={styles.metaText}>{slotsLeftLabel}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerBrand}>Sparr</Text>
        <Text style={styles.footerHint}>Link antippen und mitmachen</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: STORY_CARD_WIDTH,
    height: STORY_CARD_HEIGHT,
    backgroundColor: colors.dark,
    paddingHorizontal: 96,
    paddingVertical: 160,
    justifyContent: 'space-between',
  },
  kicker: {
    fontFamily: 'Inter_700Bold',
    fontSize: 40,
    letterSpacing: 8,
    color: colors.accentBlue,
  },
  discipline: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 56,
    color: colors.card,
    marginTop: 24,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 96,
    lineHeight: 104,
    color: colors.card,
    marginTop: 32,
  },
  metaBlock: {
    gap: 40,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
  },
  metaText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 48,
    color: colors.card,
    flex: 1,
  },
  footer: {
    gap: 16,
  },
  footerBrand: {
    fontFamily: 'Inter_700Bold',
    fontSize: 72,
    color: colors.accentBlue,
  },
  footerHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 40,
    color: colors.textSecondary,
  },
});
