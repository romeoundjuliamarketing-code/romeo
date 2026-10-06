import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import SparringPopCard, { SparringPopCardBody } from './SparringPopCard';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const title = isWaitlisted ? t('sparring.cancelConfirm.titleWaitlist') : t('sparring.cancelConfirm.title');
  const body = isWaitlisted
    ? t('sparring.cancelConfirm.bodyWaitlist')
    : cancelIsFree
      ? t('sparring.cancelConfirm.bodyFree')
      : t('sparring.cancelConfirm.bodyLate');

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
              <Text style={styles.btnDangerText}>{isWaitlisted ? t('sparring.cancelConfirm.leave') : t('sparring.cancelConfirm.signOff')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnBack} activeOpacity={0.8} onPress={() => close()}>
              <Text style={styles.btnBackText}>{t('common.back')}</Text>
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
