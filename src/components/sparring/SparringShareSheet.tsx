import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import SparringStoryCard, { STORY_CARD_WIDTH, STORY_CARD_HEIGHT } from './SparringStoryCard';
import type { SparringStoryCardProps } from './SparringStoryCard';
import { useSparringShare } from './useSparringShare';

export type SparringShareVariant = 'created' | 'reshare';

interface Props {
  variant:    SparringShareVariant;
  sparringId: string;
  card:       SparringStoryCardProps;
  onClose:    () => void;
}

const SLIDE_IN_MS  = 320;
const SLIDE_OUT_MS = 220;
const SLIDE_FROM   = 640;
const PREVIEW_MAX_H = 320;

// Share prompt for one sparring: story preview, share via the native share
// sheet, copy the link (for an Instagram link sticker). 'created' adds the
// success confirmation shown once right after publishing. Render it INSIDE the
// detail sheet's Modal (see CLAUDE.md, Modals/Sheets vs. Navigation).
export default function SparringShareSheet({
  variant, sparringId, card, onClose,
}: Props): React.ReactElement {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { shotRef, sharing, copied, shareImage, copyLink } = useSparringShare(sparringId, card.title);

  const progress = useSharedValue(0);
  const closingRef = useRef(false);
  useEffect(() => {
    progress.value = withTiming(1, { duration: SLIDE_IN_MS, easing: Easing.out(Easing.cubic) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close(): void {
    if (closingRef.current) return;
    closingRef.current = true;
    progress.value = withTiming(0, { duration: SLIDE_OUT_MS, easing: Easing.in(Easing.quad) }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  }

  const overlayStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - progress.value) * SLIDE_FROM }] }));

  // Preview: the real story card, scaled down to fit small screens too.
  const previewH = Math.min(PREVIEW_MAX_H, Math.round(screenHeight * 0.34));
  const scale = previewH / STORY_CARD_HEIGHT;
  const previewW = Math.round(STORY_CARD_WIDTH * scale);
  const created = variant === 'created';

  return (
    // The dim layer covers the whole screen behind the sheet (no bright edges).
    <Animated.View style={[styles.overlay, overlayStyle]}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={close} accessible={false} />
      <Animated.View style={[styles.sheet, sheetStyle]}>
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        >
          {created && (
            <View style={styles.success}>
              <Ionicons name="checkmark-circle" size={24} color={colors.accentBlue} />
              <Text style={styles.successText}>{t('sparring.shareSheet.success')}</Text>
            </View>
          )}
          <Text style={styles.title} accessibilityRole="header">
            {created ? t('sparring.shareSheet.titleCreated') : t('sparring.shareSheet.titleReshare')}
          </Text>
          <Text style={styles.body}>{t('sparring.shareSheet.body')}</Text>

          <View
            style={[styles.preview, { width: previewW, height: previewH }]}
            accessible
            accessibilityLabel={t('sparring.shareSheet.previewA11y')}
          >
            <View style={[styles.previewInner, { transform: [{ scale }] }]}>
              <SparringStoryCard {...card} />
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            activeOpacity={0.8}
            onPress={() => { void shareImage(); }}
            disabled={sharing}
            accessibilityRole="button"
            accessibilityState={{ busy: sharing }}
          >
            {sharing ? <ActivityIndicator color={colors.card} /> : (
              <>
                <Ionicons name="share-outline" size={20} color={colors.card} />
                <Text style={styles.primaryText}>{t('sparring.shareSheet.share')}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.8}
            onPress={() => { void copyLink(); }}
            accessibilityRole="button"
          >
            <Ionicons name={copied ? 'checkmark' : 'link-outline'} size={20} color={colors.accentBlue} />
            <Text style={styles.secondaryText}>
              {copied ? t('sparring.shareSheet.copied') : t('sparring.shareSheet.copyLink')}
            </Text>
          </TouchableOpacity>
          <Text style={styles.note}>{t('sparring.shareSheet.linkNote')}</Text>

          <TouchableOpacity style={styles.laterBtn} onPress={close} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.laterText}>
              {created ? t('sparring.shareSheet.notNow') : t('sparring.shareSheet.close')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>

      {/* Off-screen full-size story canvas for the image export */}
      <View style={styles.capture} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <ViewShot
          ref={shotRef}
          options={{ format: 'png', quality: 1, result: 'tmpfile', width: STORY_CARD_WIDTH, height: STORY_CARD_HEIGHT }}
        >
          <SparringStoryCard {...card} />
        </ViewShot>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.sheetScrim,
    justifyContent:  'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    maxHeight:            '92%',
    backgroundColor:      colors.card,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    overflow:             'hidden',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop:        24,
    alignItems:        'center',
    gap:               16,
  },
  success: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  successText: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.accentBlue,
  },
  title: {
    fontSize:   22,
    fontWeight: '900',
    color:      colors.text,
    textAlign:  'center',
  },
  body: {
    fontSize:   15,
    lineHeight: 22,
    color:      colors.textMuted,
    textAlign:  'center',
  },
  preview: {
    borderRadius: 16,
    overflow:     'hidden',
    backgroundColor: colors.dark,
  },
  previewInner: {
    width:           STORY_CARD_WIDTH,
    height:          STORY_CARD_HEIGHT,
    transformOrigin: 'top left',
  },
  primaryBtn: {
    width:           '100%',
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    minHeight:       48,
    borderRadius:    16,
    backgroundColor: colors.accentBlue,
  },
  primaryText: {
    fontSize:   16,
    fontWeight: '700',
    color:      colors.card,
  },
  secondaryBtn: {
    width:           '100%',
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    minHeight:       48,
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     colors.border,
    backgroundColor: colors.card,
  },
  secondaryText: {
    fontSize:   16,
    fontWeight: '700',
    color:      colors.text,
  },
  note: {
    fontSize:   13,
    lineHeight: 18,
    color:      colors.textMuted,
    textAlign:  'center',
  },
  laterBtn: {
    minHeight:      44,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  laterText: {
    fontSize:   15,
    fontWeight: '600',
    color:      colors.textMuted,
  },
  capture: {
    position: 'absolute',
    left:     -10000, // off-screen, still rendered for capture
    top:      0,
    width:    STORY_CARD_WIDTH,
    height:   STORY_CARD_HEIGHT,
  },
});
