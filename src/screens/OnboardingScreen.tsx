import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Keyboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList } from '../navigation/types';
import { setCached } from '../lib/queryCache';
import { onboardingCacheKey } from '../lib/onboardingCache';
import { colors } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useStudioInvite } from '../hooks/useStudioInvite';
import { useStudio } from '../hooks/useStudio';
import MascotBubble from '../components/onboarding/MascotBubble';
import StepName, { isValidName } from '../components/onboarding/StepName';
import StepRole from '../components/onboarding/StepRole';
import StepGender from '../components/onboarding/StepGender';
import StepAge from '../components/onboarding/StepAge';
import StepWeight from '../components/onboarding/StepWeight';
import StepDiscipline from '../components/onboarding/StepDiscipline';
import StepExperience from '../components/onboarding/StepExperience';
import StepTrainingFrequency from '../components/onboarding/StepTrainingFrequency';
import StepInviteCode from '../components/onboarding/StepInviteCode';
import type { Gender } from '../components/onboarding/StepGender';
import type { Role } from '../components/onboarding/StepRole';
import type { TrainingSince } from '../components/onboarding/StepExperience';
import type { FrequencyTier } from '../components/onboarding/StepTrainingFrequency';
import type { Discipline } from '../data/disciplines';

const MASCOT = {
  winken:      require('../../assets/coach/winken.png'),
  neugierig:   require('../../assets/coach/neugierig.png'),
  imperativ:   require('../../assets/coach/imperativ.png'),
  sprechend3:  require('../../assets/coach/sprechend3.png'),
  fragend:     require('../../assets/coach/fragend.png'),
  sprechend1:  require('../../assets/coach/sprechend1.png'),
  sprechend2:  require('../../assets/coach/sprechend2.png'),
  sprechend1b: require('../../assets/coach/sprechend1.png'),
  einladend:   require('../../assets/coach/einladend.png'),
} as const;

type StepId = 'name' | 'role' | 'discipline' | 'experience' | 'gender' | 'age' | 'weight' | 'frequency' | 'invitecode';

interface StepConfig {
  id: StepId;
  mascotImage: keyof typeof MASCOT;
  bubbleText: `onboarding.steps.${StepId}`;
  canSkip?: boolean;
  coachOnly?: boolean;
}

const ALL_STEPS: StepConfig[] = [
  {
    id: 'name',
    mascotImage: 'neugierig',
    bubbleText: 'onboarding.steps.name',
  },
  {
    id: 'role',
    mascotImage: 'fragend',
    bubbleText: 'onboarding.steps.role',
  },
  {
    id: 'discipline',
    mascotImage: 'imperativ',
    bubbleText: 'onboarding.steps.discipline',
  },
  {
    id: 'experience',
    mascotImage: 'sprechend3',
    bubbleText: 'onboarding.steps.experience',
  },
  {
    id: 'gender',
    mascotImage: 'fragend',
    bubbleText: 'onboarding.steps.gender',
  },
  {
    id: 'age',
    mascotImage: 'sprechend1',
    bubbleText: 'onboarding.steps.age',
  },
  {
    id: 'weight',
    mascotImage: 'sprechend2',
    bubbleText: 'onboarding.steps.weight',
    canSkip: true,
  },
  {
    id: 'frequency',
    mascotImage: 'sprechend1b',
    bubbleText: 'onboarding.steps.frequency',
  },
  {
    id: 'invitecode',
    mascotImage: 'winken',
    bubbleText: 'onboarding.steps.invitecode',
    canSkip: true,
  },
];

