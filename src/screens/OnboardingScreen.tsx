import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { colors } from '../theme/colors';
import { supabase } from '../lib/supabase';
import StepProfile from '../components/onboarding/StepProfile';
import StepLocation from '../components/onboarding/StepLocation';
import { TextAction } from '../components/common/TextAction';
import type { SaveProfileResult } from '../hooks/useOnboardingGate';
import type { CalendarDate, OnboardingRoute, OnboardingState } from '../utils/onboarding';

const ENTER = FadeIn.duration(180);

function parseIsoDate(iso: string): CalendarDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m === null ? null : { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

// Onboarding after sign-up, outside the app navigator (no app behind it).
// The drafts live here, so going back from step 2 keeps what was entered.
export default function OnboardingScreen({ userId, route, state, fallbackName, onSaveProfile, onComplete, onBackToProfile, onSignOut }: {
  userId:          string;
  route:           Exclude<OnboardingRoute, 'done'>;
  state:           OnboardingState;
  /** Name from the sign-in provider (Apple / Google), if the profile has none. */
  fallbackName:    string | null;
  onSaveProfile:   (name: string, birthDateIso: string) => Promise<SaveProfileResult>;
  onComplete:      () => Promise<boolean>;
  onBackToProfile: () => void;
  onSignOut:       () => void;
}): React.ReactElement {
  const [name, setName] = useState(state.name ?? fallbackName ?? '');
  const [birth, setBirth] = useState<CalendarDate | null>(null);

  // A stored birth date (e.g. back from step 2 after a restart) is shown again
  // instead of being asked a second time. Only the owner can read it.
  useEffect(() => {
    if (!state.has_birth_date || birth !== null) return;
    let cancelled = false;
    void supabase.from('profile_private').select('birth_date').eq('id', userId).maybeSingle()
      .then(({ data }) => {
        const parsed = data !== null ? parseIsoDate(data.birth_date) : null;
        if (!cancelled && parsed !== null) setBirth((b) => b ?? parsed);
      });
    return () => { cancelled = true; };
  }, [state.has_birth_date, userId]);

  // Existing accounts only catch up on step 1.
  const total = state.onboarding_completed ? 1 : 2;

  return (
    <View style={styles.root}>
      {route === 'profile' ? (
        <Animated.View key="profile" style={styles.root} entering={ENTER}>
          <StepProfile
            step={1}
            total={total}
            name={name}
            birth={birth}
            onNameChange={setName}
            onBirthChange={setBirth}
            onSubmit={onSaveProfile}
            onSignOut={onSignOut}
          />
        </Animated.View>
      ) : (
        <Animated.View key="location" style={styles.root} entering={ENTER}>
          <StepLocation onBack={onBackToProfile} onComplete={onComplete} onSignOut={onSignOut} />
        </Animated.View>
      )}
    </View>
  );
}

// Dev-only (EXPO_PUBLIC_PREVIEW_ONBOARDING=1): both steps without an account,
// nothing is written. Step 2 "finishing" fails on purpose, so it stays visible.
export function OnboardingPreview(): React.ReactElement {
  const [route, setRoute] = useState<Exclude<OnboardingRoute, 'done'>>('profile');
  const state: OnboardingState = { name: null, has_birth_date: false, onboarding_completed: false };
  return (
    <OnboardingScreen
      userId="preview"
      route={route}
      state={state}
      fallbackName={null}
      onSaveProfile={async () => { setRoute('location'); return { ok: true }; }}
      onComplete={async () => false}
      onBackToProfile={() => setRoute('profile')}
      onSignOut={() => setRoute('profile')}
    />
  );
}

// Profile state could not be loaded and nothing is cached: retry or sign out,
// never guess (a guess could skip the age check or flash the app).
export function OnboardingGateError({ onRetry, onSignOut }: {
  onRetry:   () => void;
  onSignOut: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.center}>
      <Text style={styles.errorText} accessibilityRole="alert">{t('onboarding.gateError')}</Text>
      <TextAction label={t('common.retry')} icon="refresh" onPress={onRetry} />
      <TextAction label={t('onboarding.signOut')} onPress={onSignOut} />
    </View>
  );
}

export function OnboardingLoading(): React.ReactElement {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.accentBlue} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: colors.background,
  },
  center: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    gap:               16,
    paddingHorizontal: 24,
    backgroundColor:   colors.background,
  },
  errorText: {
    fontSize:   16,
    lineHeight: 24,
    color:      colors.text,
    textAlign:  'center',
  },
});
