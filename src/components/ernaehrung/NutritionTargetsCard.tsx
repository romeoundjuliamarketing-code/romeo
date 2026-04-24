import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import type { NutritionPlan } from '../../utils/nutritionEngine';

interface NutritionTargetsCardProps {
  titleSuffix:        string;
  plan:               NutritionPlan | null;
  loading:            boolean;
  missingProfileData: string[];
  infoText:           string | null;
}

export default function NutritionTargetsCard({
  titleSuffix,
  plan,
  loading,
  missingProfileData,
  infoText,
}: NutritionTargetsCardProps) {
  function val(n: number | undefined): string {
    if (loading || n === undefined) return '—';
    return String(n);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Makros {titleSuffix}</Text>

      <View style={styles.row}>
        <View style={[styles.tile, styles.tileWide]}>
          <Text style={styles.tileLabel}>Tageskalorien</Text>
          <Text style={styles.tileValue}>
            {loading || plan === null ? '—' : `${plan.kcalPerDay} kcal`}
          </Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>Protein</Text>
          <Text style={styles.tileValue}>{val(plan?.proteinGrams)} g</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>Fett</Text>
          <Text style={styles.tileValue}>{val(plan?.fatGrams)} g</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>Kohlenhydrate</Text>
          <Text style={styles.tileValue}>{val(plan?.carbsGrams)} g</Text>
        </View>
      </View>

      {missingProfileData.length > 0 && (
        <Text style={styles.hintText}>
          Fehlende Daten: {missingProfileData.join(', ')}
        </Text>
      )}

      {infoText !== null && infoText.length > 0 && (
        <Text style={styles.hintText}>{infoText}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  tileWide: {
    flex: 1.4,
  },
  tileLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.inactive,
  },
  tileValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  hintText: {
    fontSize: 12,
    color: colors.inactive,
    fontWeight: '500',
  },
});
