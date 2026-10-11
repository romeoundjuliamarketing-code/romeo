import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, BackHandler, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import IntroCardStep from '../components/intro/IntroCardStep';
import IntroSparringStep from '../components/intro/IntroSparringStep';
import { useIntroSparring } from '../hooks/useIntroSparring';
import type { IntroStep } from '../utils/intro';
import type { RootStackParamList } from '../navigation/types';

/** Where the app opens once the intro ends. */
export type IntroExit =
  | { kind: 'sparring'; id: string }
  | { kind: 'search' };

const ENTER = FadeIn.duration(180);
// A double tap moves one step, not two.
const MOVE_LOCK_MS = 400;

// The optional intro (steps 3 and 4 of the flow). The sparring search runs
// from the card step on, so step 4 usually has its answer at once. Every way
// out (main action, "Später") ends in the real sparring search or detail,
// never unannounced on Home.
export function IntroFlow({ initialStep, onStepChange, onBackFromFirst, onExit }: {
  initialStep:      IntroStep;
  /** Saves the step (first run only). */
  onStepChange?:    (step: IntroStep) => void;
  /** Back from the card step; hidden when undefined. */
  onBackFromFirst?: () => void;
  onExit:           (exit: IntroExit, result: 'completed' | 'skipped') => void;
}): React.ReactElement {
  const [step, setStep] = useState<IntroStep>(initialStep);
  const { state: search, retry } = useIntroSparring();
  const lastMove = useRef(0);
  const exited = useRef(false);

  const allowed = (): boolean => {
    const now = Date.now();
    if (exited.current || now - lastMove.current < MOVE_LOCK_MS) return false;
    lastMove.current = now;
    return true;
  };

  const go = useCallback((next: IntroStep): void => {
    if (!allowed()) return;
    setStep(next);
    onStepChange?.(next);
  }, [onStepChange]);

  const exit = useCallback((target: IntroExit, result: 'completed' | 'skipped'): void => {
    if (!allowed()) return;
    exited.current = true;
    onExit(target, result);
  }, [onExit]);

  const back = useCallback((): void => {
    if (step === 1) go(0);
    else if (onBackFromFirst !== undefined && allowed()) onBackFromFirst();
  }, [step, go, onBackFromFirst]);

  // Android back: one step back; on the card step only where back is offered.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 1 || onBackFromFirst !== undefined) {
        back();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step, back, onBackFromFirst]);

  const later = (): void => exit({ kind: 'search' }, 'skipped');

  return (
    <View style={styles.root}>
      {step === 0 ? (
        <Animated.View key="card" style={styles.root} entering={ENTER}>
          <IntroCardStep onNext={() => go(1)} onBack={onBackFromFirst !== undefined ? back : undefined} onLater={later} />
        </Animated.View>
      ) : (
        <Animated.View key="sparring" style={styles.root} entering={ENTER}>
          <IntroSparringStep
            search={search}
            onRetry={retry}
            onOpenSparring={(id) => exit({ kind: 'sparring', id }, 'completed')}
            onOpenSearch={() => exit({ kind: 'search' }, 'completed')}
            onBack={back}
            onLater={later}
          />
        </Animated.View>
      )}
    </View>
  );
}

// Replay from the settings: the same two steps as a full-screen page in the
// app. Nothing of the setup (name, birth date, place) is touched and no
// progress is saved; the main actions open the real search or the chosen
// sparring, "Später" returns to the settings.
export default function IntroReplayScreen(): React.ReactElement {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const onExit = useCallback((target: IntroExit, result: 'completed' | 'skipped'): void => {
    // "Später" on a replay simply closes it again (back to the settings).
    if (result === 'skipped') {
      navigation.goBack();
      return;
    }
    // Navigating to the tabs closes this page (and the settings) on the way.
    if (target.kind === 'sparring') {
      navigation.navigate('Tabs', { screen: 'Sparring', params: { focusSparringId: target.id, focusFromIntro: true, introHint: true } });
    } else {
      navigation.navigate('Tabs', { screen: 'Sparring', params: { searchEntryAt: Date.now(), introHint: true } });
    }
  }, [navigation]);
  return <IntroFlow initialStep={0} onBackFromFirst={() => navigation.goBack()} onExit={onExit} />;
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: colors.background,
  },
});
