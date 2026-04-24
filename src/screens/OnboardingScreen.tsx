import React, { useState } from 'react';
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
  Image,
  Dimensions,
} from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');
const PRELOAD_SIZE = Math.round(SCREEN_W * 0.88);
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useStudioInvite } from '../hooks/useStudioInvite';
import { useStudio } from '../hooks/useStudio';
import MascotBubble from '../components/onboarding/MascotBubble';
import StepName from '../components/onboarding/StepName';
import StepGender from '../components/onboarding/StepGender';
import StepAge from '../components/onboarding/StepAge';
import StepWeight from '../components/onboarding/StepWeight';
import StepDiscipline from '../components/onboarding/StepDiscipline';
import StepExperience from '../components/onboarding/StepExperience';
import StepTrainingFrequency from '../components/onboarding/StepTrainingFrequency';
import StepInviteCode from '../components/onboarding/StepInviteCode';
import type { Gender } from '../components/onboarding/StepGender';
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

type StepId = 'name' | 'discipline' | 'experience' | 'gender' | 'age' | 'weight' | 'frequency' | 'invitecode';

interface StepConfig {
  id: StepId;
  mascotImage: keyof typeof MASCOT;
  bubbleText: string;
  canSkip?: boolean;
}

const STEPS: StepConfig[] = [
  {
    id: 'name',
    mascotImage: 'neugierig',
    bubbleText: 'Wie heisst du?',
  },
  {
    id: 'discipline',
    mascotImage: 'imperativ',
    bubbleText: 'Welche Kampfsportarten trainierst du?',
  },
  {
    id: 'experience',
    mascotImage: 'sprechend3',
    bubbleText: 'Wie lange trainierst du schon aktiv?',
  },
  {
    id: 'gender',
    mascotImage: 'fragend',
    bubbleText: 'Bist du männlich, weiblich oder divers?',
  },
  {
    id: 'age',
    mascotImage: 'sprechend1',
    bubbleText: 'Wie alt bist du?',
  },
  {
    id: 'weight',
    mascotImage: 'sprechend2',
    bubbleText: 'Wie viel wiegst du aktuell?',
    canSkip: true,
  },
  {
    id: 'frequency',
    mascotImage: 'sprechend1b',
    bubbleText: 'Wie oft trainierst du pro Woche?',
  },
  {
    id: 'invitecode',
    mascotImage: 'einladend',
    bubbleText: 'Bist du Teil eines Studios? Gib deinen Einladungscode ein.',
    canSkip: true,
  },
];

const WELCOME_MASCOT: keyof typeof MASCOT = 'winken';
const WELCOME_TEXT = 'Hey! Ich bin dein Coach. Ich stelle dir kurz ein paar Fragen, damit ich dich besser kenne.';

export default function OnboardingScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { acceptInvite } = useStudioInvite();
  const { joinStudio } = useStudio();

  const [stepIndex, setStepIndex] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName]               = useState('');
  const [gender, setGender]           = useState<Gender | null>(null);
  const [age, setAge]                 = useState<number | null>(null);
  const [weight, setWeight]           = useState('');
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [experience, setExperience]   = useState<TrainingSince | null>(null);
  const [frequency, setFrequency]     = useState<FrequencyTier | null>(null);
  const [inviteCode, setInviteCode]   = useState('');

  const isWelcome   = stepIndex === -1;
  const currentStep = isWelcome ? null : STEPS[stepIndex];
  const mascotKey   = isWelcome ? WELCOME_MASCOT : currentStep!.mascotImage;
  const bubbleText  = isWelcome ? WELCOME_TEXT   : currentStep!.bubbleText;
  const animationKey = stepIndex;

  const canContinue = (): boolean => {
    if (isWelcome) return true;
    switch (currentStep!.id) {
      case 'name':        return name.trim().length > 0;
      case 'gender':      return gender !== null;
      case 'age':         return age !== null;
      case 'weight':      return true;
      case 'discipline':  return disciplines.length > 0;
      case 'experience':  return experience !== null;
      case 'frequency':   return frequency !== null;
      case 'invitecode':  return true;
    }
  };

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
      setError('Speichern fehlgeschlagen. Bitte versuche es nochmal.');
      return;
    }

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
    if (!canContinue()) return;

    const isLastStep = stepIndex === STEPS.length - 1;

    if (isLastStep) {
      if (currentStep?.id === 'invitecode' && inviteCode.trim().length > 0) {
        setSaving(true);
        const { error: inviteErr, studioId } = await acceptInvite(inviteCode.trim());
        if (inviteErr !== null) {
          setSaving(false);
          setError('Ungültiger Code. Bitte prüfe den Code und versuche es erneut.');
          return;
        }
        if (studioId !== null) await joinStudio(studioId);
        setSaving(false);
      }
      await handleFinish();
    } else {
      setError(null);
      setStepIndex((i) => i + 1);
    }
  };

  const handleWeightSkip = () => {
    setWeight('');
    setStepIndex((i) => i + 1);
  };

  const handleInviteSkip = () => {
    setInviteCode('');
    void handleFinish();
  };

  const handleBack = () => {
    setError(null);
    setStepIndex((i) => i - 1);
  };

  const progress = isWelcome ? 0 : (stepIndex + 1) / STEPS.length;

  const buttonLabel = isWelcome
    ? 'Los geht\'s'
    : stepIndex === STEPS.length - 1
    ? 'Fertig'
    : 'Weiter';

  return (
    <SafeAreaView style={styles.safe}>
      {/* Preload all mascot images so PNG decode happens before user reaches each step */}
      <View style={styles.preloader}>
        {(Object.values(MASCOT) as number[]).map((src, i) => (
          <Image key={i} source={src} style={styles.preloadImg} />
        ))}
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
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

        <View style={styles.mascotArea}>
          <MascotBubble
            image={MASCOT[mascotKey]}
            text={bubbleText}
            stepKey={animationKey}
          />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.stepContent}>
            {!isWelcome && currentStep?.id === 'name' && (
              <StepName value={name} onChange={setName} />
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

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.btn, !canContinue() && styles.btnDisabled]}
            onPress={handleNext}
            disabled={saving || !canContinue()}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.btnText}>{buttonLabel}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  preloader: {
    position: 'absolute',
    left: -10000,
  },
  preloadImg: {
    width: PRELOAD_SIZE,
    height: PRELOAD_SIZE,
  },
  flex: {
    flex: 1,
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
    height: 3,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginLeft: 8,
  },
  progressFill: {
    height: 3,
    backgroundColor: colors.text,
    borderRadius: 2,
  },
  mascotArea: {
    alignItems: 'center',
    paddingTop: 8,
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
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
