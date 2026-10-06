import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { getInitials } from '../../utils/initials';
import RingRopesBackdrop from '../common/RingRopesBackdrop';

const TILE = 56;

// Space the content must leave on the right for the logo/initials tile.
export function gymBannerReserve(bannerUrl: string | null): number {
  return bannerUrl !== null && bannerUrl.length > 0 ? 16 : 16 + TILE + 16;
}

// Wide gym surface: the gym's banner photo when there is one, otherwise the
// ring-rope graphic with the logo (or initials) as a tile. Never an empty or
// broken image area — a failed image falls back to the graphic.
export default function GymBanner({ name, bannerUrl, logoUrl, height, children }: {
  name:      string;
  bannerUrl: string | null;
  logoUrl:   string | null;
  height:    number;
  children?: React.ReactNode;
}): React.ReactElement {
  const [bannerFailed, setBannerFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const hasBanner = bannerUrl !== null && bannerUrl.length > 0 && !bannerFailed;
  const hasLogo = logoUrl !== null && logoUrl.length > 0 && !logoFailed;

  return (
    <View style={[styles.wrap, { minHeight: height }]}>
      {hasBanner ? (
        <Image
          source={{ uri: bannerUrl as string }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setBannerFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <>
          <RingRopesBackdrop />
          <View style={styles.tile}>
            {hasLogo ? (
              <Image
                source={{ uri: logoUrl as string }}
                style={styles.logo}
                resizeMode="cover"
                onError={() => setLogoFailed(true)}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <Text style={styles.initials} maxFontSizeMultiplier={1}>
                {getInitials(name)}
              </Text>
            )}
          </View>
        </>
      )}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="gymScrim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.dark} stopOpacity={hasBanner ? 0.15 : 0} />
            <Stop offset="1" stopColor={colors.dark} stopOpacity={hasBanner ? 0.85 : 0.5} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#gymScrim)" />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width:           '100%',
    borderRadius:    16,
    overflow:        'hidden',
    backgroundColor: colors.dark,
  },
  tile: {
    position:        'absolute',
    right:           16,
    top:             '50%',
    marginTop:       -TILE / 2,
    width:           TILE,
    height:          TILE,
    borderRadius:    16,
    overflow:        'hidden',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.card,
  },
  logo: {
    width:  '100%',
    height: '100%',
  },
  initials: {
    fontFamily: fonts.display,
    fontSize:   24,
    color:      colors.dark,
  },
});
