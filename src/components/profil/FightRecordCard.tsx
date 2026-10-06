import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
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
        <Text style={styles.title} accessibilityRole="header">Kampfrekord</Text>
        {canAdd && (
          <TouchableOpacity
            onPress={onAdd}
            activeOpacity={0.6}
            style={styles.headerAddBtn}
            accessibilityRole="button"
            accessibilityLabel="Kampf ergänzen"
          >
            <MaterialCommunityIcons name="plus" size={18} color={colors.accentBlueText} />
            <Text style={styles.headerAddBtnText}>Kampf ergänzen</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accentBlue} />
        </View>
      ) : showFullEmptyState ? (
        <Text style={styles.emptyText}>
          {isOwn ? 'Noch keine Wettkämpfe eingetragen.' : `${ownerName ?? 'Dieser Kämpfer'} hat noch keine Wettkämpfe eingetragen.`}
        </Text>
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

          {/* Scoreboard: wins – losses – draws, big numbers, labels beneath */}
          <View
            style={styles.scoreboard}
            accessible
            accessibilityLabel={`${wins} Siege, ${losses} Niederlagen, ${draws} Unentschieden${kos > 0 ? `, davon ${kos} durch KO oder TKO` : ''}`}
          >
            <Score value={wins} label="Siege" accent />
            <Text style={styles.scoreDash} importantForAccessibility="no">–</Text>
            <Score value={losses} label="Niederlagen" />
            <Text style={styles.scoreDash} importantForAccessibility="no">–</Text>
            <Score value={draws} label="Unentschieden" />
          </View>
          <Text style={styles.scoreMeta}>
            {[
              kos > 0 ? `${kos} durch KO/TKO` : null,
              showTabs ? null : (hasAmateur ? 'Amateur' : 'Profi'),
              'selbst eingetragen',
            ].filter((v): v is string => v !== null).join(', ').replace(/^./, (c) => c.toUpperCase())}
          </Text>

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

function Score({ value, label, accent = false }: { value: number; label: string; accent?: boolean }): React.ReactElement {
  return (
    <View style={styles.score}>
      <Text style={[styles.scoreValue, accent && styles.scoreValueAccent]} maxFontSizeMultiplier={1.2}>{value}</Text>
      <Text style={styles.scoreLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            8,
    marginBottom:   8,
  },
  title: { flexShrink: 1, fontSize: 20, fontWeight: '800', color: colors.text },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    minHeight:     44,
  },
  headerAddBtnText: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.accentBlueText,
  },
  loadingWrap: {
    paddingVertical: 16,
    alignItems:      'flex-start',
  },
  emptyText: {
    fontSize:   15,
    lineHeight: 22,
    color:      colors.textMuted,
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

  // ── Scoreboard ─────────────────────────────────────────────────────
  scoreboard: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           8,
    marginTop:     8,
  },
  score: {
    flex:       1,
    minWidth:   0,
    alignItems: 'flex-start',
  },
  scoreValue: {
    fontFamily: fonts.display,
    fontSize:   64,
    lineHeight: 66,
    color:      colors.text,
  },
  scoreValueAccent: {
    color: colors.accentBlueText,
  },
  scoreDash: {
    fontFamily: fonts.display,
    fontSize:   40,
    lineHeight: 66,
    color:      colors.hairline,
  },
  scoreLabel: {
    fontSize:   13,
    fontWeight: '700',
    color:      colors.text,
  },
  scoreMeta: {
    fontSize:     13,
    color:        colors.textMuted,
    marginTop:    8,
    marginBottom: 8,
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
