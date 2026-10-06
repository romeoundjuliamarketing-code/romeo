import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { RetryNotice } from '../common/TextAction';
import type { LoadStatus } from '../../hooks/useGyms';

// Gym page before the gym is there: loading, error with retry, or gone.
export default function GymPageState({ status, onBack, onRetry }: {
  status:  LoadStatus;
  onBack:  () => void;
  onRetry: () => void;
}): React.ReactElement {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={onBack} accessibilityRole="button" accessibilityLabel="Zurück">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.center}>
        {status === 'loading' ? <ActivityIndicator color={colors.accentBlue} /> : status === 'error' ? (
          <RetryNotice message="Das Gym konnte nicht geladen werden." onRetry={onRetry} />
        ) : (
          <Text style={styles.muted}>Dieses Gym gibt es nicht mehr.</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
  },
  toolbar: {
    paddingHorizontal: 8,
    minHeight:         48,
    justifyContent:    'center',
  },
  iconBtn: {
    width:          44,
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
  },
  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        24,
  },
  muted: {
    fontSize:   14,
    lineHeight: 20,
    color:      colors.textMuted,
  },
});
