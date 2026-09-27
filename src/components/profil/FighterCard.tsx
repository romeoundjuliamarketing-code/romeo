import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { cardFrame } from '../../data/cardFrames';
import type { CardFrame, CardFrameId } from '../../data/cardFrames';
import DisciplineBadges from './DisciplineBadges';
import { stanceLabel } from '../../utils/stance';
import type { Stance } from '../../utils/stance';
import type { FactRow } from '../../utils/athleteProfile';
import SparrLogo from '../common/SparrLogo';
import { getInitials } from '../../utils/initials';

export interface FighterCardData {
  name:          string | null;
  nickname:      string | null;
  avatarUrl:     string | null;
  /** Keeps its existing meaning per screen (own: tier 'verified'; foreign: coach-confirmed). */
  isVerified:    boolean;
  disciplines:   string[];
  weightKg:      number | null;
  heightCm:      number | null;
  stance:        Stance | null;
  gymName:       string | null;
  location:      string | null;
  frame:         CardFrameId | string | null;
  motto:         string | null;
  favoriteMove:  string | null;
  trainingFocus: string | null;
  backFacts:     FactRow[];
}

interface Props {
  data:     FighterCardData;
  flipped:  boolean;
  isOwn:    boolean;
}

const FLIP_MS = 360;

