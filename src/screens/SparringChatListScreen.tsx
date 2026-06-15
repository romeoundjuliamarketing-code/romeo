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
import type { ChatListEntry, SparringChatEntry } from '../hooks/useSparringChatList';

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

  function openChat(item: ChatListEntry) {
    if (item.kind === 'event') {
      navigation.navigate('EventGroupChat', {
        eventId:     item.eventId,
        eventTitle:  item.title,
        scheduledAt: item.scheduledAt,
        durationMin: item.durationMin,
        isOrganizer: item.isOrganizer,
      });
    } else {
      navigation.navigate('SparringGroupChat', {
        sparringId:    item.sparringId,
        sparringTitle: item.sparringTitle,
        scheduledAt:   item.scheduledAt,
        durationMin:   item.durationMin,
        isOrganizer:   item.isOrganizer,
      });
    }
  }

  function getKey(item: ChatListEntry): string {
    return item.kind === 'event' ? `event-${item.eventId}` : `sparring-${item.sparringId}`;
  }

  function renderItem(item: ChatListEntry, past = false) {
    if (item.kind === 'sparring') {
      // SparringChatListItem expects the legacy SparringChatEntry shape (without kind).
      // We pass the compatible fields directly by casting — kind is an additive field.
      return (
        <SparringChatListItem
          key={getKey(item)}
          item={item as SparringChatEntry}
          onPress={() => openChat(item)}
          past={past}
        />
      );
    }

    // Event chat row — minimal inline rendering.
    return (
      <TouchableOpacity
        key={getKey(item)}
        style={[styles.eventCard, past && styles.cardPast]}
        onPress={() => openChat(item)}
        activeOpacity={0.7}
      >
        <View style={styles.eventIcon}>
          <Ionicons name="tv-outline" size={22} color={colors.card} />
        </View>
        <View style={styles.eventContent}>
          <View style={styles.row}>
            <Text style={styles.eventTitle} numberOfLines={1}>{item.title}</Text>
            {item.lastMessageAt !== null && (
              <Text style={styles.timeLabel}>
                {new Date(item.lastMessageAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.metaText}>
              {new Date(item.scheduledAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </Text>
          </View>
          <View style={styles.row}>
            {item.lastMessageText !== null ? (
              <Text style={styles.preview} numberOfLines={1}>{item.lastMessageText}</Text>
            ) : (
              <Text style={styles.previewEmpty} numberOfLines={1}>Noch keine Nachrichten</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Chats</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.accentBlue} />
      ) : (
        <FlatList
          data={active}
          keyExtractor={(item) => getKey(item)}
          renderItem={({ item }) => renderItem(item)}
          ListHeaderComponent={active.length > 0 ? <Text style={styles.sectionLabel}>Aktiv</Text> : null}
          ListFooterComponent={
            archived.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>Archiv</Text>
                {archived.map((item) => renderItem(item, true))}
              </>
            ) : null
          }
          ListEmptyComponent={
            archived.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={40} color={colors.textSecondary} />
                <Text style={styles.empty}>Noch keine Chats.</Text>
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
    alignItems: 'center',
    marginTop:  48,
    gap:        12,
  },
  empty: {
    color:    colors.textSecondary,
    fontSize: 15,
  },
  // Event chat row styles
  eventCard: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  colors.card,
    borderRadius:     14,
    borderWidth:      1,
    borderColor:      colors.border,
    padding:          12,
    marginHorizontal: 16,
    marginBottom:     8,
    gap:              12,
  },
  cardPast: {
    opacity: 0.7,
  },
  eventIcon: {
    width:           48,
    height:          48,
    borderRadius:    24,
    backgroundColor: colors.accentBlue,
    alignItems:      'center',
    justifyContent:  'center',
  },
  eventContent: {
    flex: 1,
    gap:  4,
  },
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  eventTitle: {
    flex:       1,
    fontSize:   15,
    fontWeight: '600',
    color:      colors.text,
    marginRight: 8,
  },
  timeLabel: {
    fontSize:   12,
    color:      colors.textSecondary,
    flexShrink: 0,
  },
  metaText: {
    fontSize: 12,
    color:    colors.textSecondary,
  },
  preview: {
    flex:     1,
    fontSize: 13,
    color:    colors.textSecondary,
  },
  previewEmpty: {
    flex:      1,
    fontSize:  13,
    color:     colors.textSecondary,
    fontStyle: 'italic',
  },
});
