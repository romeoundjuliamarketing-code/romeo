import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, BackHandler, Keyboard, StyleSheet, type LayoutChangeEvent } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { SCENE_LOCATION } from './onboardingScenes';
import { CoachPrimaryButton, CoachSecondaryButton } from '../coach/CoachAnswerButtons';
import LocationPickerModal from '../sparring/LocationPickerModal';
import OnboardingShell, { ONBOARDING_GUTTER } from './OnboardingShell';
import PlaceSearchPanel from './PlaceSearchPanel';
import { useSearchLocation } from '../../hooks/useSearchLocation';

const STAGE_MIN_HEIGHT = 176;

type Phase = 'idle' | 'locating' | 'finishing';
type Message = 'denied' | 'unavailable' | 'finishFailed' | null;

// Step 2: search location for discovering sparrings. The permission is only
// requested on "Standort verwenden"; any failure stays on this step and offers
// the manual place search (a sub view of this step, not a third step). A
// picked place is a search anchor only: joining always measures the device.
export default function StepLocation({ total, onBack, onComplete, onSignOut }: {
  /** Steps of the whole flow shown in the progress. */
  total:      number;
  onBack:     () => void;
  /** Saves the onboarding as done; false = not saved, stay here. */
  onComplete: () => Promise<boolean>;
  onSignOut:  () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  // Room between heading and actions; the scene fills it (contain, no crop).
  const [stage, setStage] = useState<{ w: number; h: number } | null>(null);
  // Only checks here; asking happens on the button tap (switchToDevice).
  const { switchToDevice, setManual } = useSearchLocation({ askPermission: false });
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<Message>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const busyRef = useRef(false);

  // Hardware back: close the place search first, then back to step 1.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (busyRef.current) return true;
      if (panelOpen) setPanelOpen(false);
      else onBack();
      return true;
    });
    return () => sub.remove();
  }, [panelOpen, onBack]);

  async function finish(): Promise<void> {
    setPhase('finishing');
    const ok = await onComplete();
    // On success this step unmounts; only a failure needs local state.
    if (!ok) {
      busyRef.current = false;
      setPhase('idle');
      setMessage('finishFailed');
    }
  }

  async function handleUseDevice(): Promise<void> {
    if (busyRef.current) return;
    busyRef.current = true;
    setMessage(null);
    if (message === 'finishFailed') {
      await finish();
      return;
    }
    setPhase('locating');
    const found = await switchToDevice();
    if (!found) {
      let granted = false;
      try {
        granted = (await Location.getForegroundPermissionsAsync()).status === 'granted';
      } catch {
        granted = false;
      }
      busyRef.current = false;
      setPhase('idle');
      setMessage(granted ? 'unavailable' : 'denied');
      return;
    }
    await finish();
  }

  async function handlePlace(lat: number, lng: number, label: string): Promise<void> {
    if (busyRef.current) return;
    busyRef.current = true;
    setMessage(null);
    await setManual(lat, lng, label);
    await finish();
  }

  const busy = phase !== 'idle';
  const sceneSize = stage === null ? null : (() => {
    const w = Math.min(stage.w, stage.h * SCENE_LOCATION.ratio);
    return { width: w, height: w / SCENE_LOCATION.ratio };
  })();
  const primaryLabel = phase === 'locating' ? t('onboarding.location.locating')
    : phase === 'finishing' ? t('onboarding.profile.saving')
      : message === 'finishFailed' ? t('onboarding.location.retry')
        : t('onboarding.location.useLocation');
  const messageText = message === 'denied' ? t('onboarding.location.denied')
    : message === 'unavailable' ? t('onboarding.location.unavailable')
      : message === 'finishFailed' ? t('onboarding.location.finishFailed')
        : null;

  return (
    <OnboardingShell
      step={2}
      total={total}
      onBack={() => {
        if (busyRef.current) return;
        if (panelOpen) setPanelOpen(false);
        else onBack();
      }}
      onSignOut={onSignOut}
      footer={panelOpen ? null : (
        <>
          {messageText !== null && (
            <View style={styles.notice} accessibilityLiveRegion="polite" accessibilityRole="alert">
              <Ionicons name="information-circle-outline" size={20} color={colors.text} />
              <Text style={styles.noticeText}>{messageText}</Text>
            </View>
          )}
          <CoachPrimaryButton label={primaryLabel} onPress={() => { void handleUseDevice(); }} />
          <View style={styles.secondaryRow}>
            <CoachSecondaryButton
              label={t('onboarding.location.pickManually')}
              onPress={() => { if (!busy) { setMessage(null); setPanelOpen(true); } }}
            />
          </View>
          <Text style={styles.free}>{t('onboarding.location.free')}</Text>
        </>
      )}
    >
      {panelOpen ? (
        <PlaceSearchPanel
          busy={busy}
          onFound={(lat, lng, label) => { Keyboard.dismiss(); void handlePlace(lat, lng, label); }}
          onPickOnMap={() => setMapOpen(true)}
          error={message === 'finishFailed' ? t('onboarding.location.finishFailed') : null}
        />
      ) : (
        <>
          <View style={styles.heading}>
            <Text style={styles.title} accessibilityRole="header">{t('onboarding.location.title')}</Text>
            <Text style={styles.intro}>{t('onboarding.location.intro')}</Text>
          </View>
          <View
            style={styles.stage}
            onLayout={(e: LayoutChangeEvent) => {
              const { width: w, height: h } = e.nativeEvent.layout;
              if (stage === null || stage.w !== w || stage.h !== h) setStage({ w, h });
            }}
          >
            {sceneSize !== null && (
              <Image
                source={SCENE_LOCATION.source}
                style={sceneSize}
                resizeMode="contain"
                accessible={false}
                importantForAccessibility="no-hide-descendants"
                accessibilityElementsHidden
              />
            )}
          </View>
        </>
      )}
      <LocationPickerModal
        visible={mapOpen}
        askPermission={false}
        onClose={() => setMapOpen(false)}
        onConfirm={(lat, lng, label) => {
          setMapOpen(false);
          void handlePlace(lat, lng, label);
        }}
      />
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 8 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.text },
  intro: { fontSize: 16, lineHeight: 24, color: colors.textMuted },
  // Grows into the free height; the scene sits at its bottom, next to the actions.
  stage: {
    flexGrow:          1,
    minHeight:         STAGE_MIN_HEIGHT,
    marginHorizontal:  -ONBOARDING_GUTTER,
    alignItems:        'center',
    justifyContent:    'flex-end',
  },
  notice: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             8,
    padding:         16,
    borderRadius:    16,
    borderWidth:     1.5,
    borderColor:     colors.fieldBorder,
    backgroundColor: colors.card,
  },
  noticeText: {
    flex:       1,
    fontSize:   15,
    lineHeight: 22,
    color:      colors.text,
  },
  secondaryRow: { alignItems: 'center' },
  free: {
    fontSize:   13,
    lineHeight: 18,
    color:      colors.textMuted,
    textAlign:  'center',
  },
});
