import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { fonts } from '../../../theme/typography';
import InvitationRopes from '../InvitationRopes';

const PENGUIN = require('../../../../assets/images/home-penguin.png') as number;

// Dark invitation card built only from the real inputs. Missing values show
// as missing, never as sample data. Props are primitives so typing in fields
// the card does not show (notes, access note) does not re-render it.
function InvitationPreview({ badge, discipline, title, scheduledAtMs, gymName, address, atStudio, slotsText, footnote, durationMin }: {
  /** Small label top left, e.g. "Vorschau" (not published yet). */
  badge:         string;
  discipline:    string | null;
  title:         string;
  scheduledAtMs: number;
  gymName:       string | null;
  address:       string;
  atStudio:      boolean;
  /** e.g. "10 Plätze frei" / "Ausgebucht". */
  slotsText:     string;
  /** Extra line after the duration, or null. */
  footnote:      string | null;
  durationMin:   number;
}): React.ReactElement {
  const when = new Date(scheduledAtMs);
  const day = when.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = when.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const placeName = atStudio ? 'Dein Studio' : gymName;
  const placeAddress = address.trim();

  const spoken = [
    badge,
    discipline ?? 'Disziplin fehlt',
    title,
    `${day}, ${time} Uhr`,
    placeName,
    placeAddress.length > 0 ? placeAddress : 'Ort fehlt',
    slotsText,
    `${durationMin} Minuten`,
  ].filter((p): p is string => p !== null && p.length > 0).join('. ');

  return (
    <View style={styles.card} accessible accessibilityLabel={spoken}>
      <InvitationRopes />
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badge}</Text>
      </View>

      <Text style={[styles.discipline, discipline === null && styles.missing]}>
        {discipline ?? 'Disziplin fehlt'}
      </Text>
      {title.length > 0 && <Text style={styles.title}>{title}</Text>}

      <View style={styles.rope} />

      <Text style={styles.day}>{day}</Text>
      <Text style={styles.time}>{time} Uhr</Text>

      <View style={styles.place}>
        <Ionicons name="location" size={18} color={colors.accentBlue} style={styles.placeIcon} />
        <View style={styles.placeText}>
          {placeName !== null && <Text style={styles.placeName}>{placeName}</Text>}
          <Text style={[styles.placeAddress, placeAddress.length === 0 && styles.missing]}>
            {placeAddress.length > 0 ? placeAddress : 'Ort fehlt'}
          </Text>
        </View>
      </View>

      {/* Bottom row reserves the corner for the penguin, so it never covers text. */}
      <View style={styles.footer}>
        <Text style={styles.slots}>{slotsText}</Text>
        <Text style={styles.duration}>{footnote !== null ? `${durationMin} Min., ${footnote}` : `${durationMin} Min.`}</Text>
      </View>
      <Image source={PENGUIN} style={styles.penguin} resizeMode="contain" accessibilityIgnoresInvertColors />
    </View>
  );
}

export default React.memo(InvitationPreview);

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    backgroundColor: colors.dark,
    overflow: 'hidden',
    padding: 24,
    paddingBottom: 0,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.headerBorder,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.headerTextSecondary,
  },
  discipline: {
    fontFamily: fonts.display,
    fontSize: 48,
    lineHeight: 50,
    textTransform: 'uppercase',
    color: colors.headerTextPrimary,
  },
  title: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    color: colors.headerTextSecondary,
  },
  missing: {
    color: colors.headerTextSecondary,
  },
  rope: {
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accentBlue,
    marginVertical: 24,
  },
  day: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  time: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 44,
    color: colors.headerTextPrimary,
  },
  place: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
  },
  placeIcon: {
    marginTop: 0,
  },
  placeText: {
    flex: 1,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  placeAddress: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.coverTextMuted,
  },
  footer: {
    marginTop: 24,
    paddingTop: 16,
    paddingBottom: 24,
    paddingRight: 104,
    minHeight: 96,
    borderTopWidth: 1,
    borderTopColor: colors.headerCard,
  },
  slots: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.headerTextPrimary,
  },
  duration: {
    marginTop: 8,
    fontSize: 13,
    color: colors.headerTextSecondary,
  },
  penguin: {
    position: 'absolute',
    right: 8,
    bottom: 0,
    width: 96,
    height: 80,
  },
});
