import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { FightRecord } from '../../hooks/useFightRecord';

type FightRecordCardProps = {
  fights:   FightRecord[];
  loading:  boolean;
  onAdd:    () => void;
  onDelete: (id: string) => Promise<void>;
};

const RESULT_CONFIG: Record<'win' | 'loss' | 'draw', { label: string; bg: string; textColor: string }> = {
  win:  { label: 'S', bg: colors.accentBlue, textColor: '#FFFFFF' },
  loss: { label: 'N', bg: colors.dark,       textColor: '#FFFFFF' },
  draw: { label: 'U', bg: colors.border,     textColor: colors.inactive },
};

const CARD_RADIUS = 16;

const cardShadow = Platform.select({
  ios:     { shadowColor: '#0A0A0A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  android: { elevation: 2 },
});

function formatDate(iso: string | null): string {
  if (iso === null) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return '';
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

const METHOD_LABEL: Record<string, string> = {
  ko:         'KO',
  tko:        'TKO',
  submission: 'SUB',
  decision:   'PTS',
};

export default function FightRecordCard({ fights, loading, onAdd, onDelete }: FightRecordCardProps): React.ReactElement {
  const hasAmateur = fights.some((f) => f.is_amateur === true);
  const hasPro     = fights.some((f) => f.is_amateur !== true);
  const showTabs   = hasAmateur && hasPro;

  const [activeTab, setActiveTab] = React.useState<'pro' | 'amateur'>('pro');

  const visibleFights = showTabs
    ? fights.filter((f) => activeTab === 'amateur' ? f.is_amateur === true : f.is_amateur !== true)
    : fights;

  const wins   = visibleFights.filter((f) => f.result === 'win').length;
  const losses = visibleFights.filter((f) => f.result === 'loss').length;
  const draws  = visibleFights.filter((f) => f.result === 'draw').length;
  const kos    = visibleFights.filter((f) => f.method === 'ko' || f.method === 'tko').length;

  function handleDelete(id: string): void {
    Alert.alert(
      'Kampf löschen',
      'Diesen Eintrag wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: () => { void onDelete(id); } },
      ],
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Kampfrekord</Text>
        <TouchableOpacity
          onPress={onAdd}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="plus-circle-outline" size={24} color={colors.accentBlue} />
        </TouchableOpacity>
      </View>

      {showTabs && (
        <View style={styles.tabRow}>
          {(['pro', 'amateur'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>
                {tab === 'pro' ? 'Profi' : 'Amateur'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {visibleFights.length > 0 && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryCount, { color: colors.accentBlue }]}>{wins}</Text>
            <Text style={styles.summaryLabel}>Siege</Text>
          </View>
          <View style={styles.summarySep} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryCount, { color: colors.text }]}>{losses}</Text>
            <Text style={styles.summaryLabel}>Niederlagen</Text>
          </View>
          <View style={styles.summarySep} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryCount, { color: colors.inactive }]}>{draws}</Text>
            <Text style={styles.summaryLabel}>Unentschieden</Text>
          </View>
          <View style={styles.summarySep} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryCount, { color: colors.text }]}>{kos}</Text>
            <Text style={styles.summaryLabel}>KOs</Text>
          </View>
        </View>
      )}

      {loading ? null : visibleFights.length === 0 ? (
        <Text style={styles.empty}>Noch keine Kämpfe eingetragen.</Text>
      ) : (
        visibleFights.map((fight, index) => {
          const cfg = RESULT_CONFIG[fight.result as 'win' | 'loss' | 'draw'];
          const dateLabel = formatDate(fight.fight_date);
          const meta = [fight.organization, dateLabel].filter((v): v is string => typeof v === 'string' && v.length > 0).join(' · ');
          return (
            <View key={fight.id} style={[styles.fightRow, index > 0 && styles.fightRowBorder]}>
              <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
                <Text style={[styles.badgeText, { color: cfg.textColor }]}>{cfg.label}</Text>
              </View>
              {fight.method !== null && fight.method !== undefined && (
                <View style={styles.koBadge}>
                  <Text style={styles.koBadgeText}>{METHOD_LABEL[fight.method] ?? fight.method.toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.fightInfo}>
                <Text style={styles.opponentName}>
                  {fight.opponent_name !== null ? fight.opponent_name : 'Unbekannter Gegner'}
                </Text>
                {meta.length > 0 && (
                  <Text style={styles.fightMeta}>{meta}</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => handleDelete(fight.id)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.inactive} />
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    padding: 16,
    marginBottom: 16,
    ...cardShadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title:       { fontSize: 15, fontWeight: '700', color: colors.text },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  summaryItem:  { flex: 1, alignItems: 'center', gap: 2 },
  summarySep:   { width: 1, height: 32, backgroundColor: colors.border },
  summaryCount: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  summaryLabel: { fontSize: 10, fontWeight: '500', color: colors.inactive },
  empty:        { fontSize: 13, color: colors.inactive, fontWeight: '400' },
  fightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  fightRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText:    { fontSize: 12, fontWeight: '700' },
  koBadge: {
    backgroundColor: colors.dark,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  koBadgeText:  { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  fightInfo:    { flex: 1, gap: 2 },
  opponentName: { fontSize: 14, fontWeight: '600', color: colors.text },
  fightMeta:    { fontSize: 12, color: colors.inactive, fontWeight: '400' },
  tabRow: {
    flexDirection:  'row',
    gap:            8,
    marginBottom:   12,
  },
  tabBtn: {
    flex:           1,
    height:         32,
    borderRadius:   8,
    borderWidth:    1,
    borderColor:    colors.border,
    alignItems:     'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: colors.accentBlue,
    borderColor:     colors.accentBlue,
  },
  tabBtnText: {
    fontSize:   13,
    fontWeight: '600',
    color:      colors.text,
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },
});
