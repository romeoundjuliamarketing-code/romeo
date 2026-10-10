import React from 'react';
import { View, Text, Image, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';

interface Props {
  notes:      string | null;
  accessNote: string | null;
}

const COACH = require('../../../assets/coach/einladend.png');

// Shown while nobody has written yet: a small coach with a short invitation,
// then the organizer's notes and gym access hint if there are any.
function SparringChatEmptyState({ notes, accessNote }: Props) {
  const { t } = useTranslation();
  const n = notes?.trim() ?? '';
  const a = accessNote?.trim() ?? '';

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      <View style={styles.invite}>
        <Image source={COACH} style={styles.coach} resizeMode="contain" accessibilityIgnoresInvertColors />
        <Text style={styles.inviteText}>{t('chat.sparring.emptyInvite')}</Text>
      </View>

      {n.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.label}>{t('chat.summary.notes')}</Text>
          <Text style={styles.text}>{n}</Text>
        </View>
      )}
      {a.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.label}>{t('chat.summary.access')}</Text>
          <Text style={styles.text}>{a}</Text>
        </View>
      )}
    </ScrollView>
  );
}

export default React.memo(SparringChatEmptyState);

const styles = StyleSheet.create({
  content: {
    flexGrow:       1,
    justifyContent: 'flex-end',
    padding:        16,
    paddingBottom:  24,
    gap:            16,
  },
  invite: {
    alignItems:        'center',
    paddingHorizontal: 24,
    paddingBottom:     8,
    gap:               8,
  },
  coach: {
    width:  64,
    height: 96,
  },
  inviteText: {
    fontSize:   16,
    lineHeight: 24,
    fontWeight: '500',
    color:      colors.text,
    textAlign:  'center',
  },
  block: {
    padding:         16,
    borderRadius:    16,
    backgroundColor: colors.card,
  },
  label: {
    fontSize:      12,
    fontWeight:    '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color:         colors.textMuted,
    marginBottom:  8,
  },
  text: {
    fontSize:   15,
    lineHeight: 22,
    color:      colors.text,
  },
});
