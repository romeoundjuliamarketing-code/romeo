import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

// Compact map markers shared by the iOS and Android map views. Only one marker
// type is visible at a time (mode toggle). Sparrings carry a short label chip
// ("K1 · Sa") anchored to the location; the selected one turns blue (plus the
// scale-up from ActiveMarkerScale). Studios, events and venues stay small dark
// discs with a white rim.

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function MarkerDisc({ icon }: { icon: IconName }) {
  return (
    <View style={styles.disc}>
      <Ionicons name={icon} size={14} color={colors.card} />
    </View>
  );
}

interface SparringPinProps {
  /** Short text such as "K1 · Sa" (sparringMarkerLabel). */
  label:    string;
  atStudio: boolean;
  active:   boolean;
}

// Label chip on a short stem above an anchor dot. An invisible spacer below
// mirrors chip + stem, so the dot sits exactly in the view's center: both map
// libraries anchor custom markers at their center, and the scale-up of
// ActiveMarkerScale grows around the location instead of drifting. The width
// stays the same when selected (only colors change), see ActiveMarkerScale.
export function SparringPin({ label, atStudio, active }: SparringPinProps) {
  return (
    <View style={styles.pin}>
      <View style={[styles.chip, active && styles.chipActive]}>
        {atStudio
          ? <Ionicons name="business" size={12} color={colors.card} />
          : <View style={[styles.chipAccent, active && styles.chipAccentActive]} />}
        <Text style={styles.chipText} numberOfLines={1}>{label}</Text>
      </View>
      <View style={[styles.stem, active && styles.stemActive]} />
      <View style={[styles.anchor, active && styles.anchorActive]} />
      <View style={styles.pinSpacer} />
    </View>
  );
}

// Boosted sparring ("Sparr Pick"): logo disc with a small label, kept
// distinguishable because the boost is a paid visibility feature.
export function FeaturedPin({ atStudio, active }: { atStudio: boolean; active: boolean }) {
  const ring = atStudio ? colors.studioGold : colors.accentBlue;
  return (
    <View style={styles.featuredWrap}>
      <View style={[styles.featuredDisc, { borderColor: ring }, active && styles.featuredDiscActive]}>
        <Image
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          source={require('../../../assets/logo-home.png')}
          style={styles.featuredLogo}
          resizeMode="contain"
        />
      </View>
      <View style={[styles.featuredLabel, { backgroundColor: ring }]}>
        <Text style={styles.featuredLabelText}>Sparr Pick</Text>
      </View>
    </View>
  );
}

export function StudioPin() {
  return <MarkerDisc icon="business" />;
}

export function EventPin() {
  return <MarkerDisc icon="calendar" />;
}

export function VenuePin() {
  return <MarkerDisc icon="location" />;
}

const DISC = 28;
const CHIP_HEIGHT = 24;
const STEM_HEIGHT = 6;
const ANCHOR = 10;

const styles = StyleSheet.create({
  pin: {
    alignItems: 'center',
  },
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    height:            CHIP_HEIGHT,
    maxWidth:          128,
    paddingHorizontal: 8,
    borderRadius:      8,
    borderWidth:       2,
    borderColor:       colors.card,
    backgroundColor:   colors.dark,
    shadowColor:       colors.dark,
    shadowOffset:      { width: 0, height: 1 },
    shadowOpacity:     0.25,
    shadowRadius:      2,
    elevation:         3,
  },
  chipActive: {
    backgroundColor: colors.accentBlue,
  },
  chipAccent: {
    width:           4,
    height:          12,
    borderRadius:    2,
    backgroundColor: colors.accentBlue,
  },
  chipAccentActive: {
    backgroundColor: colors.card,
  },
  chipText: {
    fontSize:   12,
    fontWeight: '700',
    color:      colors.card,
  },
  stem: {
    width:           2,
    height:          STEM_HEIGHT,
    backgroundColor: colors.dark,
  },
  stemActive: {
    backgroundColor: colors.accentBlue,
  },
  anchor: {
    width:           ANCHOR,
    height:          ANCHOR,
    borderRadius:    ANCHOR / 2,
    borderWidth:     2,
    borderColor:     colors.card,
    backgroundColor: colors.accentBlue,
  },
  anchorActive: {
    backgroundColor: colors.dark,
  },
  pinSpacer: {
    height: CHIP_HEIGHT + STEM_HEIGHT,
  },
  disc: {
    width:           DISC,
    height:          DISC,
    borderRadius:    DISC / 2,
    borderWidth:     2,
    borderColor:     colors.card,
    backgroundColor: colors.dark,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     colors.dark,
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.25,
    shadowRadius:    2,
    elevation:       3,
  },
  featuredWrap: {
    alignItems: 'center',
    gap:        4,
  },
  featuredDisc: {
    width:           36,
    height:          36,
    borderRadius:    18,
    borderWidth:     2,
    backgroundColor: colors.card,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     colors.dark,
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.25,
    shadowRadius:    2,
    elevation:       3,
  },
  featuredDiscActive: {
    borderWidth: 3,
  },
  featuredLogo: {
    width:  24,
    height: 24,
  },
  featuredLabel: {
    borderRadius:      8,
    paddingHorizontal: 8,
    paddingVertical:   2,
  },
  featuredLabelText: {
    fontSize:      10,
    fontWeight:    '700',
    color:         colors.card,
    letterSpacing: 0.3,
  },
});
