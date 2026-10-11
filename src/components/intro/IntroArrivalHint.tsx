import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import type { IntroArrivalHint as Variant } from '../../utils/intro';

const COACH = require('../../../assets/coach/coach-waitlist.png');
const COACH_RATIO = 192 / 175;
const COACH_HEIGHT = 56;

// One small coach note inside the first real page after the intro. Regular
// layout space (scrolls with the page), no dim, no modal, nothing covered.
// `onShown` fires once it is really laid out, so it only counts as seen
// when it was visible.
export default function IntroArrivalHint({ variant, onDismiss, onShown }: {
  variant:   Variant;
  onDismiss: () => void;
  onShown:   () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.card} onLayout={onShown} accessibilityRole="summary">
      <Image
        source={COACH}
        style={styles.coach}
        resizeMode="contain"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      />
      <View style={styles.text}>
        <Text style={styles.title}>{t(`onboarding.arrival.${variant}.title`)}</Text>
        <Text style={styles.body}>{t(`onboarding.arrival.${variant}.body`)}</Text>
        <TouchableOpacity style={styles.action} onPress={onDismiss} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.actionText}>{t('onboarding.arrival.dismiss')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             16,
    padding:         16,
    borderRadius:    16,
    borderWidth:     1.5,
    borderColor:     colors.dark,
    backgroundColor: colors.coachBubble,
  },
  coach: {
    width:  Math.round(COACH_HEIGHT * COACH_RATIO),
    height: COACH_HEIGHT,
  },
  text: {
    flex: 1,
    gap:  4,
  },
  title: {
    fontSize:   16,
    lineHeight: 22,
    fontWeight: '800',
    color:      colors.text,
  },
  body: {
    fontSize:   14,
    lineHeight: 20,
    color:      colors.text,
  },
  action: {
    alignSelf:      'flex-start',
    minHeight:      40,
    justifyContent: 'center',
  },
  actionText: {
    fontSize:           14,
    fontWeight:         '700',
    color:              colors.brandPrimary,
    textDecorationLine: 'underline',
  },
});
