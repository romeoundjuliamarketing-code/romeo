import React, { useRef } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Platform, ScrollView } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { colors } from '../../theme/colors';
import type { WeightEntry } from '../../hooks/useWeight';

interface Props {
  history: WeightEntry[];
}

// Formats a ISO date (YYYY-MM-DD) as "KW N"
function toKW(dateStr: string): string {
  const d = new Date(dateStr);
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86_400_000 + startOfYear.getDay() + 1) / 7);
  return `KW ${week}`;
}

const CARD_RADIUS = 16;
const CHART_PADDING = 16;
// Fixed pixel budget per data point — wide enough that labels never overlap
const PER_POINT_WIDTH = 72;

const cardShadow = Platform.select({
  ios: {
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
});

export default function WeightChartCard({ history }: Props): React.ReactElement | null {
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  if (history.length < 2) return null;

  const weights = history.map((e) => e.weightKg);
  const labels  = history.map((e) => toKW(e.weekStart));

  // Available width inside the card (screen - outer padding - card padding)
  const innerWidth = Math.min(windowWidth, 600) - 32 - CHART_PADDING * 2;
  // Chart is at least wide enough to fill the card; grows with more data points
  const chartWidth = Math.max(PER_POINT_WIDTH * history.length, innerWidth);

  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const yMin = Math.max(0, Math.floor(minWeight - 2));
  const yMax = Math.ceil(maxWeight + 2);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Gewichtsverlauf</Text>
      <Text style={styles.subtitle}>{history.length} Einträge · kg · seitlich scrollen</Text>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        // Scroll to the most recent (rightmost) entry once content is laid out
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        <LineChart
          data={{
            labels,
            datasets: [{ data: weights }],
          }}
          width={chartWidth}
          height={180}
          yAxisSuffix=" kg"
          fromZero={false}
          chartConfig={{
            backgroundColor: '#FFFFFF',
            backgroundGradientFrom: '#FFFFFF',
            backgroundGradientTo: '#FFFFFF',
            decimalPlaces: 1,
            color: () => colors.accentBlue,
            labelColor: () => colors.inactive,
            propsForDots: {
              r: '4',
              strokeWidth: '2',
              stroke: colors.accentBlue,
            },
            propsForBackgroundLines: {
              stroke: colors.border,
              strokeDasharray: '4',
            },
          }}
          bezier
          style={styles.chart}
          yLabelsOffset={8}
          segments={4}
          fromNumber={yMax}
          // @ts-expect-error react-native-chart-kit doesn't expose yMin/yMax in types
          yMin={yMin}
          yMax={yMax}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    padding: CHART_PADDING,
    marginBottom: 16,
    ...cardShadow,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: colors.inactive,
    fontWeight: '400',
    marginBottom: 12,
  },
  chart: {
    marginLeft: -8,
    borderRadius: 8,
  },
});
