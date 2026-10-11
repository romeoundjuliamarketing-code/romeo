import React, { useEffect, useRef } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, AccessibilityInfo, findNodeHandle, StyleSheet,
  useWindowDimensions, type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors } from '../../theme/colors';
import ComicSpeechBubble, { type BubbleTail } from '../coach/ComicSpeechBubble';
import { CoachPrimaryButton } from '../coach/CoachAnswerButtons';
import type { TourScene } from './tourScenes';

const SIDE = 16;
const GAP = 8;
// Coach width beside the bubble: upright figures narrower than wide scenes.
const COACH_UPRIGHT = 96;
const COACH_WIDE = 128;
// Large text or narrow screens: bubble over the full width, coach below it.
const STACK_FONT_SCALE = 1.35;
const STACK_WIDTH = 360;
// Side layout: the tail leaves the bubble's lower left edge towards the
// coach's face below-left of it. Stacked: straight down to the coach.
const TAIL_SIDE: BubbleTail = { baseX: 36, tipX: -36, tipY: 14 };
const TAIL_STACKED: BubbleTail = { baseX: 48, tipX: 40, tipY: 14 };

export interface TourPanelAction {
  label:   string;
  onPress: () => void;
}

/** Free area between progress row and coach group (overlay coordinates). */
export interface TourFreeArea {
  top:    number;
  bottom: number;
}

