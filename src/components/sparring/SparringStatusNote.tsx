import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import type { CommitmentCta } from '../../utils/sparringCommitment';
import { isBeforeCancelDeadline, isInConfirmWindow } from '../../utils/sparringCommitment';
import type { JoinGate } from '../../utils/joinGate';
import { SPARRING_TRUST } from '../../data/sparringConfig';
import { TextAction } from '../common/TextAction';

const COACH_WAITLIST = require('../../../assets/coach/coach-waitlist.png');
const COACH_RATIO = 192 / 175;   // width / height of the asset
const COACH_WIDTH = 64;

// What the current participation state means, in the scrollable content
// (the fixed action area only carries a short status). The coach appears
// only next to the waitlist explanation. Every sentence maps to an existing
// mechanism (24h confirmation, cancel deadline, promote_sparring_waitlist).
export default function SparringStatusNote({
  cta, scheduledAt, waitlistPosition, isActive, blockedGate, blockedDistance, showCoach, onWhyLimit,
}: {
  cta:              CommitmentCta;
  scheduledAt:      string;
  waitlistPosition: number | null;
  isActive:         boolean;
  blockedGate:      Extract<JoinGate, { kind: 'tooFar' }> | null;
  blockedDistance:  string | null;
  /** false with very large text: the explanation needs the full width. */
  showCoach:        boolean;
  onWhyLimit:       () => void;
}): React.ReactElement | null {
  const { t } = useTranslation();
  // "So funktioniert's" details are collapsed per sparring (the sheet remounts
  // this note with a new key per sparring).
  const [howOpen, setHowOpen] = useState(false);
  const now = new Date();
  if (!isActive) return null;

  if (blockedGate !== null && cta.type === 'join') {
    const distance = blockedDistance;
    return (
      <View style={styles.note}>
        <Text style={styles.body}>
          {distance !== null
            ? t('sparringTrust.blocked.distance', { distance, limit: blockedGate.radiusKm })
            : t('sparringTrust.blocked.distanceUnknown', { limit: blockedGate.radiusKm })}
        </Text>
        {!blockedGate.unlocked && (
          <Text style={styles.body}>{t('sparringTrust.blocked.unlockHint', { km: SPARRING_TRUST.radiusUnlockedKm })}</Text>
        )}
        <TextAction label={t('sparringTrust.actions.limit')} onPress={onWhyLimit} />
      </View>
    );
  }

  const waitlistLines =
    cta.type === 'join' && cta.full ? [t('sparring.invite.fullBody'), t('sparring.invite.fullHint')]
      : cta.type === 'waitlisted'
        ? [
            ...(waitlistPosition !== null ? [t('sparring.invite.waitlistPosition', { position: waitlistPosition })] : []),
            t('sparring.invite.fullBody'),
            t('sparring.invite.fullHint'),
          ]
        : null;
  if (waitlistLines !== null) {
    return (
      <View style={[styles.note, styles.row]}>
        <View style={styles.texts}>
          {waitlistLines.map((line) => <Text key={line} style={styles.body}>{line}</Text>)}
        </View>
        {showCoach && (
          <Image
            source={COACH_WAITLIST}
            style={styles.coach}
            resizeMode="contain"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        )}
      </View>
    );
  }

  // Urgent confirmation: the request itself is the information.
  if (cta.type === 'pending' && cta.confirmUrgent) {
    return (
      <View style={styles.note}>
        <Text style={styles.body}>{t('sparring.commitment.confirmBody')}</Text>
      </View>
    );
  }

  // Join / reserved / confirmed: one compact line, the existing rules
  // (confirmation window, cancel deadline) behind "So funktioniert's".
  let how: string[] = [];
  if (cta.type === 'join') {
    how = [
      isInConfirmWindow(scheduledAt, now)
        ? t('sparring.commitment.pointConfirmedNow')
        : t('sparring.commitment.pointConfirmLater'),
      ...(isBeforeCancelDeadline(scheduledAt, now) ? [t('sparring.commitment.pointCancelFree')] : []),
    ];
  } else if (cta.type === 'pending') {
    how = [t('sparring.commitment.reservedBody'), ...(cta.cancelIsFree ? [t('sparring.commitment.cancelFreeHint')] : [])];
  } else if (cta.type === 'confirmed') {
    how = [t('sparring.commitment.confirmedBody'), ...(cta.cancelIsFree ? [t('sparring.commitment.cancelFreeHint')] : [])];
  } else {
    return null;
  }
  return (
    <View style={styles.note}>
      <Text style={styles.body}>
        <Text style={styles.strong}>{t('sparring.invite.commitmentCounts')}</Text>
        {` ${t('sparring.invite.othersPlan')}`}
      </Text>
      <TextAction
        label={t('sparring.invite.howItWorks')}
        trailingIcon={howOpen ? 'chevron-up' : 'chevron-down'}
        onPress={() => setHowOpen((v) => !v)}
      />
      {howOpen && how.map((line) => <Text key={line} style={styles.body}>{line}</Text>)}
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           16,
  },
  texts: {
    flex: 1,
    gap:  8,
  },
  body: {
    fontSize:   14,
    lineHeight: 20,
    color:      colors.textMuted,
  },
  strong: {
    fontWeight: '700',
    color:      colors.text,
  },
  coach: {
    width:  COACH_WIDTH,
    height: COACH_WIDTH / COACH_RATIO,
  },
});
