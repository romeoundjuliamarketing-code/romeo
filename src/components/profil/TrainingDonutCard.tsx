import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '../../theme/colors';

// ─── Types ────────────────────────────────────────────────────────────────────

type Segment = {
  label: string;
  value: number;
  color: string;
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const SEGMENTS: Segment[] = [
  { label: 'K1 Technik',       value: 14, color: colors.chartK1    },
  { label: 'Boxen',            value: 11, color: colors.chartBoxen  },
  { label: 'BJJ',              value: 7,  color: colors.chartBJJ    },
  { label: 'MMA',              value: 6,  color: colors.chartMMA    },
  { label: 'Kraft & Ausdauer', value: 5,  color: colors.chartKraft  },
  { label: 'Extra Solo',       value: 4,  color: colors.chartExtra  },
];

const TOTAL = SEGMENTS.reduce((sum, s) => sum + s.value, 0);

// ─── SVG donut helpers ────────────────────────────────────────────────────────

const SIZE   = 200;
const CX     = SIZE / 2;
const CY     = SIZE / 2;
const OUTER  = 80;
const INNER  = 52;
const GAP    = 0.03; // radians gap between segments

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

function buildPath(
  cx: number, cy: number,
  outerR: number, innerR: number,
  startAngle: number, endAngle: number,
): string {
  const os = polarToCartesian(cx, cy, outerR, startAngle);
  const oe = polarToCartesian(cx, cy, outerR, endAngle);
  const ie = polarToCartesian(cx, cy, innerR, endAngle);
  const is_ = polarToCartesian(cx, cy, innerR, startAngle);
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${os.x} ${os.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${oe.x} ${oe.y}`,
    `L ${ie.x} ${ie.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${is_.x} ${is_.y}`,
    'Z',
  ].join(' ');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DonutChart() {
  const slices: { d: string; color: string }[] = [];
  let angle = -Math.PI / 2; // start at 12 o'clock

  for (const seg of SEGMENTS) {
    const sweep = (seg.value / TOTAL) * 2 * Math.PI;
    slices.push({
      d: buildPath(CX, CY, OUTER, INNER, angle + GAP / 2, angle + sweep - GAP / 2),
      color: seg.color,
    });
    angle += sweep;
  }

  return (
    <View style={styles.chartWrap}>
      <Svg width={SIZE} height={SIZE}>
        {slices.map((s, i) => (
          <Path key={i} d={s.d} fill={s.color} />
        ))}
        {/* Inner white circle creates the donut hole */}
        <Circle cx={CX} cy={CY} r={INNER - 2} fill="#FFFFFF" />
      </Svg>

      {/* Center text overlaid via absolute positioning */}
      <View style={styles.centerLabel}>
        <Text style={styles.centerValue}>{TOTAL}</Text>
        <Text style={styles.centerUnit}>Einheiten</Text>
      </View>
    </View>
  );
}

function LegendItem({ segment }: { segment: Segment }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
      <Text style={styles.legendName} numberOfLines={1}>{segment.label}</Text>
      <Text style={styles.legendCount}>{segment.value}</Text>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TrainingDonutCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Mein Training</Text>
      <DonutChart />

      {/* Two-column legend */}
      <View style={styles.legend}>
        {SEGMENTS.map((seg, i) => {
          if (i % 2 !== 0) return null;
          const right = SEGMENTS[i + 1];
          return (
            <View key={seg.label} style={styles.legendRow}>
              <View style={styles.legendCol}><LegendItem segment={seg} /></View>
              <View style={styles.legendCol}>
                {right !== undefined && <LegendItem segment={right} />}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: colors.headerBg,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inactive,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 16,
  },

  // Chart area
  chartWrap: {
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  centerLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
  },
  centerUnit: {
    fontSize: 11,
    color: colors.inactive,
    fontWeight: '400',
  },

  // Legend
  legend: {
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 8,
  },
  legendCol: {
    flex: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendName: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    fontWeight: '400',
  },
  legendCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
});
