import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';
import { useWorkoutHistory } from '../hooks/useWorkoutHistory';

const TYPE_COLORS: Record<string, string> = {
  schlagkraft:  '#E05252',
  trittkraft:   '#E07A52',
  ausdauer:     '#52A86E',
  schulter:     '#4A90D9',
  nackenhals:   '#52A8A8',
  griffkraft:   '#A06428',
  beinarbeit:   '#D4B942',
  koordination: '#C052A8',
  mobilitaet:   '#7DC452',
  bjj:          '#7B52C4',
  k1:           '#C42828',
  mma:          '#1A5296',
  ringen:       '#1A7A3C',
  sonstige:     '#8A8A8A',
};

const FALLBACK_COLORS = ['#4A90D9', '#E05252', '#52A86E', '#E07A52', '#7B52C4', '#52A8A8'];

const SCREEN_W   = Dimensions.get('window').width;
const CARD_W     = SCREEN_W - 32;          // 16px margin each side
const PLOT_W     = CARD_W - 32;            // 16px card padding each side
const PLOT_H     = 96;
const PAD_TOP    = 8;
const X_H        = 24;
const MAX_WEEKS  = 16;

function typeColor(type: string, fallbackIdx: number): string {
  return TYPE_COLORS[type] ?? FALLBACK_COLORS[fallbackIdx % FALLBACK_COLORS.length];
}

interface MiniChartProps {
  types: string[];
  typeColors: string[];
  // values[typeIdx][weekIdx] = points
  values: number[][];
  weekLabels: string[];
}

function MiniChart({ types, typeColors, values, weekLabels }: MiniChartProps): React.ReactElement {
  const n = weekLabels.length;
  if (n === 0) return <View />;

  const maxVal = Math.max(1, ...values.flat());

  function toX(i: number): number {
    return (i / Math.max(n - 1, 1)) * PLOT_W;
  }
  function toY(pts: number): number {
    return PAD_TOP + (1 - pts / maxVal) * PLOT_H;
  }

  // Show label every N weeks
  const every = n > 12 ? 4 : n > 6 ? 2 : 1;

  return (
    <View>
      <Svg width={PLOT_W} height={PAD_TOP + PLOT_H}>
        {/* Grid lines at 0%, 50%, 100% */}
        {[0, 0.5, 1].map((frac) => {
          const y = PAD_TOP + (1 - frac) * PLOT_H;
          return (
            <Line
              key={frac}
              x1={0} y1={y} x2={PLOT_W} y2={y}
              stroke={colors.border}
              strokeWidth={1}
            />
          );
        })}

        {/* Lines + dots per type */}
        {values.map((vals, ti) => {
          const pts = vals.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
          return (
            <React.Fragment key={types[ti]}>
              <Polyline
                points={pts}
                fill="none"
                stroke={typeColors[ti]}
                strokeWidth={2}
                strokeLinejoin="round"
              />
              {vals.map((v, i) =>
                v > 0 ? (
                  <Circle
                    key={i}
                    cx={toX(i)}
                    cy={toY(v)}
                    r={3}
                    fill={typeColors[ti]}
                  />
                ) : null,
              )}
            </React.Fragment>
          );
        })}
      </Svg>

      {/* X labels */}
      <View style={[xStyles.row, { width: PLOT_W }]}>
        {weekLabels.map((label, i) =>
          i % every === 0 ? (
            <Text
              key={i}
              style={[xStyles.label, { left: toX(i) - 16 }]}
            >
              {label.split(' – ')[0]}
            </Text>
          ) : null,
        )}
      </View>
    </View>
  );
}

const xStyles = StyleSheet.create({
  row: { height: X_H, position: 'relative' },
  label: {
    position: 'absolute',
    fontSize: 10,
    color: colors.textSecondary,
    width: 32,
    textAlign: 'center',
  },
});

export default function WorkoutHistoryScreen(): React.ReactElement {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { weeks, loading } = useWorkoutHistory();

  const displayWeeks = useMemo(() => weeks.slice(-MAX_WEEKS), [weeks]);

  const allTypes = useMemo(() => {
    const seen = new Set<string>();
    for (const week of displayWeeks) {
      for (const seg of week.segments) {
        if (seg.type !== 'zirkel') seen.add(seg.type);
      }
    }
    return Array.from(seen);
  }, [displayWeeks]);

  // Group types into pairs: [[t1,t2],[t3,t4],...]
  const pairs = useMemo<string[][]>(() => {
    const result: string[][] = [];
    for (let i = 0; i < allTypes.length; i += 2) {
      result.push(allTypes.slice(i, i + 2));
    }
    // Pad to 6 cards if fewer types exist
    while (result.length < 6 && result.length < Math.ceil(allTypes.length / 2)) {
      break;
    }
    return result.slice(0, 6);
  }, [allTypes]);

  const weekLabels = useMemo(
    () => displayWeeks.map((w) => w.weekLabel),
    [displayWeeks],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Workouts</Text>
        <View style={styles.backBtnPlaceholder} />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.accentBlue} />
        </View>
      ) : weeks.length === 0 ? (
        <View style={styles.loader}>
          <Text style={styles.emptyText}>Noch keine Workouts abgeschlossen.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {pairs.map((pair, pi) => (
            <View key={pi} style={styles.card}>
              {/* Card header: type labels */}
              <View style={styles.cardHeader}>
                {pair.map((type, ti) => (
                  <View key={type} style={styles.typeTag}>
                    <View
                      style={[
                        styles.typeDot,
                        { backgroundColor: typeColor(type, pi * 2 + ti) },
                      ]}
                    />
                    <Text style={styles.typeLabel}>{type}</Text>
                  </View>
                ))}
              </View>

              {/* Mini line chart */}
              <MiniChart
                types={pair}
                typeColors={pair.map((t, ti) => typeColor(t, pi * 2 + ti))}
                values={pair.map((type) =>
                  displayWeeks.map((week) => {
                    const seg = week.segments.find((s) => s.type === type);
                    return seg?.points ?? 0;
                  }),
                )}
                weekLabels={weekLabels}
              />
            </View>
          ))}
          <View style={styles.bottomPad} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPlaceholder: {
    width: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    textTransform: 'capitalize',
  },
  bottomPad: {
    height: 48,
  },
});
