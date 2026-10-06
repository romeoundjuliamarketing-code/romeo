import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { getInitials } from '../../utils/initials';
import RingRopesBackdrop from '../common/RingRopesBackdrop';
import type { Gym } from '../../hooks/useGyms';

// Flat cover with the gym's own photo; without one only a short ring-rope
// band in Sparr colours (the logo is never blown up as a cover).
export const COVER_HEIGHT = 160;
export const COVER_HEIGHT_PLAIN = 104;
const TILE = 64;
export const GYM_PAGE_GUTTER = 20;
// Identity row top padding; the text column starts here (the logo rises into the cover).
const IDENTITY_TOP = 12;

export function coverHeight(gym: Gym): number {
  return gym.banner_url !== null && gym.banner_url.length > 0 ? COVER_HEIGHT : COVER_HEIGHT_PLAIN;
}

// Gym identity: a flat cover, then one connected block — logo tile rising
// into the cover, the name in the condensed sport face with the city right
// under it, disciplines as one quiet dotted line, and a small status label
// when this is the viewer's main gym. Back and menu live in GymTopBar.
export default function GymHero({ gym, isHome, onNameBottom }: {
  gym:          Gym;
  isHome:       boolean;
  /** Bottom edge of the gym name within the hero (for the top bar's title). */
  onNameBottom: (y: number) => void;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  const [coverFailed, setCoverFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const hasCover = gym.banner_url !== null && gym.banner_url.length > 0 && !coverFailed;
  const hasLogo = gym.avatar_url !== null && gym.avatar_url.length > 0 && !logoFailed;
  const cover = coverHeight(gym) + insets.top;

  const onNameLayout = (e: LayoutChangeEvent): void => {
    const { y, height } = e.nativeEvent.layout;
    onNameBottom(cover + IDENTITY_TOP + y + height);
  };

  return (
    <View>
      <View style={[styles.cover, { height: cover }]}>
        {hasCover ? (
          <Image
            source={{ uri: gym.banner_url as string }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => setCoverFailed(true)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <RingRopesBackdrop />
        )}
        {/* Top scrim: light status bar and bar buttons stay readable on bright photos */}
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="gymHeroScrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.dark} stopOpacity={0.55} />
              <Stop offset="0.6" stopColor={colors.dark} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#gymHeroScrim)" />
        </Svg>
      </View>

      <View style={styles.identity}>
        <View style={styles.tile}>
          {hasLogo ? (
            <Image
              source={{ uri: gym.avatar_url as string }}
              style={styles.logo}
              resizeMode="cover"
              onError={() => setLogoFailed(true)}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={styles.initialsWrap}>
              <Text style={styles.initials} maxFontSizeMultiplier={1}>{getInitials(gym.name)}</Text>
            </View>
          )}
        </View>

        <View style={styles.text}>
          <View onLayout={onNameLayout}>
            <Text style={styles.name} accessibilityRole="header" maxFontSizeMultiplier={1.3}>{gym.name}</Text>
            {gym.city.length > 0 && <Text style={styles.city} maxFontSizeMultiplier={1.4}>{gym.city}</Text>}
          </View>
          {gym.disciplines.length > 0 && (
            <Text style={styles.disciplines} maxFontSizeMultiplier={1.4}>{gym.disciplines.join(' · ')}</Text>
          )}
          {isHome && (
            <View style={styles.homeLabel}>
              <Ionicons name="checkmark-circle" size={16} color={colors.accentBlueText} />
              <Text style={styles.homeText} maxFontSizeMultiplier={1.4}>Dein Hauptgym</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    width:           '100%',
    overflow:        'hidden',
    backgroundColor: colors.dark,
  },
  identity: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    gap:               16,
    paddingHorizontal: GYM_PAGE_GUTTER,
    paddingTop:        IDENTITY_TOP,
  },
  // Rises half into the cover; the page-coloured ring separates it from the photo.
  tile: {
    width:           TILE,
    height:          TILE,
    marginTop:       -(TILE / 2 + IDENTITY_TOP),
    borderRadius:    16,
    borderWidth:     3,
    borderColor:     colors.background,
    overflow:        'hidden',
    backgroundColor: colors.dark,
  },
  logo: {
    width:           '100%',
    height:          '100%',
    backgroundColor: colors.card,
  },
  initialsWrap: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: fonts.display,
    fontSize:   24,
    color:      colors.headerTextPrimary,
  },
  text: {
    flex:     1,
    minWidth: 0,
    gap:      4,
  },
  name: {
    fontFamily: fonts.display,
    fontSize:   30,
    lineHeight: 32,
    color:      colors.text,
  },
  city: {
    fontSize:   15,
    fontWeight: '600',
    color:      colors.textMuted,
  },
  disciplines: {
    fontSize:   14,
    lineHeight: 20,
    color:      colors.text,
  },
  homeLabel: {
    alignSelf:         'flex-start',
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    marginTop:         4,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      8,
    backgroundColor:   colors.accentBlueTint,
  },
  homeText: {
    fontSize:   13,
    fontWeight: '700',
    color:      colors.accentBlueText,
  },
});
