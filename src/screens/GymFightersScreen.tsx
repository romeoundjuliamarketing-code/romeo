import { useTranslation } from 'react-i18next';
import React, { useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';
import { useGymFighters } from '../hooks/useGyms';
import type { GymFighter } from '../hooks/useGyms';
import ProfilePhoto from '../components/profil/ProfilePhoto';
import { RetryNotice } from '../components/common/TextAction';

type Nav = NativeStackNavigationProp<RootStackParamList, 'GymFighters'>;
type Route = RouteProp<RootStackParamList, 'GymFighters'>;

const ROW_HEIGHT = 72;

// All fighters who name this gym as their main gym — virtualised and paged
// (20 per page) as the list scrolls. Not an official member list.
export default function GymFightersScreen(): React.ReactElement {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { gymId, gymName } = useRoute<Route>().params;
  const { fighters, status, hasMore, loadingMore, loadMore, retry } = useGymFighters(gymId);

  const renderItem = useCallback(({ item }: { item: GymFighter }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => navigation.push('PublicProfile', { userId: item.id })}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={t('gym.fightersPreview.profileOf', { name: item.name ?? t('gym.fightersPreview.fighterFallback') })}
    >
      <ProfilePhoto uri={item.avatar_url} name={item.name} size={48} />
      <View style={styles.flex}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        {item.disciplines.length > 0 && (
          <Text style={styles.muted} numberOfLines={1}>{item.disciplines.join(', ')}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  ), [navigation, t]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.flex}>
          <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>{t('gym.fighters.title')}</Text>
          <Text style={styles.muted} numberOfLines={1}>{gymName}</Text>
        </View>
      </View>

      {fighters.length === 0 ? (
        <View style={styles.state}>
          {status === 'loading' ? <ActivityIndicator color={colors.accentBlue} /> : status === 'error' ? (
            <RetryNotice message={t('gym.fightersPreview.loadError')} onRetry={retry} />
          ) : (
            <Text style={styles.muted}>{t('gym.fightersPreview.empty')}</Text>
          )}
        </View>
      ) : (
        <FlatList
          data={fighters}
          keyExtractor={(f) => f.id}
          renderItem={renderItem}
          ItemSeparatorComponent={Separator}
          ListHeaderComponent={<Text style={[styles.muted, styles.header]}>{t('gym.fighters.header')}</Text>}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} color={colors.accentBlue} /> : null}
          onEndReached={() => { if (hasMore) loadMore(); }}
          onEndReachedThreshold={0.5}
          contentContainerStyle={styles.list}
          initialNumToRender={12}
          windowSize={7}
        />
      )}
    </SafeAreaView>
  );
}

function Separator(): React.ReactElement {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
  },
  toolbar: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 8,
    paddingRight:      16,
    minHeight:         56,
  },
  iconBtn: {
    width:          44,
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
  },
  title: {
    fontSize:   18,
    fontWeight: '800',
    color:      colors.text,
  },
  flex: {
    flex: 1,
  },
  state: {
    flex:    1,
    padding: 16,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom:     48,
  },
  header: {
    paddingBottom: 8,
  },
  footer: {
    marginVertical: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           16,
    minHeight:       ROW_HEIGHT,
    paddingVertical: 8,
  },
  separator: {
    height:          1,
    backgroundColor: colors.hairline,
  },
  name: {
    fontSize:   16,
    fontWeight: '700',
    color:      colors.text,
  },
  muted: {
    fontSize:   14,
    lineHeight: 20,
    color:      colors.textMuted,
  },
});
