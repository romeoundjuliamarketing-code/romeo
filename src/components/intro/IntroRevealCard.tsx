import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useLocalized } from '../../i18n/language';
import ChallengeCard from '../challenge/ChallengeCard';
import ChallengeCardBack from '../challenge/ChallengeCardBack';
import type { SparringChallenge } from '../../data/sparringChallenges';

const FLIP_MS = 460;
const FADE_MS = 200;

// One example card, face down until tapped. A real button: one tap reveals
// it (3D flip, or a cross-fade with reduced motion); afterwards it is a
// plain readable card, flat and sharp, and further taps do nothing.
export default function IntroRevealCard({ challenge, width, revealed, onReveal }: {
  challenge: SparringChallenge;
  width:     number;
  revealed:  boolean;
  onReveal:  () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const tx = useLocalized();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(revealed ? 1 : 0);
  // The back takes the open card's height (the front decides the size).
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!revealed) return;
    progress.value = withTiming(1, {
      duration: reduceMotion ? FADE_MS : FLIP_MS,
      easing:   Easing.out(Easing.cubic),
    });
  }, [revealed, reduceMotion, progress]);

  const backStyle = useAnimatedStyle(() => (reduceMotion
    ? { opacity: 1 - progress.value }
    : {
      opacity:   progress.value < 0.5 ? 1 : 0,
      transform: [
        { perspective: 1000 },
        { rotateY: `${progress.value * 180}deg` },
      ],
    }));
  const frontStyle = useAnimatedStyle(() => (reduceMotion
    ? { opacity: progress.value }
    : {
      opacity:   progress.value < 0.5 ? 0 : 1,
      transform: [{ perspective: 1000 }, { rotateY: `${progress.value * 180 - 180}deg` }],
    }));

  const onFrontLayout = (e: LayoutChangeEvent): void => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h !== height) setHeight(h);
  };

  return (
    <Pressable
      onPress={onReveal}
      disabled={revealed}
      // Once open it is just the card's text, no longer a control.
      accessibilityRole={revealed ? 'text' : 'button'}
      accessibilityLabel={revealed
        ? t('onboarding.intro.card.revealedA11y', { title: tx(challenge.title), instruction: tx(challenge.instruction) })
        : t('onboarding.intro.card.revealA11y')}
      accessibilityHint={revealed ? undefined : t('onboarding.intro.card.revealHint')}
    >
      <Animated.View style={frontStyle} onLayout={onFrontLayout} importantForAccessibility="no-hide-descendants">
        <ChallengeCard
          challenge={challenge}
          size={{ width, height: 0 }}
          scrollable={false}
          elevated={false}
          preview
          previewLabel={t('onboarding.intro.card.meta')}
          badge={t('onboarding.intro.card.badge')}
        />
      </Animated.View>
      {height > 0 && (
        <Animated.View style={[styles.back, backStyle]} pointerEvents="none">
          <ChallengeCardBack size={{ width, height }} elevated={false} />
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: {
    ...StyleSheet.absoluteFillObject,
  },
});
