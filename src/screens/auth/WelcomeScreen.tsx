import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import Animated, { useAnimatedRef, useAnimatedScrollHandler, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import type { AuthStackParamList } from '../../navigation/types';
import { markWelcomeIntroSeen } from '../../lib/welcomeIntro';
import FocusedStatusBar from '../../components/common/FocusedStatusBar';
import SparrLogo from '../../components/common/SparrLogo';
import WelcomeSlide from '../../components/welcome/WelcomeSlide';
import WelcomeFooter from '../../components/welcome/WelcomeFooter';
import { SLIDES } from '../../components/welcome/welcomeSlides';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

// Three-slide product intro for signed-out users who have not seen it yet.
// No auto-advance. Swipe, "Weiter" and the back button (plus Android back)
// move between slides; "Überspringen", "Anmelden" and "Konto erstellen" mark
// it as seen — merely viewing it does not.
export default function WelcomeScreen(): React.ReactElement {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((e) => { scrollX.value = e.contentOffset.x; });
  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const goTo = useCallback((next: number): void => {
    scrollRef.current?.scrollTo({ x: next * width, animated: !reduceMotion });
    setIndex(next);
  }, [scrollRef, width, reduceMotion]);

  // Android back steps back through the slides before leaving the app.
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (index === 0) return false;
      goTo(index - 1);
      return true;
    });
    return () => sub.remove();
  }, [index, goTo]));

  const toLogin = (): void => {
    markWelcomeIntroSeen();
    navigation.replace('Login');
  };
  const toRegister = (): void => {
    markWelcomeIntroSeen();
    // Login stays underneath, so "back" from the registration lands there.
    navigation.reset({ index: 1, routes: [{ name: 'Login' }, { name: 'Register' }] });
  };

  const small = width < 360 || height < 700;
  const illustrationHeight = Math.round(Math.min(380, Math.max(280, height * 0.4)));

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <FocusedStatusBar style="dark" />

      <View style={styles.topBar}>
        <View style={styles.brand} accessible accessibilityRole="header" accessibilityLabel="Sparr">
          <SparrLogo size={32} />
          <Text style={styles.wordmark} maxFontSizeMultiplier={1.3}>Sparr</Text>
        </View>
        <TouchableOpacity style={styles.skip} onPress={toLogin} hitSlop={HIT_SLOP} accessibilityRole="button">
          <Text style={styles.skipText}>{t('auth.welcome.skip')}</Text>
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        style={styles.pager}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumEnd}
        bounces={false}
        overScrollMode="never"
      >
        {SLIDES.map((slide, i) => (
          <WelcomeSlide
            key={slide.key}
            width={width}
            illustrationHeight={illustrationHeight}
            title={t(`auth.welcome.slides.${slide.key}.title` as const)}
            text={t(`auth.welcome.slides.${slide.key}.text`)}
            active={i === index}
            small={small}
            Illustration={slide.Illustration}
          />
        ))}
      </Animated.ScrollView>

      <WelcomeFooter
        count={SLIDES.length}
        index={index}
        scrollX={scrollX}
        pageWidth={width}
        onBack={() => goTo(index - 1)}
        onNext={() => goTo(index + 1)}
        onRegister={toRegister}
        onLogin={toLogin}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 24,
    minHeight:         48,
  },
  brand: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  wordmark: {
    fontSize:      20,
    fontWeight:    '900',
    letterSpacing: -0.4,
    color:         colors.text,
  },
  skip: {
    minHeight:      44,
    justifyContent: 'center',
  },
  skipText: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.accentBlueText,
  },
  pager: {
    flex: 1,
  },
});
