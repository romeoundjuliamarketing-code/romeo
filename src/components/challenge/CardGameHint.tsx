import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

export default function CardGameHint(): React.ReactElement | null {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (user === null) return;
    let active = true;
    void AsyncStorage.getItem(`sparr.cards.hintSeen.v1:${user.id}`)
      .then((seen) => { if (active) setVisible(seen !== 'true'); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [user?.id]);

  if (!visible || user === null) return null;

  function dismiss(): void {
    if (user === null) return;
    setVisible(false);
    void AsyncStorage.setItem(`sparr.cards.hintSeen.v1:${user.id}`, 'true').catch(() => undefined);
  }

  return (
    <View style={styles.hint}>
      <Text style={styles.text}>Probier die Übung aus. Du musst sie nicht sofort beherrschen. Bereite Chancen vor, statt Treffer zu erzwingen.</Text>
      <TouchableOpacity style={styles.close} onPress={dismiss} accessibilityRole="button" accessibilityLabel="Hinweis schließen">
        <Ionicons name="close" size={20} color={colors.card} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { backgroundColor: colors.accentBlueText, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { flex: 1, color: colors.card, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
