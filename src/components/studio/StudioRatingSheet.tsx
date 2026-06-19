import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useStudioRatings } from '../../hooks/useStudioRatings';

const MAX_COMMENT = 200;

interface Props {
  visible:    boolean;
  studioId:   string;
  studioName: string;
  onClose:    () => void;
  onSubmitted: () => void;
}

export default function StudioRatingSheet({
  visible,
  studioId,
  studioName,
  onClose,
  onSubmitted,
}: Props): React.ReactElement {
  const { existingRating, submitRating } = useStudioRatings(studioId);

  const [stars,   setStars]   = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  // Prefill with the user's existing rating once it loads — guarded so a later
  // refetch never clobbers an edit the user has already started.
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!prefilledRef.current && existingRating !== null) {
      prefilledRef.current = true;
      setStars(existingRating.stars);
      setComment(existingRating.comment);
    }
  }, [existingRating]);

  async function handleSubmit(): Promise<void> {
    if (stars < 1) {
      Alert.alert('Bewertung', 'Bitte vergib mindestens einen Stern.');
      return;
    }

    setLoading(true);
    const { error } = await submitRating(studioId, stars, comment.trim());
    setLoading(false);

    if (error !== null) {
      Alert.alert('Fehler', error);
      return;
    }

    onSubmitted();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.headerRow}>
          <Text style={styles.heading}>Studio bewerten</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.studioName}>{studioName}</Text>

          <Text style={styles.label}>Deine Bewertung</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => setStars(n)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={n <= stars ? 'star' : 'star-outline'}
                  size={36}
                  color={n <= stars ? colors.accentBlue : colors.border}
                />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Kommentar (optional)</Text>
          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={(t) => setComment(t.slice(0, MAX_COMMENT))}
            placeholder="Wie war dein Training, die Atmosphäre, die Trainer?"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={3}
          />
          <Text style={styles.counter}>{comment.length}/{MAX_COMMENT}</Text>

          <TouchableOpacity
            style={[styles.confirmBtn, (loading || stars < 1) && styles.confirmBtnDisabled]}
            onPress={() => { void handleSubmit(); }}
            disabled={loading || stars < 1}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.card} />
            ) : (
              <Text style={styles.confirmBtnText}>
                {existingRating !== null ? 'Bewertung aktualisieren' : 'Bewertung senden'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.bottomPad} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.mapOverlay,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '88%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  studioName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 24,
    marginBottom: 8,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  commentInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    height: 80,
    textAlignVertical: 'top',
  },
  counter: {
    fontSize: 12,
    color: colors.textSecondary,
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  confirmBtn: {
    backgroundColor: colors.accentBlue,
    borderRadius: 14,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.card,
  },
  bottomPad: {
    height: 16,
  },
});
