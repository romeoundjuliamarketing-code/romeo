import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { CommitmentCta } from '../../utils/sparringCommitment';
import { isBeforeCancelDeadline, isInConfirmWindow } from '../../utils/sparringCommitment';
import { useTranslation } from 'react-i18next';

interface Props {
  cta:              CommitmentCta;
  scheduledAt:      string;
  waitlistPosition: number | null;
  loading:          boolean;
  onJoin:           () => void;
  onConfirm:        () => void;
  onCancel:         () => void;
}

// Status-driven commitment unit of the sparring detail window (spec 8.3):
// one calm surface with the question, the action and what a commitment means.
// Every promise shown here maps to an existing mechanism (24h confirmation,
// cancel deadline, waitlist promotion) — nothing is invented.
export default function SparringCommitmentActions({
  cta, scheduledAt, waitlistPosition, loading, onJoin, onConfirm, onCancel,
}: Props): React.ReactElement | null {
  const { t } = useTranslation();
  if (cta.type === 'none' || cta.type === 'started_organizer') {
    return null;
  }

  const now = new Date();

  if (cta.type === 'join') {
    const points = cta.full
      ? [
          t('sparring.commitment.pointWaitlistPromote'),
          t('sparring.commitment.pointWaitlistLeave'),
        ]
      : [
          t('sparring.commitment.pointOthersCount'),
          isInConfirmWindow(scheduledAt, now)
            ? t('sparring.commitment.pointConfirmedNow')
            : t('sparring.commitment.pointConfirmLater'),
          ...(isBeforeCancelDeadline(scheduledAt, now) ? [t('sparring.commitment.pointCancelFree')] : []),
        ];
    return (
      <View style={styles.unit}>
        <Text style={styles.title}>{cta.full ? t('sparring.commitment.titleFull') : t('sparring.commitment.titleJoin')}</Text>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={onJoin}
          disabled={loading}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color={colors.card} />
          ) : (
            <Text style={styles.btnPrimaryText}>
              {cta.full ? t('sparring.commitment.joinWaitlist') : t('sparring.commitment.joinBinding')}
            </Text>
          )}
        </TouchableOpacity>
        <View style={styles.points}>
          {points.map((p) => (
            <View key={p} style={styles.point}>
              <Ionicons name="checkmark" size={16} color={colors.accentBlue} />
              <Text style={styles.pointText}>{p}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (cta.type === 'verified_required') {
    return (
      <View style={styles.unit}>
        <Text style={styles.title}>{t('sparring.commitment.verifiedOnlyTitle')}</Text>
        <Text style={styles.body}>{t('sparring.commitment.verifiedOnlyBody')}</Text>
        <View style={[styles.btnPrimary, styles.btnVerifyRequired]}>
          <Text style={styles.btnPrimaryText}>{t('sparring.commitment.verificationRequired')}</Text>
        </View>
      </View>
    );
  }

  const cancelButton = (label: string) => (
    <TouchableOpacity
      style={styles.btnCancel}
      onPress={onCancel}
      disabled={loading}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={colors.deleteRed} />
      ) : (
        <Text style={styles.btnCancelText}>{label}</Text>
      )}
    </TouchableOpacity>
  );

  if (cta.type === 'waitlisted') {
    return (
      <View style={styles.unit}>
        <StatusLine icon="time-outline" title={t('sparring.commitment.onWaitlist')} />
        <Text style={styles.body}>
          {waitlistPosition !== null
            ? t('sparring.commitment.waitlistBodyPosition', { position: waitlistPosition })
            : t('sparring.commitment.waitlistBody')}
        </Text>
        {cancelButton(t('sparring.commitment.leaveWaitlist'))}
      </View>
    );
  }

  const cancelHint = cta.cancelIsFree ? (
    <Text style={styles.microcopy}>{t('sparring.commitment.cancelFreeHint')}</Text>
  ) : null;

  if (cta.type === 'pending') {
    if (cta.confirmUrgent) {
      return (
        <View style={styles.unit}>
          <Text style={styles.title}>{t('sparring.commitment.confirmTitle')}</Text>
          <Text style={styles.body}>{t('sparring.commitment.confirmBody')}</Text>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={onConfirm}
            disabled={loading}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color={colors.card} />
            ) : (
              <Text style={styles.btnPrimaryText}>{t('sparring.commitment.confirmYes')}</Text>
            )}
          </TouchableOpacity>
          {cancelButton(t('sparring.commitment.cannotAttend'))}
          {cancelHint}
        </View>
      );
    }
    // No early confirmation: the regular flow asks 24h before the start.
    return (
      <View style={styles.unit}>
        <StatusLine icon="checkmark-circle" title={t('sparring.commitment.youAreIn')} />
        <Text style={styles.body}>
          {t('sparring.commitment.reservedBody')}
        </Text>
        {cancelButton(t('sparring.commitment.cannotAttend'))}
        {cancelHint}
      </View>
    );
  }

  // cta.type === 'confirmed'
  return (
    <View style={styles.unit}>
      <StatusLine icon="checkmark-circle" title={t('sparring.commitment.youAreIn')} />
      <Text style={styles.body}>{t('sparring.commitment.confirmedBody')}</Text>
      {cancelButton(t('sparring.commitment.cannotAttend'))}
      {cancelHint}
    </View>
  );
}

function StatusLine({ icon, title }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string }) {
  return (
    <View style={styles.statusLine}>
      <Ionicons name={icon} size={24} color={colors.accentBlue} />
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  unit: {
    backgroundColor: colors.background,
    borderRadius:    16,
    padding:         16,
    gap:             16,
  },
  title: {
    flexShrink: 1,
    fontSize:   18,
    fontWeight: '700',
    color:      colors.text,
  },
  statusLine: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  body: {
    fontSize:   14,
    lineHeight: 20,
    color:      colors.text,
  },
  points: {
    gap: 8,
  },
  point: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           8,
  },
  pointText: {
    flex:       1,
    fontSize:   14,
    lineHeight: 20,
    color:      colors.text,
  },
  microcopy: {
    fontSize:  12,
    color:     colors.textSecondary,
    textAlign: 'center',
    marginTop: -8,
  },
  btnPrimary: {
    backgroundColor: colors.accentBlue,
    borderRadius:    16,
    minHeight:       48,
    paddingVertical: 8,
    alignItems:      'center',
    justifyContent:  'center',
  },
  btnPrimaryText: {
    fontSize:   16,
    fontWeight: '700',
    color:      colors.card,
  },
  btnVerifyRequired: {
    backgroundColor: colors.sparringsOrange,
  },
  btnCancel: {
    borderRadius:    16,
    minHeight:       44,
    paddingVertical: 8,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.card,
  },
  btnCancelText: {
    fontSize:   15,
    fontWeight: '600',
    color:      colors.deleteRed,
  },
});
