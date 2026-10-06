import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useEntitlement } from '../../hooks/useEntitlement';
import { colors } from '../../theme/colors';

export default function CardGameGate({ children }: { children: React.ReactNode }): React.ReactElement {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { entitlement, loading, error, refetch } = useEntitlement();
  const firstFocus = useRef(true);
  const [checking, setChecking] = useState(false);

  useFocusEffect(useCallback(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    let active = true;
    setChecking(true);
    void refetch().finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [refetch]));

  if (loading || checking) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={colors.accentBlue} /></View></SafeAreaView>;
  }
  if (error) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.body}>Dein Zugang konnte gerade nicht geprüft werden.</Text><TouchableOpacity style={styles.button} onPress={() => { void refetch(); }} accessibilityRole="button"><Text style={styles.buttonText}>Erneut versuchen</Text></TouchableOpacity></View></SafeAreaView>;
  }
  if (entitlement.hasAccess) return <>{children}</>;
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <Text style={styles.title}>Kartenspiel freischalten</Text>
        <Text style={styles.body}>Die Karten für Kickboxen / K1 sind im Sparr Abo enthalten.</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Paywall', { focus: 'cards' })} accessibilityRole="button">
          <Text style={styles.buttonText}>Abo-Angebote ansehen</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.backText}>Zurück zu Karten</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  title: { color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 26, lineHeight: 34 },
  body: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 24 },
  button: { backgroundColor: colors.accentBlue, borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonText: { color: colors.card, fontFamily: 'Inter_700Bold', fontSize: 15 },
  back: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.accentBlueText, fontFamily: 'Inter_600SemiBold', fontSize: 15 },
});
