import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import { useSparringReliability } from '../../hooks/useSparringReliability';
import { useUpcomingSparringCount } from '../../hooks/useUpcomingSparringCount';
import { useSparringHistory } from '../../hooks/useSparringHistory';
import type { HistoryEntry } from '../../hooks/useSparringHistory';
import { formatReliability } from '../../utils/sparringReliability';
import { historyStatus } from '../../utils/sparringHistory';
import type { HistoryTone } from '../../utils/sparringHistory';
import { BlockTitle } from './ProfileFacts';

interface Props {
  userId:          string | null;
  isOwn:           boolean;
  refetchTrigger?: number;
  /** Own profile: open a meeting from the list. */
  onOpenSparring?: (sparringId: string) => void;
}

// Below this many recorded meetings the quote says so instead of sounding final.
const THIN_HISTORY = 3;

// Sparring activity: planned (future, holds a slot), attended and not attended.
// Attended/committed come ONLY from get_reliability; "nicht wahrgenommen" =
// committed − attended. Planned sparrings never count against reliability.
// The list of individual meetings (dates and places) is shown on the own
// profile only — foreign profiles show the counts as before.
export default function SparringActivityCard({ userId, isOwn, refetchTrigger = 0, onOpenSparring }: Props): React.ReactElement {
  const { attended, committed } = useSparringReliability(userId, refetchTrigger);
  const upcoming = useUpcomingSparringCount(userId, refetchTrigger);
  const { label, hasHistory } = formatReliability({ attended, committed });
  const missed = Math.max(0, committed - attended);
  const empty = !hasHistory && upcoming === 0;

  return (
    <View style={styles.container}>
      <BlockTitle>Sparring-Aktivität</BlockTitle>

      {empty && !isOwn ? (
        <Text style={styles.muted}>Noch keine Sparrings über die App.</Text>
      ) : !empty ? (
        <>
          <View style={styles.numbers}>
            <Stat value={upcoming} label="geplant" accent />
            <Stat value={attended} label="besucht" />
            {missed > 0 && <Stat value={missed} label="nicht wahrgenommen" />}
          </View>
          <Text style={styles.reliability}>
            {hasHistory
              ? `${label}.${committed < THIN_HISTORY ? ' Noch wenige Treffen erfasst.' : ''}`
              : 'Geplante Treffen zählen erst nach dem Termin.'}
          </Text>
        </>
      ) : null}

      {isOwn && <OwnHistory userId={userId} refetchTrigger={refetchTrigger} onOpen={onOpenSparring} emptyHint={empty} />}
    </View>
  );
}

function Stat({ value, label, accent = false }: { value: number; label: string; accent?: boolean }): React.ReactElement {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={[styles.statValue, accent && styles.statAccent]} maxFontSizeMultiplier={1.3}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const TONE_STYLE: Record<HistoryTone, 'toneUpcoming' | 'toneDone' | 'toneMissed' | 'toneNeutral'> = {
  upcoming: 'toneUpcoming',
  done:     'toneDone',
  missed:   'toneMissed',
  neutral:  'toneNeutral',
};

function OwnHistory({ userId, refetchTrigger, onOpen, emptyHint }: {
  userId: string | null; refetchTrigger: number; onOpen?: (id: string) => void; emptyHint: boolean;
}): React.ReactElement | null {
  const { entries, status, hasMore, showMore, retry } = useSparringHistory(userId, refetchTrigger);

  if (status === 'loading' && entries.length === 0) return <ActivityIndicator color={colors.accentBlue} />;
  if (status === 'error' && entries.length === 0) {
    return (
      <View>
        <Text style={styles.muted}>Deine Treffen konnten nicht geladen werden.</Text>
        <TouchableOpacity style={styles.more} onPress={retry} accessibilityRole="button">
          <Text style={styles.moreText}>Erneut versuchen</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (entries.length === 0) {
    return emptyHint
      ? <Text style={styles.muted}>Noch keine Treffen. Sag auf der Karte bei einem Sparring zu – hier erscheinen dann deine Termine.</Text>
      : null;
  }
  return (
    <View>
      {entries.map((e, i) => <HistoryRow key={`${e.role}:${e.sparringId}`} entry={e} first={i === 0} onOpen={onOpen} />)}
      {hasMore && (
        <TouchableOpacity style={styles.more} onPress={showMore} accessibilityRole="button">
          <Text style={styles.moreText}>Ältere Treffen anzeigen</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function HistoryRow({ entry, first, onOpen }: { entry: HistoryEntry; first: boolean; onOpen?: (id: string) => void }): React.ReactElement {
  const st = historyStatus(entry);
  const d = new Date(entry.scheduledAt);
  const date = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' });
  return (
    <TouchableOpacity
      style={[styles.row, !first && styles.rowBorder]}
      onPress={onOpen !== undefined ? () => onOpen(entry.sparringId) : undefined}
      disabled={onOpen === undefined}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={`${entry.title}, ${date}, ${entry.place}, ${st.label}`}
    >
      <View style={styles.flex}>
        <Text style={styles.rowTitle} numberOfLines={1}>{entry.title}</Text>
        <Text style={styles.muted} numberOfLines={1}>{date} – {entry.place}</Text>
      </View>
      <Text style={[styles.status, styles[TONE_STYLE[st.tone]]]}>{st.label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  muted: {
    fontSize:   14,
    lineHeight: 20,
    color:      colors.textMuted,
  },
  numbers: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    columnGap:     32,
    rowGap:        8,
  },
  stat: {
    minWidth: 64,
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize:   44,
    lineHeight: 46,
    color:      colors.text,
  },
  statAccent: {
    color: colors.accentBlueText,
  },
  statLabel: {
    fontSize:   13,
    fontWeight: '700',
    color:      colors.text,
  },
  reliability: {
    fontSize:   14,
    lineHeight: 20,
    color:      colors.text,
  },
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             16,
    minHeight:       56,
    paddingVertical: 8,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  flex: {
    flex: 1,
  },
  rowTitle: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.text,
  },
  status: {
    fontSize:   13,
    fontWeight: '700',
    maxWidth:   '40%',
    textAlign:  'right',
  },
  toneUpcoming: {
    color: colors.accentBlueText,
  },
  toneDone: {
    color: colors.text,
  },
  toneMissed: {
    color: colors.deleteRed,
  },
  toneNeutral: {
    color: colors.textMuted,
  },
  more: {
    minHeight:      44,
    justifyContent: 'center',
    alignSelf:      'flex-start',
  },
  moreText: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.accentBlueText,
  },
});
