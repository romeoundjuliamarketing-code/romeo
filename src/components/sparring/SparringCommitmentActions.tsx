import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { CommitmentCta } from '../../utils/sparringCommitment';
import { isBeforeCancelDeadline, isInConfirmWindow } from '../../utils/sparringCommitment';

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
  if (cta.type === 'none' || cta.type === 'started_organizer') {
    return null;
  }

  const now = new Date();

  if (cta.type === 'join') {
    const points = cta.full
      ? [
          'Wird ein Platz frei, rückst du automatisch nach',
          'Die Warteliste kannst du jederzeit verlassen',
        ]
      : [
          'Die anderen Teilnehmer rechnen mit dir',
          isInConfirmWindow(scheduledAt, now)
            ? 'So kurz vorher gilt deine Zusage sofort als bestätigt'
            : '24 Stunden vorher bestätigst du deine Teilnahme noch einmal',
          ...(isBeforeCancelDeadline(scheduledAt, now) ? ['Rechtzeitig absagen zählt nicht negativ'] : []),
        ];
    return (
      <View style={styles.unit}>
        <Text style={styles.title}>{cta.full ? 'Alle Plätze sind vergeben' : 'Bist du dabei?'}</Text>
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
              {cta.full ? 'Auf die Warteliste' : 'Verbindlich zusagen'}
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
        <Text style={styles.title}>Nur für verifizierte Mitglieder</Text>
        <Text style={styles.body}>Um an diesem Sparring teilzunehmen, muss dein Profil verifiziert sein.</Text>
        <View style={[styles.btnPrimary, styles.btnVerifyRequired]}>
          <Text style={styles.btnPrimaryText}>Verifizierung erforderlich</Text>
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
        <StatusLine icon="time-outline" title="Du stehst auf der Warteliste" />
        <Text style={styles.body}>
          {waitlistPosition !== null ? `Du bist auf Platz ${waitlistPosition}. ` : ''}
          Wird ein Platz frei, rückst du automatisch nach.
        </Text>
        {cancelButton('Warteliste verlassen')}
      </View>
    );
  }

  const cancelHint = cta.cancelIsFree ? (
    <Text style={styles.microcopy}>Rechtzeitige Absage zählt nicht negativ.</Text>
  ) : null;

  if (cta.type === 'pending') {
    if (cta.confirmUrgent) {
      return (
        <View style={styles.unit}>
          <Text style={styles.title}>Bitte bestätige deine Teilnahme</Text>
          <Text style={styles.body}>Das Sparring ist bald. Die anderen rechnen mit dir – bestätige kurz, dass du kommst.</Text>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={onConfirm}
            disabled={loading}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color={colors.card} />
            ) : (
              <Text style={styles.btnPrimaryText}>Ja, ich bin dabei</Text>
            )}
          </TouchableOpacity>
          {cancelButton('Kann doch nicht teilnehmen')}
          {cancelHint}
        </View>
      );
    }
    // No early confirmation: the regular flow asks 24h before the start.
    return (
      <View style={styles.unit}>
        <StatusLine icon="checkmark-circle" title="Du bist dabei" />
        <Text style={styles.body}>
          Dein Platz ist reserviert. 24 Stunden vorher bestätigst du deine Teilnahme noch einmal.
        </Text>
        {cancelButton('Kann doch nicht teilnehmen')}
        {cancelHint}
      </View>
    );
  }

  // cta.type === 'confirmed'
  return (
    <View style={styles.unit}>
      <StatusLine icon="checkmark-circle" title="Du bist dabei" />
      <Text style={styles.body}>Deine Teilnahme ist bestätigt. Dein Platz ist reserviert.</Text>
      {cancelButton('Kann doch nicht teilnehmen')}
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