// The athlete's personal fighter card: photo, name band, discipline badges,
// body numbers and gym on the front; motto, favourite move, focus and facts
// on the back. Flipping is controlled by the parent (an explicit, labelled
// action); with "reduce motion" the faces switch without rotation.
export default function FighterCard({ data, flipped, isOwn }: Props): React.ReactElement {
  const frame = cardFrame(data.frame);
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(flipped ? 180 : 0);
  const [frontH, setFrontH] = useState(0);
  const [backH, setBackH] = useState(0);

  useEffect(() => {
    const target = flipped ? 180 : 0;
    rotation.value = reduceMotion
      ? target
      : withTiming(target, { duration: FLIP_MS, easing: Easing.inOut(Easing.cubic) });
  }, [flipped, reduceMotion, rotation]);

  // Only transform + opacity are animated. Opacity hides the face that turned
  // away (backface culling is unreliable on some Android GPUs).
  const frontStyle = useAnimatedStyle(() => ({
    opacity:   rotation.value < 90 ? 1 : 0,
    transform: [{ perspective: 1200 }, { rotateY: `${rotation.value}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity:   rotation.value >= 90 ? 1 : 0,
    transform: [{ perspective: 1200 }, { rotateY: `${interpolate(rotation.value, [0, 180], [180, 360])}deg` }],
  }));

  const minHeight = Math.max(frontH, backH);

  return (
    <View style={styles.wrap}>
      {/* Solid offset shadow: calm, no blur */}
      <View style={[styles.solidShadow, minHeight > 0 && { minHeight }]} />
      <View style={minHeight > 0 ? { minHeight } : undefined}>
        <Animated.View
          style={[styles.face, faceFrame(frame), minHeight > 0 && { minHeight }, frontStyle]}
          importantForAccessibility={flipped ? 'no-hide-descendants' : 'auto'}
          accessibilityElementsHidden={flipped}
          pointerEvents={flipped ? 'none' : 'auto'}
        >
          <View onLayout={(e: LayoutChangeEvent) => setFrontH(e.nativeEvent.layout.height)}>
            <CardFront data={data} frame={frame} />
          </View>
        </Animated.View>
        <Animated.View
          style={[styles.face, styles.backFace, faceFrame(frame), minHeight > 0 && { minHeight }, backStyle]}
          importantForAccessibility={flipped ? 'auto' : 'no-hide-descendants'}
          accessibilityElementsHidden={!flipped}
          pointerEvents={flipped ? 'auto' : 'none'}
        >
          <View onLayout={(e: LayoutChangeEvent) => setBackH(e.nativeEvent.layout.height)}>
            <CardBack data={data} frame={frame} isOwn={isOwn} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

function faceFrame(frame: CardFrame) {
  return { backgroundColor: frame.cardBg, borderColor: frame.border, borderWidth: frame.borderWidth };
}

// Front face — also rendered alone (fixed width) for the shared image.
export function CardFront({ data, frame, photoHeight = 240 }: {
  data: FighterCardData;
  frame: CardFrame;
  /** Lower in the 9:16 story export so the whole card fits without scaling. */
  photoHeight?: number;
}): React.ReactElement {
  const [photoFailed, setPhotoFailed] = useState(false);
  const hasPhoto = data.avatarUrl !== null && data.avatarUrl.length > 0 && !photoFailed;
  const displayName = data.name !== null && data.name.trim().length > 0 ? data.name.trim() : 'Kämpfer';
  const stanceText = stanceLabel(data.stance);
  const numbers: FactRow[] = [];
  if (data.weightKg !== null) numbers.push({ label: 'Gewicht', value: `${data.weightKg} kg` });
  if (data.heightCm !== null) numbers.push({ label: 'Größe', value: `${data.heightCm} cm` });
  if (stanceText !== null) numbers.push({ label: 'Auslage', value: stanceText });
  const place = [data.gymName, data.location].filter((v): v is string => v !== null && v.trim().length > 0);
  const onDarkCard = frame.cardBg === colors.dark;

  return (
    <>
      <View style={[styles.photo, { height: photoHeight }]}>
        {hasPhoto ? (
          <Image
            source={{ uri: data.avatarUrl as string }}
            style={styles.photoImage}
            resizeMode="cover"
            onError={() => setPhotoFailed(true)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={styles.photoFallback}>
            <Text style={styles.photoInitials} accessibilityElementsHidden>{getInitials(data.name)}</Text>
          </View>
        )}
        <View style={styles.markChip}>
          <SparrLogo size={20} />
        </View>
        {data.isVerified && (
          <View style={styles.verifiedChip} accessible accessibilityLabel="Verifiziert">
            <Ionicons name="checkmark-circle" size={16} color={colors.accentBlue} />
            <Text style={styles.verifiedText}>Verifiziert</Text>
          </View>
        )}
      </View>

      <View style={[styles.band, { backgroundColor: frame.band }]}>
        <Text
          style={[styles.name, { color: frame.bandText }]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          accessibilityRole="header"
        >
          {displayName}
        </Text>
        {data.nickname !== null && data.nickname.trim().length > 0 && (
          <Text style={[styles.nickname, { color: frame.nickname }]} numberOfLines={1}>
            „{data.nickname.trim()}“
          </Text>
        )}
      </View>

      <View style={styles.frontBody}>
        <DisciplineBadges disciplines={data.disciplines} onDark={onDarkCard} />

        {numbers.length > 0 && (
          <View style={[styles.numbers, { borderColor: frame.line }]}>
            {numbers.map((n, i) => (
              <View key={n.label} style={[styles.number, i > 0 && { borderLeftColor: frame.line }, i > 0 && styles.numberDivider]}>
                <Text style={[styles.numberValue, { color: frame.text }]} numberOfLines={1} adjustsFontSizeToFit>
                  {n.value}
                </Text>
                <Text style={[styles.numberLabel, { color: frame.subtle }]}>{n.label}</Text>
              </View>
            ))}
          </View>
        )}

        {place.length > 0 && (
          <View style={styles.placeRow}>
            <Ionicons name="location-sharp" size={16} color={frame.accent} />
            <Text style={[styles.placeText, { color: frame.text }]} numberOfLines={2}>{place.join(' · ')}</Text>
          </View>
        )}
      </View>
    </>
  );
}

function CardBack({ data, frame, isOwn }: { data: FighterCardData; frame: CardFrame; isOwn: boolean }) {
  const motto = data.motto?.trim() ?? '';
  const move = data.favoriteMove?.trim() ?? '';
  const focus = data.trainingFocus?.trim() ?? '';
  const nothing = motto.length === 0 && move.length === 0 && focus.length === 0 && data.backFacts.length === 0;

  return (
    <View style={styles.back}>
      <View style={styles.backHeader}>
        <SparrLogo size={24} />
        <Text style={[styles.backTitle, { color: frame.text }]}>Kämpferkarte</Text>
      </View>

      {motto.length > 0 && (
        <View style={[styles.mottoBox, { borderLeftColor: frame.accent }]}>
          <Text style={[styles.backLabel, { color: frame.subtle }]}>Motto</Text>
          <Text style={[styles.motto, { color: frame.text }]}>„{motto}“</Text>
        </View>
      )}
      {move.length > 0 && <BackRow label="Lieblingsmove" value={move} frame={frame} />}
      {focus.length > 0 && <BackRow label="Aktueller Fokus" value={focus} frame={frame} />}

      {data.backFacts.length > 0 && (
        <View style={[styles.facts, { borderTopColor: frame.line }]}>
          {data.backFacts.map((f) => (
            <View key={f.label} style={styles.fact}>
              <Text style={[styles.backLabel, { color: frame.subtle }]}>{f.label}</Text>
              <Text style={[styles.factValue, { color: frame.text }]}>{f.value}</Text>
            </View>
          ))}
        </View>
      )}

      {nothing && (
        <Text style={[styles.backEmpty, { color: frame.subtle }]}>
          {isOwn
            ? 'Motto und Lieblingsmove kannst du unter „Profil bearbeiten“ ergänzen.'
            : 'Keine weiteren Angaben.'}
        </Text>
      )}
    </View>
  );
}

function BackRow({ label, value, frame }: { label: string; value: string; frame: CardFrame }) {
  return (
    <View style={styles.backRow}>
      <Text style={[styles.backLabel, { color: frame.subtle }]}>{label}</Text>
      <Text style={[styles.backValue, { color: frame.text }]}>{value}</Text>
    </View>
  );
}

const RADIUS = 24;

const styles = StyleSheet.create({
  wrap: {
    paddingRight:  8,
    paddingBottom: 8,
  },
  solidShadow: {
    position:        'absolute',
    top:             8,
    left:            8,
    right:           0,
    bottom:          0,
    borderRadius:    RADIUS,
    backgroundColor: colors.hairline,
  },
  face: {
    borderRadius: RADIUS,
    overflow:     'hidden',
  },
  backFace: {
    position: 'absolute',
    top:      0,
    left:     0,
    right:    0,
  },
  photo: {
    backgroundColor: colors.background,
  },
  photoImage: {
    width:  '100%',
    height: '100%',
  },
  photoFallback: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.background,
  },
  photoInitials: {
    fontSize:      72,
    fontWeight:    '900',
    letterSpacing: -2,
    color:         colors.text,
  },
  markChip: {
    position:        'absolute',
    top:             16,
    left:            16,
    width:           36,
    height:          36,
    borderRadius:    12,
    backgroundColor: colors.card,
    alignItems:      'center',
    justifyContent:  'center',
  },
  verifiedChip: {
    position:          'absolute',
    top:               16,
    right:             16,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 8,
    minHeight:         32,
    borderRadius:      12,
    backgroundColor:   colors.card,
  },
  verifiedText: {
    fontSize:   12,
    fontWeight: '700',
    color:      colors.text,
  },
  band: {
    paddingHorizontal: 16,
    paddingVertical:   16,
    gap:               4,
  },
  name: {
    fontSize:      28,
    fontWeight:    '900',
    letterSpacing: -0.5,
    textTransform: 'uppercase',
  },
  nickname: {
    fontSize:   16,
    fontWeight: '800',
  },
  frontBody: {
    padding: 16,
    gap:     16,
  },
  numbers: {
    flexDirection:  'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  number: {
    flex:              1,
    alignItems:        'center',
    paddingHorizontal: 4,
    gap:               4,
  },
  numberDivider: {
    borderLeftWidth: 1,
  },
  numberValue: {
    fontSize:   20,
    fontWeight: '900',
  },
  numberLabel: {
    fontSize: 12,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           8,
  },
  placeText: {
    flex:       1,
    fontSize:   15,
    fontWeight: '600',
  },
  back: {
    padding: 24,
    gap:     16,
  },
  backHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  backTitle: {
    fontSize:      13,
    fontWeight:    '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  mottoBox: {
    borderLeftWidth: 4,
    paddingLeft:     16,
    gap:             4,
  },
  motto: {
    fontSize:   22,
    fontWeight: '800',
    lineHeight: 28,
  },
  backRow: {
    gap: 4,
  },
  backLabel: {
    fontSize:      12,
    fontWeight:    '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  backValue: {
    fontSize:   17,
    fontWeight: '700',
  },
  facts: {
    borderTopWidth: 1,
    paddingTop:     16,
    flexDirection:  'row',
    flexWrap:       'wrap',
    rowGap:         16,
  },
  fact: {
    width:        '50%',
    paddingRight: 8,
    gap:          4,
  },
  factValue: {
    fontSize:   15,
    fontWeight: '700',
  },
  backEmpty: {
    fontSize:   14,
    lineHeight: 20,
  },
});
