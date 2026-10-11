import React, { useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/language';
import { formatDate } from '../../utils/formatDate';
import { disciplineLabel } from '../../utils/disciplineLabel';
import { sparringLocationLines } from '../../utils/sparringDetail';
import { CoachPrimaryButton, CoachSecondaryButton } from '../coach/CoachAnswerButtons';
import { SCENE_LOCATION } from '../onboarding/onboardingScenes';
import type { IntroSparringState } from '../../hooks/useIntroSparring';
import IntroShell from './IntroShell';
import IntroPeekStage from './IntroPeekStage';
import IntroInviteCard from './IntroInviteCard';

// Next Saturday, 18:00 local time: a typical offer time for the example.
function exampleDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + (((6 - d.getDay()) + 7) % 7 || 7));
  d.setHours(18, 0, 0, 0);
  return d;
}

// Step 4: how Sparr finds a meetup. One real, joinable sparring near the
// chosen place, or (search answered, nothing fitting) a clearly labelled
// local example. A failed search is its own state with retry, never "no
// matches". The example has no id and no actions.
export default function IntroSparringStep({ search, onRetry, onOpenSparring, onOpenSearch, onBack, onLater }: {
  search:         IntroSparringState;
  onRetry:        () => void;
  onOpenSparring: (id: string) => void;
  onOpenSearch:   () => void;
  onBack:         () => void;
  onLater:        () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [exampleChosen, setExampleChosen] = useState(false);
  const [exampleAt] = useState(exampleDate);

  const found = search.status === 'found' ? search.sparring : null;
  const failed = search.status === 'error';
  const showExample = search.status === 'none' || (exampleChosen && found === null);

  const example = (
    <IntroInviteCard
      example
      label={t('onboarding.intro.sparring.exampleBadge')}
      title={t('onboarding.intro.sparring.exampleTitle')}
      subtitle={t('onboarding.intro.sparring.exampleSubtitle')}
      dateLine={`${formatDate(exampleAt, 'weekday', language)} · ${formatDate(exampleAt, 'time', language)}`}
      placeLine={t('onboarding.intro.sparring.examplePlace')}
    />
  );

  let intro: React.ReactNode = null;
  let content: React.ReactNode;
  let footer: React.ReactNode;
  if (found !== null) {
    const location = sparringLocationLines({
      studioId:   found.studio_id,
      studioName: found.studio_name,
      studioCity: found.studio_city,
      address:    found.address,
    });
    const discipline = disciplineLabel(found.discipline, language);
    intro = <Text style={styles.label}>{t('onboarding.intro.sparring.foundLabel')}</Text>;
    content = (
      <IntroInviteCard
        label={discipline}
        title={found.title.trim().length > 0 ? found.title : discipline}
        subtitle={t('sparring.detailHeader.slotsFree', { count: found.max_slots - found.signup_count })}
        dateLine={`${formatDate(found.scheduled_at, 'weekdayLong', language)} · ${formatDate(found.scheduled_at, 'time', language)}`}
        placeLine={location.primary}
      />
    );
    footer = <CoachPrimaryButton label={t('onboarding.intro.sparring.openFound')} onPress={() => onOpenSparring(found.id)} />;
  } else if (showExample) {
    intro = (
      <View style={styles.introBlock}>
        <Text style={styles.notice} accessibilityLiveRegion="polite">
          {failed ? t('onboarding.intro.sparring.loadFailed') : t('onboarding.intro.sparring.noneNearby')}
        </Text>
        <Text style={styles.label}>{t('onboarding.intro.sparring.exampleLabel')}</Text>
      </View>
    );
    content = example;
    footer = (
      <>
        <CoachPrimaryButton label={t('onboarding.intro.sparring.openSearch')} onPress={onOpenSearch} />
        {/* After a failed search the retry stays reachable. */}
        {failed && (
          <View style={styles.secondaryRow}>
            <CoachSecondaryButton label={t('onboarding.intro.sparring.retry')} onPress={onRetry} />
          </View>
        )}
      </>
    );
  } else if (failed) {
    content = (
      <View style={styles.status} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <Ionicons name="cloud-offline-outline" size={24} color={colors.text} />
        <Text style={styles.statusText}>{t('onboarding.intro.sparring.loadFailed')}</Text>
      </View>
    );
    footer = (
      <>
        <CoachPrimaryButton label={t('onboarding.intro.sparring.retry')} onPress={onRetry} />
        <View style={styles.secondaryRow}>
          <CoachSecondaryButton label={t('onboarding.intro.sparring.showExample')} onPress={() => setExampleChosen(true)} />
        </View>
      </>
    );
  } else {
    content = (
      <View style={styles.status} accessibilityLiveRegion="polite">
        <ActivityIndicator color={colors.brandPrimary} />
        <Text style={styles.statusText}>{t('onboarding.intro.sparring.loading')}</Text>
      </View>
    );
    footer = <CoachPrimaryButton label={t('onboarding.intro.sparring.loadingButton')} onPress={onOpenSearch} loading />;
  }

  return (
    <IntroShell
      step={4}
      topic={t('onboarding.intro.sparring.topic')}
      title={t('onboarding.intro.sparring.title')}
      lead={t('onboarding.intro.sparring.lead')}
      onBack={onBack}
      onLater={onLater}
      footer={footer}
    >
      {intro}
      {/* Explanation and preview lead this screen: the coach stays small. */}
      <IntroPeekStage scene={SCENE_LOCATION} small>{content}</IntroPeekStage>
      <View style={styles.notes}>
        <Text style={styles.free}>{t('onboarding.intro.sparring.free')}</Text>
        <Text style={styles.muted}>{t('onboarding.intro.sparring.creator')}</Text>
      </View>
    </IntroShell>
  );
}

const styles = StyleSheet.create({
  introBlock: { gap: 8 },
  notice: {
    fontSize:   16,
    lineHeight: 22,
    color:      colors.text,
  },
  label: {
    fontSize:   16,
    lineHeight: 22,
    fontWeight: '700',
    color:      colors.text,
  },
  status: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             16,
    padding:         16,
    borderRadius:    16,
    borderWidth:     1.5,
    borderColor:     colors.hairline,
    backgroundColor: colors.card,
  },
  statusText: {
    flex:       1,
    fontSize:   16,
    lineHeight: 22,
    color:      colors.text,
  },
  secondaryRow: { alignItems: 'center' },
  notes: { gap: 4 },
  free: {
    fontSize:   15,
    lineHeight: 22,
    fontWeight: '600',
    color:      colors.text,
  },
  muted: {
    fontSize:   14,
    lineHeight: 20,
    color:      colors.textMuted,
  },
});
