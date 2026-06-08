import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useWorkoutStats } from '../hooks/useWorkoutStats';
import { SUPERCATEGORIES } from '../data/disciplines';
import type { SupercategoryKey } from '../data/disciplines';

// ── Config ─────────────────────────────────────────────────────────────────────

const CHART_SIZE = 260;
const CX = CHART_SIZE / 2;
const CY = CHART_SIZE / 2;
const R_OUTER = 110;
const R_INNER = 68;
const GAP_DEG = 2.5;

interface CategoryEntry { key: string; label: string; supercategory: SupercategoryKey }

const CATEGORIES: CategoryEntry[] = [
  { key: 'schlagkraft',  label: 'Schlagkraft',   supercategory: 'striking'  },
  { key: 'trittkraft',   label: 'Trittkraft',    supercategory: 'striking'  },
  { key: 'beinarbeit',   label: 'Beinarbeit',    supercategory: 'striking'  },
  { key: 'koordination', label: 'Koordination',  supercategory: 'striking'  },
  { key: 'k1',           label: 'K1',            supercategory: 'striking'  },
  { key: 'mma',          label: 'MMA',           supercategory: 'striking'  },
  { key: 'ausdauer',     label: 'Ausdauer',      supercategory: 'ausdauer'  },
  { key: 'schulter',     label: 'Schulter',      supercategory: 'kraft'     },
  { key: 'nackenhals',   label: 'Nacken & Hals', supercategory: 'kraft'     },
  { key: 'griffkraft',   label: 'Griffkraft',    supercategory: 'kraft'     },
  { key: 'mobilitaet',   label: 'Mobilität',     supercategory: 'mobility'  },
  { key: 'bjj',          label: 'BJJ',           supercategory: 'grappling' },
  { key: 'ringen',       label: 'Ringen',        supercategory: 'grappling' },
];

// Evenly spaced blues from #E8F4FD (light) to #0A2B6B (dark)
function makePalette(count: number): string[] {
  const from = { r: 232, g: 244, b: 253 };
  const to   = { r: 10,  g: 43,  b: 107 };
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const r = Math.round(from.r + (to.r - from.r) * t);
    const g = Math.round(from.g + (to.g - from.g) * t);
    const b = Math.round(from.b + (to.b - from.b) * t);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  });
}

const PALETTE       = makePalette(CATEGORIES.length);
const SUPER_PALETTE = makePalette(SUPERCATEGORIES.length);

// ── SVG helpers ────────────────────────────────────────────────────────────────

function polarXY(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function segmentPath(
  cx: number, cy: number,
  Ro: number, Ri: number,
  startDeg: number, sweepDeg: number,
): string {
  const s = startDeg + GAP_DEG / 2;
  const e = startDeg + sweepDeg - GAP_DEG / 2;
  if (e - s <= 0) return '';
  const o1 = polarXY(cx, cy, Ro, s);
  const o2 = polarXY(cx, cy, Ro, e);
  const i1 = polarXY(cx, cy, Ri, e);
  const i2 = polarXY(cx, cy, Ri, s);
  const large = (e - s) > 180 ? 1 : 0;
  return [
    `M ${o1.x.toFixed(2)} ${o1.y.toFixed(2)}`,
    `A ${Ro} ${Ro} 0 ${large} 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)}`,
    `L ${i1.x.toFixed(2)} ${i1.y.toFixed(2)}`,
    `A ${Ri} ${Ri} 0 ${large} 0 ${i2.x.toFixed(2)} ${i2.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function PointsBreakdownScreen(): React.ReactElement {
  const navigation = useNavigation();
  const { trainingTypePoints, loading } = useWorkoutStats();
  const [detailliert, setDetailliert] = useState(false);

  const withColor = CATEGORIES.map((cat, i) => ({
    ...cat,
    pts: trainingTypePoints[cat.key] ?? 0,
    color: PALETTE[i],
  }));

  const visible = withColor.filter((c) => c.pts > 0);

  // Supercategory grouping
  const supercatRows = SUPERCATEGORIES.map((sc, i) => {
    const cats = visible.filter((c) => c.supercategory === sc.key);
    return {
      key: sc.key,
      label: sc.label,
      pts: cats.reduce((sum, c) => sum + c.pts, 0),
      color: SUPER_PALETTE[i],
      categories: cats,
    };
  }).filter((sc) => sc.pts > 0);

  // Active dataset depends on detailliert toggle
  const activeRows = detailliert ? visible : supercatRows;
  const total  = activeRows.reduce((sum, c) => sum + c.pts, 0);
  const maxPts = Math.max(1, ...activeRows.map((c) => c.pts));

  // Build donut segments
  let cursor = 0;
  const segments = activeRows.map((c) => {
    const sweep = total > 0 ? (c.pts / total) * 360 : 0;
    const path  = segmentPath(CX, CY, R_OUTER, R_INNER, cursor, sweep);
    cursor += sweep;
    return { ...c, path };
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={18} color={colors.headerTextPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Punkte nach Bereich</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.accentBlue} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >

          {/* ── Donut ── */}
          <View style={styles.donutContainer}>
            <Svg width={CHART_SIZE} height={CHART_SIZE}>
              {segments.length === 0 ? (
                <Circle
                  cx={CX} cy={CY}
                  r={(R_OUTER + R_INNER) / 2}
                  strokeWidth={R_OUTER - R_INNER}
                  stroke={colors.border}
                  fill="none"
                />
              ) : (
                segments.map((seg) => (
                  <Path key={seg.key} d={seg.path} fill={seg.color} />
                ))
              )}
            </Svg>
            <View style={styles.donutCenter}>
              <Text style={styles.donutValue}>{total}</Text>
              <Text style={styles.donutUnit}>XP</Text>
            </View>
          </View>

          {/* ── Detailliert toggle ── */}
          {visible.length > 0 && (
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setDetailliert((v) => !v)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={detailliert ? 'checkbox' : 'square-outline'}
                size={20}
                color={detailliert ? colors.accentBlue : colors.inactive}
              />
              <Text style={styles.toggleLabel}>Detailliert</Text>
            </TouchableOpacity>
          )}

          {/* ── List ── */}
          {visible.length === 0 ? (
            <Text style={styles.empty}>Noch keine Punkte erfasst.</Text>
          ) : (
            <View style={styles.card}>
              {activeRows.map((row) => {
                const barPct = Math.max(2, Math.round((row.pts / maxPts) * 100));
                return (
                  <View key={row.key} style={styles.row}>
                    <View style={[styles.dot, { backgroundColor: row.color }]} />
                    <Text style={styles.rowLabel}>{row.label}</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${barPct}%` as `${number}%`, backgroundColor: row.color },
                        ]}
                      />
                    </View>
                    <Text style={styles.rowXP}>
                      {row.pts}
                      <Text style={styles.rowUnit}> XP</Text>
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    backgroundColor: colors.dark,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.headerCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.headerTextPrimary,
    fontSize: 22,
    fontWeight: '700',
  },

  loader: {
    marginTop: 48,
  },

  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 48,
    alignItems: 'center',
  },

  // Donut
  donutContainer: {
    width: CHART_SIZE,
    height: CHART_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  donutValue: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -1,
  },
  donutUnit: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.inactive,
    marginTop: 2,
  },

  // Detailliert toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },

  // List
  empty: {
    fontSize: 14,
    color: colors.inactive,
    marginTop: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
    width: 110,
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  rowXP: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    width: 56,
    textAlign: 'right',
  },
  rowUnit: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.inactive,
  },
});
