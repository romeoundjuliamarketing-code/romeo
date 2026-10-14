import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import ReachInfoSheet from './ReachInfoSheet';

interface Props {
  /** Server reach state (get_sparring_reach_status): picks the info row wording. */
  unlocked:   boolean;
  baseKm:     number;
  unlockedKm: number;
  onFind:     () => void;
}

const COACH = require('../../../assets/coach/coach-location-map.png');
const COACH_ASPECT = 1152 / 768;

// Home content is capped at 600 pt with a 16 pt gutter per side.
const HOME_MAX_WIDTH = 600;
const PAGE_GUTTER    = 16;
const PAD            = 16;
// The coach rises above the surface and pokes out on the right.
const OVERHANG_TOP   = 24;
const OVERHANG_RIGHT = 8;

// Start scene of Home without an upcoming sparring: headline and button on the
// left, the coach with the map on the right, faint map lines and a pin behind.
// The reach rule lives behind the info row (bottom sheet), not in the scene.
// The coach rises in once (transform/opacity only, skipped with reduced motion).
export default function HomeSparringHero({ unlocked, baseKm, unlockedKm, onFind }: Props): React.ReactElement {
  const { t } = useTranslation();
  const [infoOpen, setInfoOpen] = useState(false);
  const { width, fontScale } = useWindowDimensions();
  const inner = Math.min(width, HOME_MAX_WIDTH) - 2 * PAGE_GUTTER;
  // Narrow screens or large text: a smaller coach above the text, so the
  // headline gets the full width and nothing sits under the art.
  const tight  = width < 360 || fontScale > 1.3;
  const coachW = Math.round(tight ? Math.min(inner * 0.42, 152) : Math.max(136, Math.min(inner * 0.44, 160)));
  const coachH = Math.round(coachW / COACH_ASPECT);
  const coachBox = { width: coachW, height: coachH };
  const headBox  = tight
    ? { paddingTop: coachH - OVERHANG_TOP }
    : { paddingRight: coachW - OVERHANG_RIGHT - PAD, minHeight: coachH - OVERHANG_TOP - PAD };

  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) });
  }, [reduceMotion, progress]);
  const coachStyle = useAnimatedStyle(() => ({
    opacity:   progress.value,
    transform: [{ translateY: 12 * (1 - progress.value) }],
  }));

  const reachLabel = unlocked
    ? t('home.start.reachUnlocked', { km: unlockedKm })
    : t('home.start.reachStart', { km: baseKm });

  return (
    <View style={styles.root}>
      <View style={styles.surface}>
        {/* Decoration only: faint streets, a radius ring and a pin. */}
        <View style={styles.decor} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <View style={[styles.street, styles.streetA]} />
          <View style={[styles.street, styles.streetB]} />
          <View style={[styles.street, styles.streetC]} />
          <View style={styles.ring} />
          <View style={styles.pin}>
            <Ionicons name="location" size={32} color={colors.accentBlueMuted} />
          </View>
        </View>

        {/* Only the headline shares its row with the coach; the subline runs
            below the art at full width, which keeps the surface flat. */}
        <View style={headBox}>
          <Text style={styles.headline} accessibilityRole="header">{t('home.start.headline')}</Text>
        </View>
        <Text style={styles.subline}>{t('home.start.subline')}</Text>

        <Pressable
          style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
          onPress={onFind}
          accessibilityRole="button"
        >
          <Ionicons name="search" size={18} color={colors.dark} />
          <Text style={styles.primaryText}>{t('home.start.find')}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.info, pressed && styles.infoPressed]}
          onPress={() => setInfoOpen(true)}
          accessibilityRole="button"
          accessibilityHint={t('home.start.reachHint')}
        >
          <Text style={styles.infoText}>{reachLabel}</Text>
          <Ionicons name="information-circle-outline" size={20} color={colors.accentBlueText} />
        </Pressable>
      </View>

      <Animated.View style={[styles.coach, coachBox, coachStyle]} pointerEvents="none">
        <Image source={COACH} style={coachBox} resizeMode="contain" accessible={false} />
      </Animated.View>

      <ReachInfoSheet
        visible={infoOpen}
        unlocked={unlocked}
        baseKm={baseKm}
        unlockedKm={unlockedKm}
        onClose={() => setInfoOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Room above the surface for the coach's head.
  root: {
    paddingTop: OVERHANG_TOP,
  },
  surface: {
    backgroundColor: colors.accentBlueTint,
    borderRadius: 24,
    paddingTop: PAD,
    paddingHorizontal: PAD,
  },
  // Clipped to the rounded surface, so no line runs past a corner.
  decor: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    overflow: 'hidden',
  },
  street: {
    position: 'absolute',
    height: 2,
    width: '160%',
    backgroundColor: colors.accentBlueSoft,
  },
  streetA: {
    left: '-30%',
    top: '58%',
    transform: [{ rotate: '-8deg' }],
  },
  streetB: {
    left: '-10%',
    top: '30%',
    transform: [{ rotate: '64deg' }],
  },
  streetC: {
    left: '-40%',
    bottom: 24,
    transform: [{ rotate: '14deg' }],
  },
  ring: {
    position: 'absolute',
    right: -40,
    bottom: -56,
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 2,
    borderColor: colors.accentBlueSoft,
  },
  pin: {
    position: 'absolute',
    right: 32,
    bottom: 24,
  },
  headline: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 32,
    textTransform: 'uppercase',
    color: colors.text,
  },
  subline: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  primary: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: colors.accentBlue,
  },
  primaryPressed: {
    backgroundColor: colors.accentBluePressed,
  },
  // Dark text on blue keeps > 6:1 (white would be ~3.3:1).
  primaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.dark,
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    minHeight: 44,
  },
  infoPressed: {
    opacity: 0.6,
  },
  infoText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.accentBlueText,
  },
  coach: {
    position: 'absolute',
    top: 0,
    right: -OVERHANG_RIGHT,
  },
});