const WELCOME_MASCOT: keyof typeof MASCOT = 'winken';

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { acceptInvite } = useStudioInvite();
  const { requestJoin } = useStudio();

  const [stepIndex, setStepIndex] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName]               = useState('');
  // Prefill from Google/Apple sign-in metadata, so a social login is never
  // asked to type its name again (Apple sends it only once, slightly later).
  const meta = user?.user_metadata as { full_name?: unknown; name?: unknown } | undefined;
  const providerName = typeof meta?.full_name === 'string' ? meta.full_name
    : typeof meta?.name === 'string' ? meta.name : '';
  useEffect(() => {
    if (providerName.trim().length > 0) setName((current) => (current === '' ? providerName.trim() : current));
  }, [providerName]);
  const [role, setRole]               = useState<Role | null>(null);
  const [gender, setGender]           = useState<Gender | null>(null);
  const [age, setAge]                 = useState<number | null>(null);
  const [weight, setWeight]           = useState('');
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [experience, setExperience]   = useState<TrainingSince | null>(null);
  const [frequency, setFrequency]     = useState<FrequencyTier | null>(null);
  const [inviteCode, setInviteCode]   = useState('');

  const STEPS = useMemo(
    () => ALL_STEPS.filter((s) => !s.coachOnly || role === 'coach'),
    [role],
  );

  const contentTranslateX = useRef(new Animated.Value(0)).current;
  const contentOpacity    = useRef(new Animated.Value(1)).current;
  const buttonScale       = useRef(new Animated.Value(1)).current;
  const directionRef      = useRef<'forward' | 'back'>('forward');
  const prevCanContinue   = useRef(false);

  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide  = Keyboard.addListener('keyboardDidHide',  () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    const startX = directionRef.current === 'forward' ? 40 : -40;
    contentTranslateX.setValue(startX);
    contentOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(contentTranslateX, {
        toValue: 0,
        tension: 300,
        friction: 28,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start();
  }, [stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const isWelcome   = stepIndex === -1;
  const currentStep = isWelcome ? null : STEPS[stepIndex];
  const mascotKey   = isWelcome ? WELCOME_MASCOT : currentStep!.mascotImage;
  const bubbleText  = isWelcome ? t('onboarding.welcome') : t(currentStep!.bubbleText);
  const animationKey = stepIndex;

  const canContinue = (): boolean => {
    if (isWelcome) return true;
    switch (currentStep!.id) {
      case 'name':        return isValidName(name);
      case 'role':        return role !== null;
      case 'gender':      return gender !== null;
      case 'age':         return age !== null;
      case 'weight':      return true;
      case 'discipline':  return disciplines.length > 0;
      case 'experience':  return experience !== null;
      case 'frequency':   return frequency !== null;
      case 'invitecode':  return true;
    }
  };

  const isReady = canContinue();

  useEffect(() => {
    if (isReady && !prevCanContinue.current && !isWelcome) {
      Animated.sequence([
        Animated.spring(buttonScale, { toValue: 1.04, tension: 200, friction: 5, useNativeDriver: true }),
        Animated.spring(buttonScale, { toValue: 1.0,  tension: 200, friction: 5, useNativeDriver: true }),
      ]).start();
    }
    prevCanContinue.current = isReady;
  }, [isReady, isWelcome]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);

    const weightNum = weight.trim() !== '' ? parseFloat(weight) : null;

    const profileUpdate: Record<string, unknown> = {
      name: name.trim(),
      gender,
      age_years: age,
      training_since: experience,
      disciplines,
      onboarding_completed: true,
      training_frequency: frequency ?? 'low',
    };

    const { error: profileErr } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', user.id);

    if (profileErr) {
      setSaving(false);
      setError(t('onboarding.errorSave'));
      return;
    }

    // Prime the onboarding cache so the next cold start unblocks instantly
    // instead of waiting on the network check in RootNavigator.
    setCached<boolean>(onboardingCacheKey(user.id), true);

    if (weightNum !== null && !isNaN(weightNum)) {
      const today = new Date();
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(today.setDate(diff));
      const weekStart = monday.toISOString().split('T')[0];

      const { error: weightErr } = await supabase.from('weight_logs').insert({
        user_id: user.id,
        week_start: weekStart,
        weight_kg: weightNum,
      });
      if (weightErr !== null) console.warn('weight_logs insert failed', weightErr.message);
    }

    setSaving(false);
    navigation.replace('Tabs');
  };

  const handleNext = async () => {
    if (!isReady) return;

    const isLastStep = stepIndex === STEPS.length - 1;

    if (isLastStep) {
      if (currentStep?.id === 'invitecode' && inviteCode.trim().length > 0) {
        setSaving(true);
        const { error: inviteErr, studioId } = await acceptInvite(inviteCode.trim());
        if (inviteErr !== null) {
          setSaving(false);
          setError(t('onboarding.errorInvite'));
          return;
        }
        if (studioId !== null) await requestJoin(studioId);
        setSaving(false);
      }
      await handleFinish();
    } else {
      setError(null);
      directionRef.current = 'forward';
      setStepIndex((i) => i + 1);
    }
  };

  const handleWeightSkip = () => {
    setWeight('');
    directionRef.current = 'forward';
    setStepIndex((i) => i + 1);
  };

  const handleInviteSkip = () => {
    setInviteCode('');
    void handleFinish();
  };

  const handleBack = () => {
    setError(null);
    directionRef.current = 'back';
    setStepIndex((i) => i - 1);
  };

  const progress = isWelcome ? 0 : (stepIndex + 1) / STEPS.length;

  const buttonLabel = isWelcome
    ? t('onboarding.start')
    : stepIndex === STEPS.length - 1
    ? t('common.done')
    : t('common.next');

  return (
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <SafeAreaView style={styles.flex}>
        <View style={styles.headerRow}>
          {stepIndex >= 0 ? (
            <TouchableOpacity style={styles.backBtn} onPress={handleBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
          ) : (
            <View style={styles.backPlaceholder} />
          )}
          {!isWelcome && (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
          )}
        </View>

        <Animated.View
          style={[
            styles.contentAnimWrapper,
            {
              transform: [{ translateX: contentTranslateX }],
              opacity: contentOpacity,
            },
          ]}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.mascotArea, keyboardVisible && styles.mascotAreaHidden]}>
              <MascotBubble
                image={MASCOT[mascotKey]}
                text={bubbleText}
                stepKey={animationKey}
              />
            </View>

            <View style={styles.stepContent}>
              {!isWelcome && currentStep?.id === 'name' && (
                <StepName value={name} onChange={setName} />
              )}
              {!isWelcome && currentStep?.id === 'role' && (
                <StepRole value={role} onChange={setRole} />
              )}
              {!isWelcome && currentStep?.id === 'gender' && (
                <StepGender value={gender} onChange={setGender} />
              )}
              {!isWelcome && currentStep?.id === 'age' && (
                <StepAge value={age} onChange={setAge} />
              )}
              {!isWelcome && currentStep?.id === 'weight' && (
                <StepWeight value={weight} onChange={setWeight} onSkip={handleWeightSkip} />
              )}
              {!isWelcome && currentStep?.id === 'discipline' && (
                <StepDiscipline value={disciplines} onChange={setDisciplines} />
              )}
              {!isWelcome && currentStep?.id === 'experience' && (
                <StepExperience value={experience} onChange={setExperience} />
              )}
              {!isWelcome && currentStep?.id === 'frequency' && (
                <StepTrainingFrequency value={frequency} onChange={setFrequency} />
              )}
              {!isWelcome && currentStep?.id === 'invitecode' && (
                <StepInviteCode value={inviteCode} onChange={setInviteCode} onSkip={handleInviteSkip} />
              )}
            </View>

            {error !== null && (
              <Text style={styles.errorText}>{error}</Text>
            )}
          </ScrollView>
        </Animated.View>

        <View style={styles.footer}>
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity
              style={[styles.btn, !isReady && styles.btnDisabled]}
              onPress={handleNext}
              disabled={saving || !isReady}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color={colors.card} />
              ) : (
                <Text style={styles.btnText}>{buttonLabel}</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
    minHeight: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPlaceholder: {
    width: 40,
  },
  progressTrack: {
    flex: 1,
    height: 5,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginLeft: 8,
  },
  progressFill: {
    height: 5,
    backgroundColor: colors.accentBlue,
    borderRadius: 2,
  },
  mascotArea: {
    alignItems: 'center',
    paddingTop: 8,
  },
  mascotAreaHidden: {
    display: 'none',
  },
  contentAnimWrapper: {
    flex: 1,
  },
  scroll: {
    paddingBottom: 16,
  },
  stepContent: {
    paddingTop: 30,
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 13,
    color: colors.deleteRed,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 8 : 24,
    paddingTop: 16,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  btn: {
    backgroundColor: colors.text,
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.35,
  },
  btnText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: '700',
  },
});
