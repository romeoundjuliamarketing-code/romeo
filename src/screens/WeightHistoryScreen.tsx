import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import WeightChartCard from '../components/profil/WeightChartCard';
import { useWeight } from '../hooks/useWeight';

export default function WeightHistoryScreen(): React.ReactElement {
  const navigation = useNavigation();
  const { history } = useWeight();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Gewichtsverlauf</Text>
        <View style={styles.backBtnPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {history.length < 2 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Noch zu wenige Einträge</Text>
            <Text style={styles.emptySubtitle}>
              Trage jede Woche dein Gewicht ein. Ab zwei Einträgen siehst du hier deinen Verlauf.
            </Text>
          </View>
        ) : (
          <WeightChartCard history={history} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 32,
    alignItems: 'flex-start',
  },
  backBtnPlaceholder: {
    width: 32,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  content: {
    padding: 16,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  empty: {
    marginTop: 48,
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.inactive,
    textAlign: 'center',
    lineHeight: 20,
  },
});
