import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useNotificationsContext } from '../context/NotificationsContext';
import NotificationRow from '../components/notifications/NotificationRow';
import type { AppNotification } from '../types/database.types';
import type { RootStackParamList } from '../navigation/types';

export default function NotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { notifications, loading, refetch, markAllRead } = useNotificationsContext();

  // Mark all read and refetch when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      void markAllRead();
    }, [markAllRead]),
  );

  // Sparring-related notifications carry data.sparring_id — tap opens the
  // matching detail sheet on the map (fallback fetch handles started/past
  // sparrings not in the upcoming list, see useOpenSparrings.fetchSparringById).
  function handlePressNotification(item: AppNotification): void {
    const sparringId = item.data.sparring_id;
    if (typeof sparringId === 'string') {
      navigation.navigate('SparringMap', { focusSparringId: sparringId });
    }
  }

  function renderItem({ item }: { item: AppNotification }) {
    return <NotificationRow item={item} onPress={handlePressNotification} />;
  }

  function keyExtractor(item: AppNotification) {
    return item.id;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Benachrichtigungen</Text>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accentBlue} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={48} color={colors.inactive} />
          <Text style={styles.emptyText}>Keine Benachrichtigungen</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          style={styles.list}
          onRefresh={() => { refetch(); }}
          refreshing={loading}
        />
      )}
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  backButton: {
    width: 32,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  headerRight: {
    width: 32,
  },
  list: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    color: colors.inactive,
  },
});
