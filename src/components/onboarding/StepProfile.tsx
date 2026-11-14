import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Keyboard, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { CoachPrimaryButton } from '../coach/CoachAnswerButtons';
import AuthTextField from '../auth/AuthTextField';
import BirthDateField from './BirthDateField';
import OnboardingShell from './OnboardingShell';
import { SCENE_WELCOME } from './onboardingScenes';
import {
  NAME_MAX_LENGTH, calendarDateOf, checkBirthDate, checkName, toIsoDate, type CalendarDate,
} from '../../utils/onboarding';
import type { SaveProfileResult } from '../../hooks/useOnboardingGate';
import GenderPicker from '../common/GenderPicker';
import type { Gender } from '../../utils/gender';

// Hides the coach while the keyboard is up, so field and button stay visible.
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, () => setOpen(true));
    const hide = Keyboard.addListener(hideEvt, () => setOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return open;
}

// Step 1: name, birth date and gender. All required; the age limit is checked
// here exactly (local calendar day) and again on the server. Gender is only
// asked while the profile has none (it is locked once set).
export default function StepProfile({ step, total, name, birth, gender, askGender, onNameChange, onBirthChange, onGenderChange, onSubmit, onSignOut }: {
  step:          number;
  total:         number;
  name:          string;
  birth:         CalendarDate | null;
  gender:        Gender | null;
  /** False when the profile already has a gender (then it is not asked again). */
  askGender:     boolean;
  onNameChange:  (next: string) => void;
  onBirthChange: (next: CalendarDate) => void;
  onGenderChange: (next: Gender) => void;
  onSubmit:      (name: string, birthDateIso: string, gender: Gender | null) => Promise<SaveProfileResult>;
  onSignOut:     () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const keyboardOpen = useKeyboardOpen();
  const [nameError, setNameError] = useState<string | null>(null);
  const [birthError, setBirthError] = useState<string | null>(null);
  const [genderError, setGenderError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  async function submit(): Promise<void> {
    if (savingRef.current) return;
    Keyboard.dismiss();
    setFormError(null);
    const nameCheck = checkName(name);
    const birthCheck = checkBirthDate(birth, calendarDateOf(new Date()));
    const nextNameError = nameCheck.ok ? null
      : nameCheck.reason === 'empty' ? t('onboarding.profile.nameEmpty')
        : t('onboarding.profile.nameTooLong', { max: NAME_MAX_LENGTH });
    const nextBirthError = birthCheck === 'ok' ? null
      : birth === null ? t('onboarding.profile.birthMissing')
        : birthCheck === 'future' ? t('onboarding.profile.birthFuture')
          : birthCheck === 'underage' ? t('onboarding.profile.underage')
            : t('onboarding.profile.birthInvalid');
    const genderMissing = askGender && gender === null;
    setNameError(nextNameError);
    setBirthError(nextBirthError);
    setGenderError(genderMissing ? t('common.gender.missing') : null);
    if (!nameCheck.ok || birthCheck !== 'ok' || birth === null || genderMissing) return;

    savingRef.current = true;
    setSaving(true);
    const result = await onSubmit(nameCheck.name, toIsoDate(birth), askGender ? gender : null);
    savingRef.current = false;
    setSaving(false);
    if (result.ok) return;
    if (result.error === 'underage') setBirthError(t('onboarding.profile.underage'));
    else if (result.error === 'invalidBirthDate') setBirthError(t('onboarding.profile.birthInvalid'));
    else if (result.error === 'invalidName') setNameError(t('onboarding.profile.nameEmpty'));
    else if (result.error === 'contentFilter') setNameError(t('onboarding.profile.nameBlocked'));
    else setFormError(t('onboarding.profile.saveFailed'));
  }

  // Edge to edge (the ropes run off both sides), never cropped, only scaled:
  // as large as the space above the fields allows, so everything below stays
  // visible above the pinned button; below the minimum the page scrolls.
  function heroSize(room: number | null): { width: number; height: number } {
    const natural = width / SCENE_WELCOME.ratio;
    const limit = room ?? height * HERO_START_SHARE;
    const h = Math.max(HERO_MIN_HEIGHT, Math.min(natural, limit));
    return { width: h * SCENE_WELCOME.ratio, height: h };
  }

  return (
    <OnboardingShell
      step={step}
      total={total}
      onSignOut={onSignOut}
      renderHero={(room) => (keyboardOpen ? null : (
        <Animated.Image
          entering={FADE_IN}
          exiting={FADE_OUT}
          source={SCENE_WELCOME.source}
          style={[styles.hero, heroSize(room)]}
          resizeMode="contain"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        />
      ))}
      footer={(
        <>
          {formError !== null && (
            <Text style={styles.formError} accessibilityLiveRegion="polite" accessibilityRole="alert">{formError}</Text>
          )}
          <CoachPrimaryButton
            label={saving ? t('onboarding.profile.saving') : t('onboarding.profile.next')}
            onPress={() => { void submit(); }}
          />
        </>
      )}
    >
      <View style={styles.heading}>
        <Text style={styles.title} accessibilityRole="header">{t('onboarding.profile.title')}</Text>
        <Text style={styles.intro}>{t('onboarding.profile.intro')}</Text>
      </View>
      {/* The fighter profile in one line; photo and disciplines come later
          via the profile completion hint, no extra required page. */}
      <View style={styles.profileNote}>
        <Ionicons name="person-circle-outline" size={20} color={colors.accentBlueText} />
        <Text style={styles.profileNoteText}>{t('onboarding.profile.profileNote')}</Text>
      </View>
      <View style={styles.fields}>
        <AuthTextField
          variant="warm"
          label={t('onboarding.profile.nameLabel')}
          placeholder={t('onboarding.profile.namePlaceholder')}
          value={name}
          onChangeText={(v) => { onNameChange(v); setNameError(null); }}
          error={nameError}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="done"
          maxLength={NAME_MAX_LENGTH + 10}
        />
        <BirthDateField
          value={birth}
          onChange={(next) => { onBirthChange(next); setBirthError(null); }}
          error={birthError}
          hint={t('onboarding.profile.birthHint')}
        />
        {askGender && (
          <GenderPicker
            value={gender}
            onChange={(next) => { onGenderChange(next); setGenderError(null); }}
            error={genderError}
            hint={`${t('common.gender.why')} ${t('common.gender.lockedHint')}`}
          />
        )}
      </View>
    </OnboardingShell>
  );
}

// Before the first measurement; and the smallest useful scene.
const HERO_START_SHARE = 0.3;
const HERO_MIN_HEIGHT = 144;
const FADE_IN = FadeIn.duration(180);
const FADE_OUT = FadeOut.duration(120);

const styles = StyleSheet.create({
  hero: { alignSelf: 'center' },
  heading: { gap: 8 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.text },
  intro: { fontSize: 16, lineHeight: 24, color: colors.textMuted },
  fields: { gap: 16 },
  profileNote: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileNoteText: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.text },
  formError: {
    fontSize:   14,
    lineHeight: 20,
    color:      colors.deleteRed,
    textAlign:  'center',
  },
});
