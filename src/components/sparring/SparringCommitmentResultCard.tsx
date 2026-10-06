import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import SparringPopCard, { SparringPopCardBody } from './SparringPopCard';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

// Outcome of a join (pending/confirmed/waitlisted) or a cancel
// (cancelled/cancelled_late, or left_waitlist when the user only queued).
export type SparringCommitmentResult =
  | 'pending'
  | 'confirmed'
  | 'waitlisted'
  | 'cancelled'
  | 'cancelled_late'
  | 'left_waitlist';

interface Props {
  result:        SparringCommitmentResult;
  sparringTitle: string;
  dateTimeLabel: string;
  onClose:       () => void;
}

interface ResultCopy {
  icon:  React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body:  string;
}

function copyFor(result: SparringCommitmentResult, t: TFunction): ResultCopy {
  if (result === 'cancelled') {
    return {
      icon:  'checkmark-circle-outline',
      title: t('sparring.result.cancelledTitle'),
      body:  t('sparring.result.cancelledBody'),
    };
  }
  if (result === 'cancelled_late') {
    return {
      icon:  'information-circle-outline',
      title: t('sparring.result.cancelledTitle'),
      body:  t('sparring.result.cancelledLateBody'),
    };
  }
  if (result === 'left_waitlist') {
    return {
      icon:  'checkmark-circle-outline',
      title: t('sparring.result.leftWaitlistTitle'),
      body:  t('sparring.result.leftWaitlistBody'),
    };
  }
  if (result === 'waitlisted') {
    return {
      icon:  'time-outline',
      title: t('sparring.result.waitlistedTitle'),
      body:  t('sparring.result.waitlistedBody'),
    };
  }
  if (result === 'confirmed') {
    return {
      icon:  'checkmark-circle',
      title: t('sparring.result.inTitle'),
      body:  t('sparring.result.confirmedBody'),
    };
  }
  return {
    icon:  'checkmark-circle',
    title: t('sparring.result.inTitle'),
    body:  t('sparring.result.pendingBody'),
  };
}

// Branded result shown after joining or cancelling a sparring (replaces the
// system Alert).
export default function SparringCommitmentResultCard({
  result, sparringTitle, dateTimeLabel, onClose,
}: Props): React.ReactElement {
  const { t } = useTranslation();
  const copy = copyFor(result, t);

  return (
    <SparringPopCard onClose={onClose}>
      {(close) => (
        <>
          <SparringPopCardBody
            icon={copy.icon}
            title={copy.title}
            sparringTitle={sparringTitle}
            dateTimeLabel={dateTimeLabel}
            body={copy.body}
          />
          <TouchableOpacity style={styles.btn} activeOpacity={0.8} onPress={() => close()}>
            <Text style={styles.btnText}>{t('sparring.result.ok')}</Text>
          </TouchableOpacity>
        </>
      )}
    </SparringPopCard>
  );
}

const styles = StyleSheet.create({
  btn: {
    width:           '100%',
    backgroundColor: colors.accentBlue,
    borderRadius:    16,
    height:          48,
    alignItems:      'center',
    justifyContent:  'center',
  },
  btnText: {
    fontSize:   16,
    fontWeight: '700',
    color:      colors.card,
  },
});
