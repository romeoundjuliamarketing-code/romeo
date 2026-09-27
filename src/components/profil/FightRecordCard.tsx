import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { FightRecord } from '../../hooks/useFightRecord';

type FightRecordCardProps = {
  fights:     FightRecord[];
  loading:    boolean;
  onAdd?:     () => void;
  onDelete?:  (id: string) => Promise<void>;
  readOnly?:  boolean;
  /** Name shown in the empty state on a foreign profile. */
  ownerName?: string | null;
  /** Condensed view: only the latest 3 fights, with a toggle to reveal the rest. */
  compact?:   boolean;
};

// Fight badges sit on a small 32px circle — text under 19px bold can't use
// white-on-accentBlue (contrast), so win uses dark text on the accent instead.
const RESULT_CONFIG: Record<'win' | 'loss' | 'draw', { label: string; bg: string; textColor: string }> = {
  win:  { label: 'S', bg: colors.accentBlue, textColor: colors.dark },
  loss: { label: 'N', bg: colors.dark,       textColor: colors.card },
  draw: { label: 'U', bg: colors.hairline,   textColor: colors.text },
};

const METHOD_LABEL: Record<string, string> = {
  ko:         'KO',
  tko:        'TKO',
  submission: 'SUB',
  decision:   'PTS',
};

const PREVIEW_COUNT = 3;

