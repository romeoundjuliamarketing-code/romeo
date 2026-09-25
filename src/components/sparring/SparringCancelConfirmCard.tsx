import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import SparringPopCard, { SparringPopCardBody } from './SparringPopCard';

interface Props {
  sparringTitle: string;
  dateTimeLabel: string;
  /** User only queued — leaving the waitlist never has a consequence. */
  isWaitlisted:  boolean;
  /** Cancelling now is still before the cancel deadline (no consequence). */
  cancelIsFree:  boolean;
  onClose:       () => void;
  /** Runs after the card has popped out, so the result card can pop in. */
  onConfirm:     () => void;
}

// Branded "are you sure?" before cancelling a sparring signup (replaces the
// system Alert).
export default function SparringCancelConfirmCard({
  sparringTitle, dateTimeLabel, isWaitlisted, cancelIsFree, onClose, onConfirm,
}: Props): React.ReactElement {
  const title = isWaitlisted ? 'Warteliste verlassen?' : 'Kann doch nicht teilnehmen?';
  const body = isWaitlisted
    ? 'Du verlierst deinen Platz auf der Warteliste. Das hat keine Auswirkungen auf dich.'
    : cancelIsFree
      ? 'Rechtzeitige Absage zählt nicht negativ. Dein Platz wird für jemand anderen frei.'
      : 'Die Absage ist kurzfristig und zählt als nicht wahrgenommen. Trotzdem gut, dass du Bescheid gibst.';

  return (
    <SparringPopCard onClose={onClose}>
      {(close) => (
        <>
          <SparringPopCardBody
            icon="help-circle-outline"
            title={title}
            sparringTitle={sparringTitle}
            dateTimeLabel={dateTimeLabel}
            body={body}
          />
          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnDanger} activeOpacity={0.8} onPress={() => close(onConfirm)}>
              <Text style={styles.btnDangerText}>{isWaitlisted ? 'Verlassen' : 'Abmelden'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnBack} activeOpacity={0.8} onPress={() => close()}>
              <Text style={styles.btnBackText}>Zurück</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SparringPopCard>
  );
}

const styles = StyleSheet.create({
  actions: {
    width: '100%',
    gap:   8,
  },
  btnDanger: {
    backgroundColor: colors.deleteRed,
    borderRadius:    16,
    height:          48,
    alignItems:      'center',
    justifyContent:  'center',
  },
  btnDangerText: {
    fontSize:   16,
    fontWeight: '700',
    color:      colors.card,
  },
  btnBack: {
    backgroundColor: colors.background,
    borderRadius:    16,
    height:          48,
    alignItems:      'center',
    justifyContent:  'center',
  },
  btnBackText: {
    fontSize:   16,
    fontWeight: '600',
    color:      colors.text,
  },
});
