import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import SparringPopCard, { SparringPopCardBody } from './SparringPopCard';

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

function copyFor(result: SparringCommitmentResult): ResultCopy {
  if (result === 'cancelled') {
    return {
      icon:  'checkmark-circle-outline',
      title: 'Du bist abgemeldet',
      body:  'Danke fürs rechtzeitige Absagen. Das zählt nicht gegen dich, und jemand anderes kann nachrücken.',
    };
  }
  if (result === 'cancelled_late') {
    return {
      icon:  'information-circle-outline',
      title: 'Du bist abgemeldet',
      body:  'Die Absage kam kurzfristig und zählt deshalb als nicht wahrgenommen. Danke, dass du trotzdem Bescheid gegeben hast.',
    };
  }
  if (result === 'left_waitlist') {
    return {
      icon:  'checkmark-circle-outline',
      title: 'Warteliste verlassen',
      body:  'Du stehst nicht mehr auf der Warteliste. Das hat keine Auswirkungen auf dich.',
    };
  }
  if (result === 'waitlisted') {
    return {
      icon:  'time-outline',
      title: 'Du stehst auf der Warteliste',
      body:  'Wird ein Platz frei, rückst du automatisch nach. Wir benachrichtigen dich dann.',
    };
  }
  if (result === 'confirmed') {
    return {
      icon:  'checkmark-circle',
      title: 'Du bist dabei',
      body:  'Deine Teilnahme ist bestätigt. Die anderen rechnen mit dir.',
    };
  }
  return {
    icon:  'checkmark-circle',
    title: 'Du bist dabei',
    body:  'Deine Zusage ist verbindlich. 24 Stunden vorher bittet dich die App, deine Teilnahme zu bestätigen.',
  };
}

// Branded result shown after joining or cancelling a sparring (replaces the
// system Alert).
export default function SparringCommitmentResultCard({
  result, sparringTitle, dateTimeLabel, onClose,
}: Props): React.ReactElement {
  const copy = copyFor(result);

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
            <Text style={styles.btnText}>Alles klar</Text>
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
