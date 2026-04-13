import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { colors } from '../../theme/colors';

// ─── Types ────────────────────────────────────────────────────────────────────

type ExtraUnit = {
  id: string;
  title: string;
  description: string;
  duration: string;
};

// ─── Dummy data ───────────────────────────────────────────────────────────────

const EXTRA_UNITS: ExtraUnit[] = [
  { id: '1', title: 'Joggen',           description: 'Grundlagenausdauer',                  duration: '30–60 Min' },
  { id: '2', title: 'Schwimmen',        description: 'Ganzkörper & Erholung',               duration: '45 Min'    },
  { id: '3', title: 'Dehnen',           description: 'Mobilität und Verletzungsprävention', duration: '20 Min'    },
  { id: '4', title: 'HIIT',             description: 'Intensive Intervalle',                duration: '25 Min'    },
  { id: '5', title: 'Gym – Kraft',      description: 'Zusatzkraft für Kampfsport',          duration: '60 Min'    },
  { id: '6', title: 'Seilspringen',     description: 'Koordination und Cardio',             duration: '15 Min'    },
  { id: '7', title: 'Radfahren',        description: 'Gelenkschonendes Ausdauertraining',   duration: '45 Min'    },
  { id: '8', title: 'Sauna & Recovery', description: 'Aktive Regeneration',                 duration: '30 Min'    },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExtraTab() {
  const [done, setDone] = useState<Set<string>>(new Set());

  function toggleDone(id: string): void {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {EXTRA_UNITS.map((unit) => {
        const isDone = done.has(unit.id);
        return (
          <View key={unit.id} style={styles.card}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>{unit.title}</Text>
              <Text style={styles.cardMeta}>
                {unit.description} · {unit.duration}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.button, isDone && styles.buttonDone]}
              onPress={() => toggleDone(unit.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.buttonLabel, isDone && styles.buttonLabelDone]}>
                {isDone ? 'Absolviert' : 'Erledigt'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  cardMeta: {
    fontSize: 12,
    color: colors.inactive,
    fontWeight: '400',
  },

  // Toggle button
  button: {
    borderWidth: 1.5,
    borderColor: colors.headerBg,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  buttonDone: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  buttonLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.headerBg,
  },
  buttonLabelDone: {
    color: '#FFFFFF',
  },
});
