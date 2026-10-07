import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../i18n/language';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { coverHeightFor } from '../../utils/coverLayout';
import type { Focus } from '../../utils/coverLayout';
import type { FighterCardData } from './FighterCard';
import type { ToolbarAction } from './ProfileParts';
import DisciplineBadges from './DisciplineBadges';
import ZoomableProfilePhoto from './ZoomableProfilePhoto';
import CountryFlag from '../common/CountryFlag';
import { countryByCode, countryName } from '../../utils/countries';
import CoverImage from './CoverImage';
import RingRopesBackdrop from '../common/RingRopesBackdrop';

const AVATAR = 88;
const AVATAR_OVERLAP = 32;
const SIDE = 16;

export interface HeroGym {
  id:   string;
  name: string;
  city: string;
}

// Profile hero in the manner of a fight poster: a wide training/cover photo
// (or the ring-rope graphic) fills the top of the screen, the name stands big
// at its lower edge over a dark gradient, a strip of blue tape carries the
// fighter name, the avatar sits on the photo edge. Gym, place, disciplines and
// the compact actions follow directly below on the page background.
export default function ProfileHeader({
  data, coverUrl, coverFocus, isProfessional, gym, hometown, countryCode, onPressGym, onBack, toolbar, actions,
}: {
  data:           FighterCardData;
  coverUrl:       string | null;
  coverFocus:     Focus;
  isProfessional: boolean;
  gym:            HeroGym | null;
  hometown:       string | null;
  countryCode:    string | null;
  onPressGym?:    () => void;
  onBack?:        () => void;
  toolbar:        ToolbarAction[];
  actions:        React.ReactNode;
}): React.ReactElement {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width, height: screenHeight } = useWindowDimensions();
  const [coverFailed, setCoverFailed] = useState(false);
  const coverHeight = coverHeightFor(screenHeight) + insets.top;
  const hasCover = coverUrl !== null && coverUrl.length > 0 && !coverFailed;

  const displayName = data.name !== null && data.name.trim().length > 0 ? data.name.trim() : t('profile.card.fighterFallback');
  const nickname = data.nickname !== null && data.nickname.trim().length > 0 ? data.nickname.trim() : null;
  const town = hometown !== null && hometown.trim().length > 0 ? hometown.trim() : null;
  const country = countryByCode(countryCode);

  return (
    <View>
      <View style={[styles.cover, { height: coverHeight }]}>
        {hasCover
          ? <CoverImage uri={coverUrl as string} focus={coverFocus} frame={{ width, height: coverHeight }} onError={() => setCoverFailed(true)} />
          : <RingRopesBackdrop />}

        {/* Scrims: top for the toolbar, bottom for the name */}
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="heroScrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.dark} stopOpacity={hasCover ? 0.45 : 0} />
              <Stop offset="0.28" stopColor={colors.dark} stopOpacity="0" />
              <Stop offset="0.5" stopColor={colors.dark} stopOpacity="0" />
              <Stop offset="1" stopColor={colors.dark} stopOpacity="0.88" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroScrim)" />
        </Svg>

        <View style={[styles.toolbar, { top: insets.top }]}>
          {onBack !== undefined ? (
            <TouchableOpacity style={styles.chip} onPress={onBack} accessibilityRole="button" accessibilityLabel={t('common.back')}>
              <Ionicons name="chevron-back" size={22} color={colors.headerTextPrimary} />
            </TouchableOpacity>
          ) : <View />}
          <View style={styles.toolbarRight}>
            {toolbar.map((a) => (
              <TouchableOpacity
                key={a.label}
                style={styles.chip}
                onPress={a.onPress}
                accessibilityRole="button"
                accessibilityLabel={a.label}
              >
                <Ionicons name={a.icon} size={20} color={colors.headerTextPrimary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Animated.View entering={FadeInDown.duration(360)} style={styles.nameBlock}>
          {nickname !== null ? (
            <Animated.View entering={FadeIn.delay(140).duration(300)} style={styles.tape}>
              {/* Only the strip is tilted; the text stays unrotated and sharp */}
              <View style={styles.tapeStrip} />
              <Text style={styles.tapeText} numberOfLines={1} maxFontSizeMultiplier={1.4}>„{nickname}“</Text>
            </Animated.View>
          ) : (
            <View style={styles.tapeMark} />
          )}
          <Text
            style={styles.name}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
            maxFontSizeMultiplier={1.2}
            accessibilityRole="header"
            accessibilityLabel={data.isVerified ? t('profile.header.verifiedName', { name: displayName }) : displayName}
          >
            {displayName}
          </Text>
          {country !== null && (
            <View style={styles.flag} accessible accessibilityLabel={t('profile.header.flag', { country: countryName(country, language) })}>
              <CountryFlag code={country.code} width={40} tilted />
            </View>
          )}
        </Animated.View>

        <View style={styles.avatar}>
          <ZoomableProfilePhoto uri={data.avatarUrl} name={data.name} size={AVATAR} />
          {data.isVerified && (
            <View style={styles.verified} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Ionicons name="checkmark-circle" size={24} color={colors.accentBlue} />
            </View>
          )}
        </View>
      </View>

      {/* Without a place line the next row must clear the overlapping avatar. */}
      <View style={[styles.below, gym === null && town === null && styles.belowClearAvatar]}>
        {(gym !== null || town !== null) && (
          <View style={styles.placeRow}>
            <Ionicons name="location-sharp" size={16} color={colors.accentBlue} />
            {gym !== null ? (
              <Pressable
                onPress={onPressGym}
                disabled={onPressGym === undefined}
                accessibilityRole={onPressGym !== undefined ? 'link' : 'text'}
                hitSlop={8}
                style={({ pressed }) => [styles.placePress, pressed && styles.pressed]}
              >
                <Text style={styles.place}>
                  <Text style={styles.placeStrong}>{gym.name}</Text>
                  {gym.city.length > 0 ? `, ${gym.city}` : ''}
                </Text>
              </Pressable>
            ) : (
              <Text style={[styles.place, styles.placePress]}>{town}</Text>
            )}
          </View>
        )}

        {(data.disciplines.length > 0 || isProfessional) && (
          <View style={styles.labels}>
            <DisciplineBadges disciplines={data.disciplines} />
            {isProfessional && (
              <View style={styles.proBadge}>
                <Text style={styles.proText}>{t('profile.fights.pro')}</Text>
              </View>
            )}
          </View>
        )}

        {actions}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    width:           '100%',
    backgroundColor: colors.dark,
    overflow:        'visible',
    zIndex:          1,
  },
  toolbar: {
    position:          'absolute',
    left:              0,
    right:             0,
    flexDirection:     'row',
    justifyContent:    'space-between',
    paddingHorizontal: 8,
    paddingTop:        8,
  },
  toolbarRight: {
    flexDirection: 'row',
    gap:           8,
  },
  chip: {
    width:           44,
    height:          44,
    borderRadius:    22,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.coverChip,
  },
  nameBlock: {
    position: 'absolute',
    left:     SIDE,
    right:    SIDE + AVATAR + 8,
    bottom:   AVATAR_OVERLAP + 16,
    gap:      8,
  },
  tape: {
    alignSelf:         'flex-start',
    maxWidth:          '100%',
    paddingHorizontal: 8,
    paddingVertical:   4,
  },
  tapeStrip: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.accentBlue,
    transform:       [{ rotate: '-2deg' }],
  },
  tapeText: {
    fontSize:   15,
    fontWeight: '800',
    color:      colors.dark,
  },
  tapeMark: {
    width:           40,
    height:          8,
    backgroundColor: colors.accentBlue,
    transform:       [{ rotate: '-2deg' }],
  },
  name: {
    fontFamily:    fonts.display,
    fontSize:      52,
    lineHeight:    52,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color:         colors.headerTextPrimary,
  },
  flag: {
    alignSelf: 'flex-start',
  },
  avatar: {
    position: 'absolute',
    right:    SIDE,
    bottom:   -AVATAR_OVERLAP,
  },
  verified: {
    position:        'absolute',
    right:           -8,
    bottom:          -8,
    borderRadius:    16,
    backgroundColor: colors.card,
  },
  below: {
    paddingHorizontal: SIDE,
    paddingTop:        16,
    gap:               16,
  },
  belowClearAvatar: {
    paddingTop: AVATAR_OVERLAP + 16,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           8,
    paddingRight:  AVATAR + 8,
    minHeight:     24,
  },
  placePress: {
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  place: {
    fontSize:   15,
    lineHeight: 22,
    color:      colors.textMuted,
  },
  placeStrong: {
    fontWeight: '700',
    color:      colors.text,
  },
  labels: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  proBadge: {
    minHeight:         32,
    paddingHorizontal: 8,
    borderRadius:      8,
    borderWidth:       1,
    borderColor:       colors.dark,
    justifyContent:    'center',
  },
  proText: {
    fontSize:   12,
    fontWeight: '800',
    color:      colors.text,
  },
});
