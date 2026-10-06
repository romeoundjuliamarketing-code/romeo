import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import InvitationRopes from './InvitationRopes';

export const STORY_CARD_WIDTH = 1080;
export const STORY_CARD_HEIGHT = 1920;

const PENGUIN = require('../../../assets/images/home-penguin.png') as number;

export interface SparringStoryCardProps {
  title: string;
  discipline: string;
  /** Coarse area only (studio or "PLZ Stadt"), never the exact address. */
  areaLabel: string;
  /** ISO timestamp */
  scheduledAt: string;
  durationMin: number;
  slotsLeftLabel: string;
}

// Story image (1080x1920) in the look of the create preview: dark card, ring
// ropes, discipline big, date and time prominent, penguin in the corner.
// Text stays clear of the top and bottom bands Instagram covers with its UI.
export default function SparringStoryCard({
  title, discipline, areaLabel, scheduledAt, durationMin, slotsLeftLabel,
}: SparringStoryCardProps): React.JSX.Element {
  const when = new Date(scheduledAt);
  const day = when.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = when.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.card}>
      <InvitationRopes />

      <View style={styles.badge}>
        <Text style={styles.badgeText}>Sparring</Text>
      </View>
      <Text style={styles.discipline} numberOfLines={2}>{discipline}</Text>
      {title.length > 0 && <Text style={styles.title} numberOfLines={2}>{title}</Text>}

      <View style={styles.rope} />

      <Text style={styles.day}>{day}</Text>
      <Text style={styles.time}>{time} Uhr</Text>

      <View style={styles.place}>
        <Ionicons name="location" size={56} color={colors.accentBlue} />
        <Text style={styles.placeText} numberOfLines={2}>{areaLabel}</Text>
      </View>

      <View style={styles.spacer} />

      {/* Right side reserved for the penguin, so it never covers text. */}
      <View style={styles.footer}>
        <Text style={styles.slots}>{slotsLeftLabel}</Text>
        <Text style={styles.duration}>{durationMin} Min.</Text>
        <Text style={styles.brand}>Sparr</Text>
        <Text style={styles.hint}>Link antippen und mitmachen</Text>
      </View>
      <Image source={PENGUIN} style={styles.penguin} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: STORY_CARD_WIDTH,
    height: STORY_CARD_HEIGHT,
    backgroundColor: colors.dark,
    overflow: 'hidden',
    paddingHorizontal: 96,
    paddingTop: 240,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 24,
    borderWidth: 3,
    borderColor: colors.headerBorder,
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  badgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 36,
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: colors.headerTextSecondary,
  },
  discipline: {
    fontFamily: fonts.display,
    fontSize: 160,
    lineHeight: 160,
    textTransform: 'uppercase',
    color: colors.headerTextPrimary,
    marginTop: 48,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 52,
    lineHeight: 64,
    color: colors.headerTextSecondary,
    marginTop: 24,
  },
  rope: {
    width: 144,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accentBlue,
    marginVertical: 72,
  },
  day: {
    fontFamily: 'Inter_700Bold',
    fontSize: 56,
    color: colors.headerTextPrimary,
  },
  time: {
    fontFamily: fonts.display,
    fontSize: 144,
    lineHeight: 152,
    color: colors.headerTextPrimary,
  },
  place: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginTop: 72,
  },
  placeText: {
    flex: 1,
    fontFamily: 'Inter_700Bold',
    fontSize: 52,
    lineHeight: 64,
    color: colors.headerTextPrimary,
  },
  spacer: {
    flex: 1,
  },
  footer: {
    borderTopWidth: 3,
    borderTopColor: colors.headerCard,
    paddingTop: 48,
    paddingBottom: 200,
    paddingRight: 360,
  },
  slots: {
    fontFamily: 'Inter_700Bold',
    fontSize: 60,
    color: colors.headerTextPrimary,
  },
  duration: {
    fontFamily: 'Inter_400Regular',
    fontSize: 40,
    color: colors.headerTextSecondary,
    marginTop: 8,
  },
  brand: {
    fontFamily: fonts.display,
    fontSize: 72,
    lineHeight: 80,
    textTransform: 'uppercase',
    color: colors.accentBlue,
    marginTop: 48,
  },
  hint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 40,
    color: colors.headerTextSecondary,
  },
  penguin: {
    position: 'absolute',
    right: 48,
    bottom: 0,
    width: 320,
    height: 264,
  },
});
