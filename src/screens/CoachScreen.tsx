import React, { useCallback, useRef, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useCoachChat } from '../hooks/useCoachChat';
import { useFitnessRatings } from '../hooks/useFitnessRatings';

// ─── Component ────────────────────────────────────────────────────────────────

export default function CoachScreen() {
  const [message, setMessage] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const { messages, loading, remaining, sendMessage } = useCoachChat();
  const { ratings } = useFitnessRatings();

  const handleContentSizeChange = useCallback(
    () => scrollRef.current?.scrollToEnd({ animated: true }),
    [],
  );

  function handleSend(): void {
    if (message.trim().length === 0 || loading) return;
    sendMessage(message.trim());
    setMessage('');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={handleContentSizeChange}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>KI Coach</Text>
            <Text style={styles.headerSubtitle}>KI-gestützte Empfehlungen</Text>
          </View>

          {/* ── Fitness Ratings ── */}
          <Text style={styles.sectionTitle}>Fitness-Profil</Text>
          <View style={styles.ratingsCard}>
            {ratings.length === 0 ? (
              <Text style={styles.ratingsEmpty}>Noch keine Trainings in den letzten 30 Tagen.</Text>
            ) : (
              ratings.map((rating) => (
                <View key={rating.group} style={styles.ratingRow}>
                  <Text style={styles.ratingLabel}>{rating.label}</Text>
                  <View style={styles.barTrack}>
                    {/* Dynamic width is unavoidable for data-driven bars */}
                    <View style={[styles.barFill, { width: `${rating.score}%` }]} />
                  </View>
                  <Text style={styles.ratingValue}>{rating.count}</Text>
                </View>
              ))
            )}
          </View>

          {/* ── Chat Messages ── */}
          {(messages.length > 0 || loading) && (
            <View style={styles.chatSection}>
              <Text style={styles.sectionTitle}>Chat</Text>
              {messages.map((msg) => (
                <View key={msg.id} style={msg.role === 'user' ? styles.bubbleRowUser : styles.bubbleRowCoach}>
                  <View style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleCoach]}>
                    <Text style={[styles.bubbleText, msg.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextCoach]}>
                      {msg.text}
                    </Text>
                  </View>
                </View>
              ))}
              {loading && (
                <Text style={styles.typingText}>Coach tippt...</Text>
              )}
            </View>
          )}
        </ScrollView>

        {/* ── Chat Input ── */}
        <View style={styles.inputWrap}>
          {remaining !== null && remaining <= 3 && remaining > 0 && (
            <Text style={styles.limitHint}>Noch {remaining} Nachrichten heute</Text>
          )}
          {remaining === 0 && (
            <Text style={styles.limitHint}>Tageslimit erreicht. Morgen wieder verfügbar.</Text>
          )}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Frag deinen Coach..."
              placeholderTextColor={colors.headerTextSecondary}
              value={message}
              onChangeText={setMessage}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              editable={remaining !== 0}
            />
            <TouchableOpacity
              style={[styles.sendButton, (loading || remaining === 0) && styles.sendButtonDisabled]}
              onPress={handleSend}
              activeOpacity={0.8}
              disabled={loading || remaining === 0}
            >
              <Ionicons name="send" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
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
    paddingTop: 0,
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
  ratingsEmpty: {
    fontSize: 13,
    color: colors.headerTextSecondary,
    fontWeight: '400',
  },

  // Chat input
  inputWrap: {
    backgroundColor: colors.headerCard,
    borderTopWidth: 1,
    borderTopColor: colors.headerBorder,
  },
  limitHint: {
    fontSize: 11,
    color: colors.headerTextSecondary,
    textAlign: 'center',
    paddingTop: 8,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  sendButtonDisabled: {
    opacity: 0.5,
  },

  // Chat messages
  chatSection: {
    marginTop: 16,
  },
  bubbleRowUser: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  bubbleRowCoach: {
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bubble: {
    borderRadius: 16,
    padding: 12,
    maxWidth: '80%',
  },
  bubbleUser: {
    backgroundColor: colors.accentBlue,
  },
  bubbleCoach: {
    backgroundColor: colors.headerCard,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextUser: {
    color: '#FFFFFF',
  },
  bubbleTextCoach: {
    color: colors.headerTextPrimary,
  },
  typingText: {
    fontSize: 13,
    color: colors.headerTextSecondary,
    marginBottom: 8,
  },

  // Workout link card (below coach bubble)
  workoutLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.headerCard,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.accentBlue,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 6,
    maxWidth: '80%',
  },
  workoutLinkBody: {
    flex: 1,
    gap: 2,
  },
  workoutLinkTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.headerTextPrimary,
  },
  workoutLinkMeta: {
    fontSize: 11,
    color: colors.headerTextSecondary,
    fontWeight: '400',
  },
});
