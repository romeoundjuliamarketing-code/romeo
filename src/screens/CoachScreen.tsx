import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

// ─── Dummy data ───────────────────────────────────────────────────────────────

const RECOMMENDATIONS = [
  {
    id: '1',
    category: 'Schulterausdauer',
    tip: 'Deine Schulterrotation zeigt Ermuedungserscheinungen. Integriere täglich 3 Sätze Theraband-Kreise zur Stabilisierung.',
  },
  {
    id: '2',
    category: 'Schlagkraft',
    tip: 'Plyometrische Übungen steigern deine explosive Kraft. Zwei gezielte Einheiten pro Woche sind ausreichend.',
  },
  {
    id: '3',
    category: 'Cardio-Basis',
    tip: 'Dein Herzfrequenz-Profil empfiehlt Zonentraining. Zone 2 dreimal pro Woche für jeweils 30 Minuten.',
  },
];

const RATINGS: { label: string; value: number }[] = [
  { label: 'Schlagkraft', value: 78 },
  { label: 'Trittkraft',  value: 65 },
  { label: 'Schulter',    value: 52 },
  { label: 'Cardio',      value: 85 },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function CoachScreen() {
  const [message, setMessage] = useState('');

  function handleSend(): void {
    if (message.trim().length === 0) return;
    setMessage('');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Dein Coach</Text>
            <Text style={styles.headerSubtitle}>KI-gestützte Empfehlungen</Text>
          </View>

          {/* ── Recommendations ── */}
          <Text style={styles.sectionTitle}>Empfehlungen</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cardRow}
            style={styles.cardScroll}
          >
            {RECOMMENDATIONS.map((rec) => (
              <View key={rec.id} style={styles.recCard}>
                <Text style={styles.recCategory}>{rec.category}</Text>
                <Text style={styles.recTip}>{rec.tip}</Text>
                <TouchableOpacity style={styles.recButton} activeOpacity={0.8}>
                  <Text style={styles.recButtonText}>Übung ansehen</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          {/* ── Last Rating ── */}
          <Text style={styles.sectionTitle}>Letzte Bewertung</Text>
          <View style={styles.ratingsCard}>
            {RATINGS.map((rating) => (
              <View key={rating.label} style={styles.ratingRow}>
                <Text style={styles.ratingLabel}>{rating.label}</Text>
                <View style={styles.barTrack}>
                  {/* Dynamic width is unavoidable for data-driven bars */}
                  <View style={[styles.barFill, { width: `${rating.value}%` }]} />
                </View>
                <Text style={styles.ratingValue}>{rating.value}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* ── Chat Input ── */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Frag deinen Coach..."
            placeholderTextColor={colors.headerTextSecondary}
            value={message}
            onChangeText={setMessage}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend} activeOpacity={0.8}>
            <MaterialCommunityIcons name="send" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_RADIUS = 16;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.headerBg,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },

  // Header
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.headerTextPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.headerTextSecondary,
    fontWeight: '400',
  },

  // Section titles
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.headerTextPrimary,
    marginBottom: 12,
  },

  // Recommendation cards (horizontal scroll)
  cardScroll: {
    marginBottom: 32,
    marginHorizontal: -16,
  },
  cardRow: {
    paddingHorizontal: 16,
    gap: 12,
  },
  recCard: {
    width: 240,
    backgroundColor: colors.headerCard,
    borderRadius: CARD_RADIUS,
    padding: 16,
  },
  recCategory: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accentBlue,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  recTip: {
    fontSize: 14,
    color: colors.headerTextPrimary,
    lineHeight: 20,
    flex: 1,
    marginBottom: 16,
  },
  recButton: {
    backgroundColor: colors.accentBlue,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  recButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  // Ratings
  ratingsCard: {
    backgroundColor: colors.headerCard,
    borderRadius: CARD_RADIUS,
    padding: 16,
    gap: 16,
    marginBottom: 16,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.headerTextPrimary,
    width: 88,
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.headerBorder,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    backgroundColor: colors.accentBlue,
    borderRadius: 4,
  },
  ratingValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.headerTextSecondary,
    width: 24,
    textAlign: 'right',
  },

  // Chat input
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.headerCard,
    borderTopWidth: 1,
    borderTopColor: colors.headerBorder,
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: colors.headerDotFuture,
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 14,
    color: colors.headerTextPrimary,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
