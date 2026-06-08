import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { useSparringChatList } from '../hooks/useSparringChatList';
import SparringChatListItem from '../components/chat/SparringChatListItem';
import type { RootStackParamList } from '../navigation/types';
import type { SparringChatEntry } from '../hooks/useSparringChatList';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SparringChatListScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { chats, loading } = useSparringChatList();

  const active = useMemo(
    () => chats.filter((c) => new Date(c.scheduledAt).getTime() + c.durationMin * 60_000 >= Date.now()),
    [chats],
  );
  const archived = useMemo(
    () => chats.filter((c) => new Date(c.scheduledAt).getTime() + c.durationMin * 60_000 < Date.now()),
    [chats],
  );

  function openChat(item: SparringChatEntry) {
    navigation.navigate('SparringGroupChat', {
      sparringId:    item.sparringId,
      sparringTitle: item.sparringTitle,
      scheduledAt:   item.scheduledAt,
      durationMin:   item.durationMin,
      isOrganizer:   item.isOrganizer,
    });
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Sparring-Chats</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.accentBlue} />
      ) : (
        <FlatList
          data={active}
          keyExtractor={(item) => item.sparringId}
          renderItem={({ item }) => (
            <SparringChatListItem item={item} onPress={() => openChat(item)} />
          )}
          ListHeaderComponent={active.length > 0 ? <Text style={styles.sectionLabel}>Aktiv</Text> : null}
          ListFooterComponent={
            archived.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>Archiv</Text>
                {archived.map((item) => (
                  <SparringChatListItem key={item.sparringId} item={item} onPress={() => openChat(item)} past />
                ))}
              </>
            ) : null
          }
          ListEmptyComponent={
            archived.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={40} color={colors.textSecondary} />
                <Text style={styles.empty}>Noch keine Sparring-Chats.</Text>
              </View>
            ) : null
          }
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 24,
    paddingVertical:   16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    flex:       1,
    textAlign:  'center',
    fontSize:   18,
    fontWeight: '700',
    color:      colors.text,
  },
  headerSpacer: {
    width: 24,
  },
  loader: {
    marginTop: 48,
  },
  list: {
    paddingTop:    8,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize:          13,
    fontWeight:        '600',
    color:             colors.textSecondary,
    paddingHorizontal: 16,
    paddingTop:        16,
    paddingBottom:     8,
    textTransform:     'uppercase',
    letterSpacing:     0.5,
  },
  emptyContainer: {
    alignItems:  'center',
    marginTop:   48,
    gap:         12,
  },
  empty: {
    color:    colors.textSecondary,
    fontSize: 15,
  },
});