function formatDate(iso: string | null): string {
  if (iso === null) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return '';
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

export default function FightRecordCard({ fights, loading, onAdd, onDelete, readOnly, ownerName, compact = false }: FightRecordCardProps): React.ReactElement {
  const hasAmateur = fights.some((f) => f.is_amateur === true);
  const hasPro     = fights.some((f) => f.is_amateur !== true);
  const showTabs   = hasAmateur && hasPro;

  const [activeTab, setActiveTab] = React.useState<'pro' | 'amateur'>('pro');
  const [expanded, setExpanded]   = React.useState(false);

  const visibleFights = showTabs
    ? fights.filter((f) => activeTab === 'amateur' ? f.is_amateur === true : f.is_amateur !== true)
    : fights;

  const wins   = visibleFights.filter((f) => f.result === 'win').length;
  const losses = visibleFights.filter((f) => f.result === 'loss').length;
  const draws  = visibleFights.filter((f) => f.result === 'draw').length;
  const kos    = visibleFights.filter((f) => f.method === 'ko' || f.method === 'tko').length;
  const total  = wins + losses + draws;

  const isOwn        = readOnly !== true;
  const canAdd        = isOwn && onAdd !== undefined;
  const canDeleteRows = isOwn && onDelete !== undefined;

  const hasMore        = compact && visibleFights.length > PREVIEW_COUNT;
  const displayedFights = compact && !expanded ? visibleFights.slice(0, PREVIEW_COUNT) : visibleFights;

  function handleDelete(id: string): void {
    if (!canDeleteRows || onDelete === undefined) return;
    Alert.alert(
      'Kampf löschen',
      'Diesen Eintrag wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: () => { void onDelete(id); } },
      ],
    );
  }

  const showFullEmptyState = !loading && fights.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTexts}>
          <Text style={styles.title}>Kampfrekord</Text>
          <Text style={styles.subtitle}>Wettkampfergebnisse</Text>
        </View>
        {canAdd && !showFullEmptyState && (
          <TouchableOpacity
            onPress={onAdd}
            activeOpacity={0.7}
            style={styles.headerAddBtn}
            accessibilityRole="button"
            accessibilityLabel="Kampf eintragen"
          >
            <MaterialCommunityIcons name="plus-circle-outline" size={18} color={colors.accentBlue} />
            <Text style={styles.headerAddBtnText}>Kampf eintragen</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accentBlue} />
        </View>
      ) : showFullEmptyState ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <MaterialCommunityIcons name="boxing-glove" size={28} color={colors.accentBlue} />
          </View>
          <Text style={styles.emptyTitle}>Noch keine Kämpfe</Text>
          <Text style={styles.emptyText}>
            {isOwn
              ? 'Trag deine Wettkämpfe ein – Amateur oder Profi. So sehen Trainingspartner deine Erfahrung.'
              : `${ownerName ?? 'Dieser Kämpfer'} hat noch keine Wettkämpfe eingetragen.`}
          </Text>
          {canAdd && (
            <TouchableOpacity
              onPress={onAdd}
              activeOpacity={0.85}
              style={styles.emptyAddBtn}
              accessibilityRole="button"
              accessibilityLabel="Kampf eintragen"
            >
              <MaterialCommunityIcons name="plus" size={18} color={colors.dark} />
              <Text style={styles.emptyAddBtnText}>Kampf eintragen</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          {showTabs && (
            <View style={styles.segmentWrap}>
              {(['pro', 'amateur'] as const).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.segmentBtn, activeTab === tab && styles.segmentBtnActive]}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activeTab === tab }}
                  accessibilityLabel={tab === 'pro' ? 'Profi-Kämpfe anzeigen' : 'Amateur-Kämpfe anzeigen'}
                >
                  <Text style={[styles.segmentText, activeTab === tab && styles.segmentTextActive]}>
                    {tab === 'pro' ? 'Profi' : 'Amateur'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.summaryBox}>
            <Text style={styles.recordHeadline}>{wins} – {losses} – {draws}</Text>

            <View style={styles.recordBar}>
              {wins > 0 && <View style={[styles.recordBarSeg, { flex: wins, backgroundColor: colors.accentBlue }]} />}
              {losses > 0 && <View style={[styles.recordBarSeg, { flex: losses, backgroundColor: colors.dark }]} />}
              {draws > 0 && <View style={[styles.recordBarSeg, { flex: draws, backgroundColor: colors.hairline }]} />}
              {total === 0 && <View style={[styles.recordBarSeg, { flex: 1, backgroundColor: colors.hairline }]} />}
            </View>

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.accentBlue }]} />
                <Text style={styles.legendLabel}>Siege</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.dark }]} />
                <Text style={styles.legendLabel}>Niederlagen</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.hairline }]} />
                <Text style={styles.legendLabel}>Unentschieden</Text>
              </View>
            </View>

            {kos > 0 && (
              <View style={styles.koChip}>
                <MaterialCommunityIcons name="flash" size={12} color={colors.accentBlue} />
                <Text style={styles.koChipText}>{kos} KO/TKO</Text>
              </View>
            )}
          </View>

          {displayedFights.map((fight, index) => {
            const cfg = RESULT_CONFIG[fight.result];
            const dateLabel = formatDate(fight.fight_date);
            const meta = [fight.organization, dateLabel].filter((v): v is string => typeof v === 'string' && v.length > 0).join(' · ');
            return (
              <View key={fight.id} style={[styles.fightRow, index > 0 && styles.fightRowBorder]}>
                <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
                  <Text style={[styles.badgeText, { color: cfg.textColor }]}>{cfg.label}</Text>
                </View>
                <View style={styles.fightInfo}>
                  <View style={styles.fightInfoTop}>
                    <Text style={styles.opponentName} numberOfLines={1} ellipsizeMode="tail">
                      {fight.opponent_name !== null ? fight.opponent_name : 'Unbekannter Gegner'}
                    </Text>
                    {fight.method !== null && fight.method !== undefined && (
                      <View style={styles.methodChip}>
                        <Text style={styles.methodChipText}>{METHOD_LABEL[fight.method] ?? fight.method.toUpperCase()}</Text>
                      </View>
                    )}
                  </View>
                  {meta.length > 0 && (
                    <Text style={styles.fightMeta} numberOfLines={1} ellipsizeMode="tail">{meta}</Text>
                  )}
                </View>
                {canDeleteRows && (
                  <TouchableOpacity
                    onPress={() => handleDelete(fight.id)}
                    activeOpacity={0.7}
                    style={styles.deleteBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Kampf löschen"
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          {hasMore && (
            <TouchableOpacity
              onPress={() => setExpanded((v) => !v)}
              activeOpacity={0.7}
              style={styles.toggleBtn}
              accessibilityRole="button"
              accessibilityLabel={expanded ? 'Weniger anzeigen' : `Alle Kämpfe ansehen (${visibleFights.length})`}
            >
              <Text style={styles.toggleBtnText}>
                {expanded ? 'Weniger anzeigen' : `Alle Kämpfe ansehen (${visibleFights.length})`}
              </Text>
              <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.accentBlue} />
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  header: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    gap:            8,
    marginBottom:   16,
  },
  headerTexts: { flexShrink: 1, gap: 4 },
  title:       { fontSize: 20, fontWeight: '800', color: colors.text },
  subtitle:    { fontSize: 13, fontWeight: '400', color: colors.textMuted },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    paddingVertical: 4,
  },
  headerAddBtnText: {
    fontSize:   13,
    fontWeight: '700',
    color:      colors.text,
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems:      'center',
  },

  // ── Empty state ────────────────────────────────────────────────────────
  emptyState: {
    alignItems:      'center',
    paddingVertical: 16,
    gap:             8,
  },
  emptyIconCircle: {
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: colors.accentBlueSoft,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    8,
  },
  emptyTitle: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.text,
  },
  emptyText: {
    fontSize:   13,
    fontWeight: '400',
    color:      colors.textMuted,
    textAlign:  'center',
  },
  emptyAddBtn: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'center',
    gap:              4,
    alignSelf:        'stretch',
    minHeight:        48,
    borderRadius:     16,
    backgroundColor:  colors.accentBlue,
    marginTop:        8,
  },
  emptyAddBtnText: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.dark,
  },

  // ── Segmented Profi/Amateur toggle ────────────────────────────────────
  segmentWrap: {
    flexDirection:   'row',
    backgroundColor: colors.card,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     colors.hairline,
    padding:         4,
    gap:             4,
    marginBottom:    16,
  },
  segmentBtn: {
    flex:           1,
    height:         32,
    borderRadius:   8,
    alignItems:     'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: colors.accentBlue,
  },
  segmentText: {
    fontSize:   13,
    fontWeight: '600',
    color:      colors.textMuted,
  },
  segmentTextActive: {
    color: colors.dark,
  },

  // ── Summary ────────────────────────────────────────────────────────────
  summaryBox: {
    backgroundColor: colors.card,
    borderRadius:    16,
    borderWidth:      1,
    borderColor:      colors.hairline,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems:      'center',
    marginBottom:    16,
  },
  recordHeadline: {
    fontSize:      32,
    fontWeight:    '800',
    color:         colors.text,
    letterSpacing: -0.5,
  },
  recordBar: {
    flexDirection:   'row',
    width:           '100%',
    height:          6,
    borderRadius:    3,
    overflow:        'hidden',
    marginTop:       16,
    backgroundColor: colors.hairline,
  },
  recordBarSeg: { height: '100%' },
  legendRow: {
    flexDirection:   'row',
    justifyContent:  'center',
    gap:             16,
    marginTop:       16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  legendDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize:   12,
    fontWeight: '500',
    color:      colors.textMuted,
  },
  koChip: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              4,
    paddingHorizontal: 8,
    paddingVertical:  4,
    borderRadius:     8,
    backgroundColor:  colors.accentBlueSoft,
    marginTop:        16,
  },
  koChipText: {
    fontSize:   11,
    fontWeight: '700',
    color:      colors.text,
  },

  // ── Fight rows ─────────────────────────────────────────────────────────
  fightRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           8,
    paddingVertical: 16,
  },
  fightRowBorder: { borderTopWidth: 1, borderTopColor: colors.hairline },
  badge: {
    width:          32,
    height:         32,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 13, fontWeight: '700' },
  fightInfo: { flex: 1, gap: 4, minWidth: 0 },
  fightInfoTop: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  opponentName: {
    flexShrink: 1,
    fontSize:   14,
    fontWeight: '600',
    color:      colors.text,
  },
  methodChip: {
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      8,
    backgroundColor:   colors.accentBlueSoft,
  },
  methodChipText: {
    fontSize:   10,
    fontWeight: '700',
    color:      colors.text,
  },
  fightMeta: {
    fontSize:   12,
    fontWeight: '400',
    color:      colors.textMuted,
  },
  deleteBtn: {
    width:          44,
    height:         44,
    marginVertical: -8,
    alignItems:     'center',
    justifyContent: 'center',
  },

  // ── Compact toggle ─────────────────────────────────────────────────────
  toggleBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             4,
    minHeight:       44,
    marginTop:       4,
    borderTopWidth:  1,
    borderTopColor:  colors.hairline,
  },
  toggleBtnText: {
    fontSize:   14,
    fontWeight: '700',
    color:      colors.text,
  },
});
