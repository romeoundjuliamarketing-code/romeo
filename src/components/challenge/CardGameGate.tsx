import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useEntitlement } from '../../hooks/useEntitlement';
import { colors } from '../../theme/colors';
import { useTranslation } from 'react-i18next';

export default function CardGameGate({ children }: { children: React.ReactNode }): React.ReactElement {
  const { t } = useTranslation();
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
    return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.body}>{t('challenge.gate.checkFailed')}</Text><TouchableOpacity style={styles.button} onPress={() => { void refetch(); }} accessibilityRole="button"><Text style={styles.buttonText}>{t('common.retry')}</Text></TouchableOpacity></View></SafeAreaView>;
  }
  if (entitlement.hasAccess) return <>{children}</>;
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <Text style={styles.title}>{t('challenge.gate.title')}</Text>
        <Text style={styles.body}>{t('challenge.gate.body')}</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Paywall', { focus: 'cards' })} accessibilityRole="button">
          <Text style={styles.buttonText}>{t('challenge.gate.offers')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.backText}>{t('challenge.gate.backToCards')}</Text>
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
