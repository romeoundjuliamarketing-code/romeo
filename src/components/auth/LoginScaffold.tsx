import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import FocusedStatusBar from '../common/FocusedStatusBar';
import SparrLogo from '../common/SparrLogo';
import LoginBackdrop, { LoginDotGrid } from './LoginBackdrop';
import { colors } from '../../theme/colors';

interface ScaffoldProps {
  // Headline in two parts; the second one is set in brand blue.
  titleLead:   string;
  titleAccent: string;
  subtitle:    string;
  children:    React.ReactNode;
}

const LOGO_SIZE = 48;
const HEADLINE_DELAY_MS = 120;
const HEADLINE_MS = 400;
const HEADLINE_RISE_PX = 10;
const FORM_DELAY_MS = 240;
const FORM_MS = 500;
const FORM_RISE_PX = 48;
// Blue surface reaches this far below the subtitle before it has faded out.
const SURFACE_FADE_PX = 72;
const SMALL_SCREEN_WIDTH = 360;

// Login frame: blue backdrop with ring corner, penguin + wordmark, two-tone
// headline and the form as one block below. Entrance plays once per mount:
// backdrop and logo, then the headline, then the whole form slides up as a
// unit. Inputs are usable immediately; nothing replays on typing or errors.
export default function LoginScaffold({ titleLead, titleAccent, subtitle, children }: ScaffoldProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [brandBottom, setBrandBottom] = useState<number | null>(null);

  const logo = useSharedValue(0);
  const headline = useSharedValue(0);
  const form = useSharedValue(0);
  const tilt = useSharedValue(0);

  // Empty deps on purpose: plays once per mount.
  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    logo.value = withTiming(1, { duration: 320, easing: ease });
    headline.value = withDelay(HEADLINE_DELAY_MS, withTiming(1, { duration: HEADLINE_MS, easing: ease }));
    form.value = withDelay(FORM_DELAY_MS, withTiming(1, { duration: FORM_MS, easing: ease }));
    return () => {
      cancelAnimation(logo);
      cancelAnimation(headline);
      cancelAnimation(form);
      cancelAnimation(tilt);
    };
  }, [logo, headline, form, tilt]);

  const logoStyle = useAnimatedStyle(() => ({ opacity: logo.value }));
  const headlineStyle = useAnimatedStyle(() => ({
    opacity: headline.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - headline.value) * HEADLINE_RISE_PX }],
  }));
  const formStyle = useAnimatedStyle(() => ({
    opacity: form.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - form.value) * FORM_RISE_PX }],
  }));
  const tiltStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${tilt.value}deg` }] }));

  // Small sideways tip, then springs back. Purely playful, no function.
  const onPenguinPress = (): void => {
    if (reduceMotion) return;
    tilt.value = withSequence(
      withTiming(-8, { duration: 110, easing: Easing.out(Easing.quad) }),
      withSpring(0, { damping: 7, stiffness: 220 }),
    );
  };

  // Measured once; only sizes the static backdrop.
  const onBrandLayout = (e: LayoutChangeEvent): void => {
    const { y, height } = e.nativeEvent.layout;
    const bottom = Math.round(y + height);
    setBrandBottom((prev) => (prev === bottom ? prev : bottom));
  };

  const small = width < SMALL_SCREEN_WIDTH;
  const top = insets.top + 16;
  // brandBottom is relative to the padded content, hence + top.
  const surfaceHeight = top + (brandBottom ?? 280) + SURFACE_FADE_PX;

  return (
    <View style={styles.root}>
      <FocusedStatusBar style="dark" />
      <LoginDotGrid bottom={insets.bottom + 16} />
      <KeyboardAvoidingView
        style={styles.flex}
        // Edge-to-edge (SDK 55): the window no longer resizes for the keyboard
        // on Android either, so both platforms need padding.
        behavior="padding"
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { paddingTop: top, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          // No bounce: pulling down would open a seam above the blue surface.
          bounces={false}
          overScrollMode="never"
        >
          <LoginBackdrop width={width} top={insets.top + 4} height={surfaceHeight} />
          <View style={styles.inner}>
            <View style={styles.brandBlock} onLayout={onBrandLayout}>
              <Animated.View style={logoStyle}>
                <View style={styles.logoRow} accessible accessibilityRole="header" accessibilityLabel="Sparr">
                  <Pressable onPress={onPenguinPress} hitSlop={8} accessible={false}>
                    <Animated.View style={tiltStyle}>
                      <SparrLogo size={LOGO_SIZE} />
                    </Animated.View>
                  </Pressable>
                  <Text style={styles.wordmark} maxFontSizeMultiplier={1.3}>Sparr</Text>
                </View>
              </Animated.View>
              <Animated.View style={[styles.headlineBlock, headlineStyle]}>
                <Text
                  style={[styles.title, small && styles.titleSmall]}
                  accessibilityRole="header"
                  maxFontSizeMultiplier={1.3}
                >
                  {titleLead}
                  {'\n'}
                  <Text style={styles.titleAccent}>{titleAccent}</Text>
                </Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
              </Animated.View>
            </View>

            <Animated.View style={[styles.form, formStyle]}>{children}</Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// Form-level message that belongs to no single field (e.g. wrong credentials).
export function LoginNotice({ text, tone }: { text: string; tone: 'error' | 'info' }): React.ReactElement {
  const isError = tone === 'error';
  return (
    <View style={[styles.notice, isError ? styles.noticeError : styles.noticeInfo]} accessibilityLiveRegion="polite">
      <Ionicons
        name={isError ? 'alert-circle' : 'mail-outline'}
        size={16}
        color={isError ? colors.deleteRed : colors.accentBlueText}
      />
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

// "Neu bei Sparr? Registrieren" row below the button.
export function LoginSwitch({ text, link, onPress }: { text: string; link: string; onPress: () => void }): React.ReactElement {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchText}>{text}</Text>
      <TouchableOpacity
        style={styles.switchTouch}
        onPress={onPress}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
      >
        <Text style={styles.switchLink}>{link}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow:          1,
    paddingHorizontal: 24,
  },
  inner: {
    width:     '100%',
    maxWidth:  480,
    alignSelf: 'center',
    gap:       32,
  },
  brandBlock: {
    gap: 32,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems:    'center',
    alignSelf:     'flex-start',
    gap:           8,
    minHeight:     56,
  },
  wordmark: {
    fontSize:      26,
    fontWeight:    '900',
    letterSpacing: -0.5,
    color:         colors.text,
  },
  headlineBlock: {
    gap: 8,
  },
  title: {
    fontSize:      38,
    lineHeight:    42,
    fontWeight:    '900',
    letterSpacing: -1,
    color:         colors.text,
  },
  titleSmall: {
    fontSize:   32,
    lineHeight: 36,
  },
  titleAccent: {
    color: colors.accentBlueText,
  },
  subtitle: {
    fontSize:   16,
    lineHeight: 24,
    color:      colors.textMuted,
  },
  form: {
    gap: 16,
  },
  notice: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           8,
    padding:       16,
    borderRadius:  16,
  },
  noticeError: {
    backgroundColor: colors.deleteRedSoft,
  },
  noticeInfo: {
    backgroundColor: colors.accentBlueSoft,
  },
  noticeText: {
    flex:       1,
    fontSize:   14,
    lineHeight: 20,
    color:      colors.text,
  },
  switchRow: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    justifyContent: 'center',
    alignItems:     'center',
    gap:            8,
  },
  switchTouch: {
    minHeight:      44,
    justifyContent: 'center',
  },
  switchText: {
    fontSize: 15,
    color:    colors.textMuted,
  },
  switchLink: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.accentBlueText,
  },
});
