import React, { useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { CoachPrimaryButton } from '../coach/CoachAnswerButtons';
import { playableChallengesForArea } from '../../utils/challengeAvailability';
import { ONBOARDING_PREVIEW_CHALLENGE_ID } from '../../utils/intro';
import { SCENE_DRAW_CARD } from '../onboarding/onboardingScenes';
import IntroShell, { INTRO_GUTTER } from './IntroShell';
import IntroPeekStage from './IntroPeekStage';
import IntroRevealCard from './IntroRevealCard';

// The card takes the content width, capped on large devices.
const CARD_MAX_WIDTH = 400;

// Step 3: one face-down SPARR card over the full content width, the coach
// peeking over its top edge. Tapping reveals a fixed free example task. No
// access check, no paywall, no game start.
export default function IntroCardStep({ onNext, onBack, onLater }: {
  onNext:  () => void;
  onBack?: () => void;
  onLater: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [challenge] = useState(
    () => playableChallengesForArea('kickboxen').find((c) => c.id === ONBOARDING_PREVIEW_CHALLENGE_ID) ?? null,
  );
  const [revealed, setRevealed] = useState(false);
  const cardWidth = Math.min(width - INTRO_GUTTER * 2, CARD_MAX_WIDTH);

  return (
    <IntroShell
      step={3}
      topic={t('onboarding.intro.card.topic')}
      title={t('onboarding.intro.card.title')}
      lead={t('onboarding.intro.card.lead')}
      onBack={onBack}
      onLater={onLater}
      footer={(
        <>
          <Text style={styles.subscription}>{t('onboarding.intro.card.subscription')}</Text>
          <CoachPrimaryButton label={t('onboarding.intro.card.next')} onPress={onNext} />
        </>
      )}
    >
      {challenge !== null && (
        <View style={[styles.center, { width: cardWidth }]}>
          <IntroPeekStage scene={SCENE_DRAW_CARD}>
            <IntroRevealCard
              challenge={challenge}
              width={cardWidth}
              revealed={revealed}
              onReveal={() => setRevealed(true)}
            />
          </IntroPeekStage>
        </View>
      )}

      {revealed ? (
        <Animated.View entering={FadeIn.duration(220)} accessibilityLiveRegion="polite">
          <Text style={styles.after}>{t('onboarding.intro.card.after')}</Text>
        </Animated.View>
      ) : (
        <View style={styles.tapHint}>
          <Ionicons name="hand-left-outline" size={20} color={colors.brandPrimary} />
          <Text style={styles.tapHintText}>{t('onboarding.intro.card.tapHint')}</Text>
        </View>
      )}
    </IntroShell>
  );
}

const styles = StyleSheet.create({
  center: { alignSelf: 'center' },
  after: {
    fontSize:   17,
    lineHeight: 24,
    fontWeight: '600',
    color:      colors.text,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  tapHintText: {
    fontSize:   16,
    lineHeight: 24,
    fontWeight: '600',
    color:      colors.brandPrimary,
  },
  subscription: {
    fontSize:   13,
    lineHeight: 18,
    color:      colors.textMuted,
    textAlign:  'center',
  },
});
