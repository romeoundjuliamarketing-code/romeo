import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';
import * as Flags from 'country-flag-icons/string/3x2';
import { colors } from '../../theme/colors';

const FLAG_SVGS = Flags as unknown as Record<string, string | undefined>;

// Bundled 3:2 SVG flag (no emoji, renders the same on iOS and Android), drawn
// as a cartoon sticker: white die-cut edge, dark ink outline, hard offset
// shadow and a gloss band — reads on the dark cover and on the light page.
// `tilted` sticks it on slightly crooked, like the blue tape in the profile.
// Renders nothing for an unknown code.
export default function CountryFlag({ code, width, tilted = false }: {
  code: string; width: number; tilted?: boolean;
}): React.ReactElement | null {
  const xml = FLAG_SVGS[code];
  if (xml === undefined) return null;
  const height = Math.round((width * 2) / 3);
  const edge = Math.max(2, Math.round(width / 14));
  const shadow = Math.max(2, Math.round(width / 16));
  const radius = Math.round(width / 6);
  const size = { width, height, borderRadius: radius };
  return (
    <View
      style={[{ width: width + shadow, height: height + shadow }, tilted && styles.tilted]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.shadow, size, { left: shadow, top: shadow }]} />
      <View style={[styles.sticker, size, { padding: edge }]}>
        <View style={[styles.flag, { borderRadius: Math.max(radius - edge, 2) }]}>
          <SvgXml xml={xml} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
          <View style={styles.gloss} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tilted: {
    transform: [{ rotate: '-4deg' }],
  },
  shadow: {
    position:        'absolute',
    backgroundColor: colors.dark,
  },
  sticker: {
    position:        'absolute',
    left:            0,
    top:             0,
    backgroundColor: colors.card,
    borderWidth:     1.5,
    borderColor:     colors.dark,
  },
  flag: {
    flex:     1,
    overflow: 'hidden',
  },
  gloss: {
    position:                'absolute',
    left:                    0,
    right:                   0,
    top:                     0,
    height:                  '42%',
    backgroundColor:         colors.flagGloss,
    borderBottomLeftRadius:  999,
    borderBottomRightRadius: 999,
  },
});
