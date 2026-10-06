import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import SparringRulesContent from '../components/sparring/SparringRulesContent';
import { useTranslation } from 'react-i18next';

// Full Sparr-Grundregeln, reachable from Einstellungen > Rechtliches. The
// consent sheet shows the same text as an in-sheet overlay instead.
export default function SparringRulesScreen(): React.ReactElement {
  const { t } = useTranslation();
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={18} color={colors.headerTextPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('sparring.consent.rulesTitle')}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SparringRulesContent />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor:   colors.dark,
    paddingHorizontal: 16,
    paddingTop:        8,
    paddingBottom:     24,
    gap:               16,
  },
  backBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: colors.headerCard,
    alignItems:      'center',
    justifyContent:  'center',
  },
  headerTitle: {
    color:      colors.headerTextPrimary,
    fontSize:   22,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop:        24,
    paddingBottom:     48,
  },
});
