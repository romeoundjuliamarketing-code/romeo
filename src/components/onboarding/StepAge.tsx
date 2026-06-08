import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { colors } from '../../theme/colors';

const MIN_AGE = 14;
const MAX_AGE = 70;
const AGES = Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => MIN_AGE + i);

const ITEM_WIDTH = 64;
const ITEM_GAP = 8;

interface Props {
  value: number | null;
  onChange: (age: number) => void;
}

export default function StepAge({ value, onChange }: Props) {
  const scrollRef = useRef<ScrollView>(null);

  const handleSelect = (age: number) => {
    onChange(age);
    // Scroll selected age into center
    const index = age - MIN_AGE;
    const offset = index * (ITEM_WIDTH + ITEM_GAP) - 100;
    scrollRef.current?.scrollTo({ x: Math.max(0, offset), animated: true });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        decelerationRate="fast"
      >
        {AGES.map((age) => {
          const active = value === age;
          return (
            <TouchableOpacity
              key={age}
              style={[styles.item, active && styles.itemActive]}
              onPress={() => handleSelect(age)}
              activeOpacity={0.75}
            >
              <Text style={[styles.itemText, active && styles.itemTextActive]}>
                {age}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <Text style={styles.unit}>Jahre</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  scroll: {
    paddingHorizontal: 24,
    gap: ITEM_GAP,
    alignItems: 'center',
  },
  item: {
    width: ITEM_WIDTH,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  itemActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  itemText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  itemTextActive: {
    color: '#FFFFFF',
  },
  unit: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
});
