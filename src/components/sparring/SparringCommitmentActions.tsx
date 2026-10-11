import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import type { CommitmentCta } from '../../utils/sparringCommitment';
import type { JoinGate } from '../../utils/joinGate';
import { useTranslation } from 'react-i18next';
import SparrDepthButton from './SparrDepthButton';

interface Props {
  cta:              CommitmentCta;
  waitlistPosition: number | null;
  slotsLeft:        number;
  /** false once the organizer cancelled the sparring. */
  isActive:         boolean;
  /** Join refused by distance: replaces the join action. */
  blockedGate:      Extract<JoinGate, { kind: 'tooFar' }> | null;
  /** Formatted distance of the blocked sparring, when measured. */
  blockedDistance:  string | null;
  loading:          boolean;
  /** Eligibility is still being checked: the join button waits. */
  checking?:        boolean;
  onJoin:           () => void;
  onConfirm:        () => void;
  onCancel:         () => void;
  onFindNearby:     () => void;
}

// Fixed action area of the sparring sheet: one short status (what is the
// situation for me) and the main action. Longer explanations live in
// SparringStatusNote inside the scrollable content. The state comes from
// resolveCommitmentCta and the join gate; nothing is decided here.
export default function SparringCommitmentActions({
  cta, waitlistPosition, slotsLeft, isActive, blockedGate, blockedDistance, loading, checking = false,
  onJoin, onConfirm, onCancel, onFindNearby,
}: Props): React.ReactElement {
  const { t } = useTranslation();
  const busyLabel = checking ? t('sparringTrust.blocked.checking') : undefined;

  if (!isActive) return <Status title={t('sparring.invite.cancelledTitle')} sub={t('sparring.invite.cancelledBody')} />;
  if (cta.type === 'none') return <Status title={t('sparring.invite.overTitle')} />;
  if (cta.type === 'started_organizer') {
    return <Status title={t('sparring.invite.overTitle')} sub={t('sparring.invite.overOrganizerBody')} />;
  }

  if (blockedGate !== null) {
    const distance = blockedDistance;
    return (
      <Status
        title={t('sparringTrust.blocked.title')}
        sub={distance !== null
          ? t('sparring.invite.blockedShort', { distance, limit: blockedGate.radiusKm })
          : t('sparring.invite.blockedShortUnknown', { limit: blockedGate.radiusKm })}
      >
        <SparrDepthButton label={t('sparringTrust.blocked.findNearby')} onPress={onFindNearby} />
      </Status>
    );
  }

  if (cta.type === 'join') {
    return cta.full ? (
      <Status title={t('sparring.invite.fullTitle')}>
        <SparrDepthButton label={t('sparring.commitment.joinWaitlist')} onPress={onJoin} loading={loading} busyLabel={busyLabel} />
      </Status>
    ) : (
      <Status
        title={t('sparring.detailHeader.slotsFree', { count: slotsLeft })}
      >
        <SparrDepthButton label={t('sparring.commitment.joinBinding')} onPress={onJoin} loading={loading} busyLabel={busyLabel} />
      </Status>
    );
  }

  if (cta.type === 'verified_required') {
    return <Status title={t('sparring.commitment.verifiedOnlyTitle')} sub={t('sparring.commitment.verifiedOnlyBody')} />;
  }

  if (cta.type === 'waitlisted') {
    return (
      <Status
        title={t('sparring.commitment.onWaitlist')}
        sub={waitlistPosition !== null ? t('sparring.invite.waitlistShort', { position: waitlistPosition }) : undefined}
      >
        <SparrDepthButton variant="danger" label={t('sparring.commitment.leaveWaitlist')} onPress={onCancel} loading={loading} />
      </Status>
    );
  }

  if (cta.type === 'pending' && cta.confirmUrgent) {
    return (
      <Status title={t('sparring.commitment.confirmTitle')}>
        <SparrDepthButton label={t('sparring.commitment.confirmYes')} onPress={onConfirm} loading={loading} />
        <TouchableOpacity
          style={styles.textAction}
          onPress={onCancel}
          disabled={loading}
          accessibilityRole="button"
        >
          <Text style={styles.textActionLabel}>{t('sparring.commitment.cannotAttend')}</Text>
        </TouchableOpacity>
      </Status>
    );
  }

  // pending (the app asks again 24h before) or confirmed
  return (
    <Status
      title={t('sparring.commitment.youAreIn')}
      sub={cta.type === 'confirmed' ? t('sparring.invite.statusConfirmed') : t('sparring.invite.statusReserved')}
    >
      <SparrDepthButton variant="danger" label={t('sparring.commitment.cannotAttend')} onPress={onCancel} loading={loading} />
    </Status>
  );
}

// One short status line (bold state + optional detail) above the action.
function Status({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <View style={styles.unit}>
      <Text style={styles.status} accessibilityRole="text" accessibilityLiveRegion="polite">
        <Text style={styles.title}>{title}</Text>
        {sub !== undefined && <Text style={styles.sub}>{`  ·  ${sub}`}</Text>}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  unit: {
    gap: 8,
  },
  status: {
    fontSize:   15,
    lineHeight: 20,
    textAlign:  'center',
  },
  title: {
    fontWeight: '800',
    color:      colors.text,
  },
  sub: {
    color: colors.textMuted,
  },
  textAction: {
    minHeight:      44,
    alignItems:     'center',
    justifyContent: 'center',
  },
  textActionLabel: {
    fontSize:   15,
    fontWeight: '600',
    color:      colors.deleteRed,
  },
});