// The one tour surface: a small progress/skip row in the top safe area, the
// free middle (the real app, or a static example on `stage`) and a compact
// coach group at the bottom: coach left, short bubble right above his face,
// the main action right under the bubble and a small back link beside it.
// The group only grows with the text; if it outgrows the screen it scrolls,
// the middle shrinks first.
export default function TourPanel({
  onFreeArea, stepKey, progress, title, body, hint, stage, scene,
  primary, secondary, backLabel, onBack, skipLabel, onSkip,
}: {
  onFreeArea: (area: TourFreeArea) => void;
  /** Changes per station: entrance and screen reader focus. */
  stepKey:    string;
  progress:   string;
  title:      string;
  body:       string;
  /** One small line under the text. */
  hint?:      string;
  /** Static content in the free middle (cards station). */
  stage?:     React.ReactNode;
  scene:      TourScene;
  primary:    TourPanelAction;
  secondary?: TourPanelAction;
  backLabel:  string;
  onBack?:    () => void;
  skipLabel:  string;
  onSkip:     () => void;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const titleRef = useRef<Text>(null);
  const area = useRef<TourFreeArea>({ top: 0, bottom: 0 });

  // Screen readers start each station at its title.
  useEffect(() => {
    const node = findNodeHandle(titleRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, [stepKey]);

  function report(next: TourFreeArea): void {
    if (next.top === area.current.top && next.bottom === area.current.bottom) return;
    area.current = next;
    if (next.bottom > next.top) onFreeArea(next);
  }
  const onTopLayout = (e: LayoutChangeEvent): void => {
    const { y, height } = e.nativeEvent.layout;
    report({ ...area.current, top: Math.round(y + height) });
  };
  const onGroupLayout = (e: LayoutChangeEvent): void => {
    report({ ...area.current, bottom: Math.round(e.nativeEvent.layout.y) });
  };

  const stacked = fontScale >= STACK_FONT_SCALE || width < STACK_WIDTH;
  const coachWidth = (scene.ratio < 1 ? COACH_UPRIGHT : COACH_WIDE) - (stacked ? 16 : 0);
  const coachSize = { width: coachWidth, height: Math.round(coachWidth / scene.ratio) };
  const coachSpace = { width: coachWidth };

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={[styles.top, { paddingTop: insets.top + GAP }]} onLayout={onTopLayout} pointerEvents="box-none">
        <View style={styles.pill}>
          <Text style={styles.progress} numberOfLines={2}>{progress}</Text>
          <TouchableOpacity style={styles.skip} onPress={onSkip} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.skipText}>{skipLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.stage} pointerEvents="box-none">
        {stage !== undefined && (
          <ScrollView contentContainerStyle={styles.stageContent} showsVerticalScrollIndicator={false}>
            {stage}
          </ScrollView>
        )}
      </View>

      <View style={styles.group} onLayout={onGroupLayout}>
        <ScrollView
          style={styles.groupScroll}
          contentContainerStyle={[styles.groupContent, { paddingBottom: insets.bottom + SIDE }]}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View key={stepKey} entering={FadeIn.duration(180)}>
            <View style={styles.row}>
              {!stacked && <View style={coachSpace} />}
              <View style={styles.flex}>
                <ComicSpeechBubble tail={stacked ? TAIL_STACKED : TAIL_SIDE} compact>
                  <View style={styles.message}>
                    <Text ref={titleRef} style={styles.title} accessibilityRole="header">{title}</Text>
                    <Text style={styles.body}>{body}</Text>
                    {hint !== undefined && <Text style={styles.hint}>{hint}</Text>}
                  </View>
                </ComicSpeechBubble>
              </View>
            </View>
            <View style={[styles.row, styles.actionsRow]}>
              <Image
                source={scene.source}
                style={coachSize}
                resizeMode="contain"
                accessible={false}
                importantForAccessibility="no-hide-descendants"
                accessibilityElementsHidden
              />
              <View style={styles.flex}>
                <CoachPrimaryButton label={primary.label} onPress={primary.onPress} />
                {(onBack !== undefined || secondary !== undefined) && (
                  <View style={styles.links}>
                    {onBack !== undefined ? (
                      <TouchableOpacity style={styles.link} onPress={onBack} accessibilityRole="button" hitSlop={8}>
                        <Text style={styles.linkText}>{backLabel}</Text>
                      </TouchableOpacity>
                    ) : <View />}
                    {secondary !== undefined && (
                      <TouchableOpacity style={[styles.link, styles.secondary]} onPress={secondary.onPress} accessibilityRole="button" hitSlop={8}>
                        <Text style={[styles.linkText, styles.secondaryText]}>{secondary.label}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column',
  },
  top: {
    paddingHorizontal: SIDE,
    alignItems:        'center',
  },
  pill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               16,
    maxWidth:          '100%',
    paddingHorizontal: 16,
    borderRadius:      16,
    backgroundColor:   colors.tourPill,
  },
  progress: {
    flexShrink: 1,
    fontSize:   13,
    fontWeight: '600',
    color:      colors.headerTextPrimary,
  },
  skip: {
    minHeight:      40,
    justifyContent: 'center',
  },
  skipText: {
    fontSize:           13,
    fontWeight:         '700',
    color:              colors.headerTextPrimary,
    textDecorationLine: 'underline',
  },
  stage: {
    flex:      1,
    minHeight: 0,
  },
  stageContent: {
    flexGrow:          1,
    justifyContent:    'center',
    alignItems:        'center',
    paddingHorizontal: SIDE,
    paddingVertical:   16,
  },
  group: { flexShrink: 1 },
  groupScroll: { flexGrow: 0 },
  groupContent: {
    paddingHorizontal: SIDE,
    paddingTop:        GAP,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           GAP,
  },
  // Bubble to button: 8 + the bubble shadow.
  actionsRow: { marginTop: GAP },
  flex: { flex: 1 },
  message: { gap: 4 },
  title: {
    fontSize:   19,
    lineHeight: 24,
    fontWeight: '800',
    color:      colors.text,
  },
  body: {
    fontSize:   15,
    lineHeight: 21,
    color:      colors.text,
  },
  hint: {
    fontSize:   13,
    lineHeight: 18,
    color:      colors.textMuted,
  },
  links: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            16,
  },
  // Small dark chips: readable over any part of the app.
  link: {
    minHeight:         40,
    justifyContent:    'center',
    marginTop:         GAP,
    paddingHorizontal: 16,
    borderRadius:      16,
    backgroundColor:   colors.tourPill,
  },
  linkText: {
    fontSize:           14,
    fontWeight:         '600',
    color:              colors.headerTextPrimary,
    textDecorationLine: 'underline',
  },
  secondary: { flexShrink: 1 },
  secondaryText: { textAlign: 'right' },
});
