import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../theme/colors';
import { fonts } from '../../../theme/typography';
import { useSparringTrustState } from '../../../hooks/useSparringReach';
import type { SparringReachStatus } from '../../../types/sparringTrust';
import ReachStations from './ReachStations';
import CheckinGuide from './CheckinGuide';

interface Props {
  status: SparringReachStatus;
  refetchTrigger: number;
  /** An ended sparring awaits the meeting answer (FeedbackDueCard is shown). */
  feedbackPending: boolean;
  onOpenSparring: (sparringId: string) => void;
  onFind: () => void;
}

// Home module for the reach unlock, driven only by the server status:
//   A  not unlocked, nothing planned      -> "Starte mit deinem ersten Sparring."
//   B  not unlocked, own/joined sparring  -> stations + role-based check-in guide
//   C  unlocked                           -> one small status line (expandable)
// A commitment or a past date never counts as success; only status.unlocked does.
export default function ReachStatusCard({ status, refetchTrigger, feedbackPending, onOpenSparring, onFind }: Props): React.ReactElement | null {
  if (status.unlocked) return <UnlockedLine km={status.unlocked_radius_km} />;
  if (status.active_sparring_id !== null) {
    return (
      <FirstSparringModule
        status={status}
        sparringId={status.active_sparring_id}
        refetchTrigger={refetchTrigger}
        onOpenSparring={onOpenSparring}
      />
    );
  }
  // The meeting answer is the open step then; "start with your first" would be wrong.
  if (feedbackPending) return null;
  return <StarterModule status={status} onFind={onFind} />;
}

function StarterModule({ status, onFind }: { status: SparringReachStatus; onFind: () => void }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.module}>
      <Text style={styles.headline} accessibilityRole="header">{t('sparringTrust.status.startTitle')}</Text>
      <Text style={styles.body}>
        {t('sparringTrust.status.startBody', { base: status.base_radius_km, unlocked: status.unlocked_radius_km })}
      </Text>
      <TouchableOpacity style={styles.primary} onPress={onFind} activeOpacity={0.85} accessibilityRole="button">
        <Ionicons name="search" size={18} color={colors.dark} />
        <Text style={styles.primaryText}>{t('sparringTrust.status.find')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function FirstSparringModule({ status, sparringId, refetchTrigger, onOpenSparring }: {
  status: SparringReachStatus;
  sparringId: string;
  refetchTrigger: number;
  onOpenSparring: (sparringId: string) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const { state, offsetMs } = useSparringTrustState(sparringId, refetchTrigger);
  // Until the role is known, the participant wording is not assumed for an organizer.
  const isOrganizer = state?.role === 'organizer';
  return (
    <View style={styles.module}>
      <Text style={styles.headline} accessibilityRole="header">{t('sparringTrust.status.firstTitle')}</Text>
      {state !== null && (
        <Text style={styles.body}>
          {isOrganizer
            ? t('sparringTrust.status.firstBodyOrganizer', { unlocked: status.unlocked_radius_km })
            : t('sparringTrust.status.firstBodyParticipant', { unlocked: status.unlocked_radius_km })}
        </Text>
      )}
      <ReachStations
        baseKm={status.radius_km}
        unlockedKm={status.unlocked_radius_km}
        laterLabel={isOrganizer ? t('sparringTrust.status.laterOrganizer') : t('sparringTrust.status.laterParticipant')}
      />
      {state !== null && (
        <CheckinGuide state={state} serverNowMs={Date.now() + offsetMs} onOpen={() => onOpenSparring(sparringId)} />
      )}
      <Expander
        label={t('sparringTrust.status.whyTitle')}
        text={t('sparringTrust.status.whyBody', { base: status.base_radius_km, unlocked: status.unlocked_radius_km })}
      />
    </View>
  );
}

function UnlockedLine({ km }: { km: number }): React.ReactElement {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.line}>
      <TouchableOpacity
        style={styles.lineRow}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Ionicons name="lock-open-outline" size={20} color={colors.accentBlueText} />
        <Text style={styles.lineText}>{t('sparringTrust.status.unlockedLine', { km })}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accentBlueText} />
      </TouchableOpacity>
      {open && <Text style={styles.lineBody}>{t('sparringTrust.status.unlockedBody', { km })}</Text>}
    </View>
  );
}

// Quiet expandable background note; the module itself already carries the meaning.
function Expander({ label, text }: { label: string; text: string }): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <TouchableOpacity
        style={styles.expander}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.expanderLabel}>{label}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accentBlueText} />
      </TouchableOpacity>
      {open && <Text style={styles.body}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  // Light blue, no border: clearly lighter in weight than the ticket above.
  module: {
    backgroundColor: colors.accentBlueTint,
    borderRadius: 24,
    padding: 16,
    gap: 16,
  },
  headline: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 30,
    textTransform: 'uppercase',
    color: colors.text,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: colors.accentBlue,
  },
  // Dark text on blue keeps > 6:1 (white would be ~3.3:1).
  primaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.dark,
  },
  expander: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    minHeight: 44,
  },
  expanderLabel: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.accentBlueText,
  },
  line: {
    backgroundColor: colors.accentBlueTint,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
  },
  lineText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.accentBlueText,
  },
  lineBody: {
    paddingBottom: 16,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
});
