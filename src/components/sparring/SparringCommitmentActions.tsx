import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import type { CommitmentCta } from '../../utils/sparringCommitment';

interface Props {
  cta:              CommitmentCta;
  confirmedCount:   number;
  waitlistPosition: number | null;
  loading:          boolean;
  onJoin:           () => void;
  onConfirm:        () => void;
  onCancel:         () => void;
}

// Statusabhängige CTA-Zone des Sparring-Detail-Sheets (spec 8.3). Zeigt genau
// eine der Zusage-/Bestätigungs-/Absage-Varianten, nie ein verschachteltes Menü.
export default function SparringCommitmentActions({
  cta, confirmedCount, waitlistPosition, loading, onJoin, onConfirm, onCancel,
}: Props): React.ReactElement | null {
  if (cta.type === 'none' || cta.type === 'started_organizer') {
    return null;
  }

  const socialProof = confirmedCount > 0 ? (
    <Text style={styles.socialProof}>
      {confirmedCount} {confirmedCount === 1 ? 'Teilnehmer hat' : 'Teilnehmer haben'} bereits bestätigt
    </Text>
  ) : null;

  if (cta.type === 'join') {
    return (
      <View style={styles.container}>
        {socialProof}
        <TouchableOpacity style={styles.btnPrimary} onPress={onJoin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.card} />
          ) : (
            <Text style={styles.btnPrimaryText}>
              {cta.full ? 'Auf die Warteliste' : 'Verbindlich zusagen'}
            </Text>
          )}
        </TouchableOpacity>
        <Text style={styles.microcopy}>
          Du sagst verbindlich zu. Der Organisator und die anderen Teilnehmer rechnen mit dir.
        </Text>
      </View>
    );
  }

  if (cta.type === 'verified_required') {
    return (
      <View style={styles.container}>
        {socialProof}
        <View style={[styles.btnPrimary, styles.btnVerifyRequired]}>
          <Text style={styles.btnPrimaryText}>Verifizierung erforderlich</Text>
        </View>
      </View>
    );
  }

  if (cta.type === 'waitlisted') {
    return (
      <View style={styles.container}>
        {socialProof}
        <Text style={styles.statusText}>
          Du stehst auf der Warteliste{waitlistPosition !== null ? ` (Platz ${waitlistPosition})` : ''}
        </Text>
        <TouchableOpacity style={styles.btnCancel} onPress={onCancel} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.card} />
          ) : (
            <Text style={styles.btnCancelText}>Warteliste verlassen</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  if (cta.type === 'pending') {
    return (
      <View style={styles.container}>
        {socialProof}
        {cta.confirmUrgent ? (
          <TouchableOpacity style={styles.btnPrimary} onPress={onConfirm} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.card} />
            ) : (
              <Text style={styles.btnPrimaryText}>Ja, ich bin dabei</Text>
            )}
          </TouchableOpacity>
        ) : (
          // No early confirmation: the regular flow asks 24h before the start.
          <Text style={styles.statusText}>
            Du bist dabei. 24 Stunden vorher bittet dich die App, deine Teilnahme zu bestätigen.
          </Text>
        )}
        <TouchableOpacity style={styles.btnCancel} onPress={onCancel} disabled={loading}>
          <Text style={styles.btnCancelText}>Kann doch nicht teilnehmen</Text>
        </TouchableOpacity>
        {cta.cancelIsFree && (
          <Text style={styles.microcopy}>Rechtzeitige Absage zählt nicht negativ.</Text>
        )}
      </View>
    );
  }

  // cta.type === 'confirmed'
  return (
    <View style={styles.container}>
      {socialProof}
      <TouchableOpacity style={styles.btnCancel} onPress={onCancel} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.deleteRed} />
        ) : (
          <Text style={styles.btnCancelText}>Kann doch nicht teilnehmen</Text>
        )}
      </TouchableOpacity>
      {cta.cancelIsFree && (
        <Text style={styles.microcopy}>Rechtzeitige Absage zählt nicht negativ.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  socialProof: {
    fontSize:   13,
    fontWeight: '600',
    color:      colors.accentBlue,
  },
  microcopy: {
    fontSize: 12,
    color:    colors.textSecondary,
  },
  btnPrimary: {
    backgroundColor: colors.accentBlue,
    borderRadius:    14,
    height:          50,
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
    borderRadius:    14,
    height:          44,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     colors.deleteRed,
    backgroundColor: colors.deleteRedSoft,
  },
  btnCancelText: {
    fontSize:   15,
    fontWeight: '600',
    color:      colors.deleteRed,
  },
  statusText: {
    fontSize:   14,
    fontWeight: '600',
    color:      colors.text,
  },
});
