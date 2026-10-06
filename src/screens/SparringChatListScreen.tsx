import React, { useCallback, useMemo, useState } from 'react';
import { View, FlatList, ActivityIndicator, StyleSheet, type ListRenderItemInfo } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { colors } from '../theme/colors';
import { useSparringChatList } from '../hooks/useSparringChatList';
import { useFocusRefetch } from '../hooks/useFocusRefetch';
import ChatOverviewRow, { chatEntryKey } from '../components/chat/ChatOverviewRow';
import {
  ChatOverviewHeader, ArchiveToggle, ChatOverviewEmpty, ChatOverviewNotice, RowSeparator,
} from '../components/chat/ChatOverviewParts';
import { isChatArchived, nextUpChatKey } from '../utils/chatList';
import type { RootStackParamList } from '../navigation/types';
import type { ChatListEntry } from '../hooks/useSparringChatList';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// One virtualized list: active chats (activity order unchanged), then the
// collapsed "Vergangene Treffen" row and, when open, the past chats.
type Row =
  | { type: 'chat'; key: string; item: ChatListEntry; archived: boolean; nextUp: boolean }
  | { type: 'empty'; key: 'empty' }
  | { type: 'archive'; key: 'archive'; count: number; unread: number };

export default function SparringChatListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { chats, loading, failed, refetch } = useSparringChatList();
  const [archiveOpen, setArchiveOpen] = useState(false);
  // Read markers are written inside the chat screen; refresh unread counts on return.
  useFocusRefetch(() => { void refetch(); });

  const rows = useMemo<Row[]>(() => {
    const now = new Date();
    const active = chats.filter((c) => !isChatArchived(c.scheduledAt, c.durationMin, now));
    const archived = chats.filter((c) => isChatArchived(c.scheduledAt, c.durationMin, now));
    // Highlight is separate from the order: the row stays where it is.
    const nextKey = nextUpChatKey(
      active.map((c) => ({ key: chatEntryKey(c), kind: c.kind, scheduledAt: c.scheduledAt, myStatus: c.myStatus })),
      now,
    );
    const out: Row[] = active.map((item) => {
      const key = chatEntryKey(item);
      return { type: 'chat', key, item, archived: false, nextUp: key === nextKey };
    });
    if (active.length === 0) out.push({ type: 'empty', key: 'empty' });
    if (archived.length > 0) {
      out.push({
        type: 'archive',
        key: 'archive',
        count: archived.length,
        unread: archived.reduce((sum, c) => sum + c.unreadCount, 0),
      });
      if (archiveOpen) {
        for (const item of archived) {
          out.push({ type: 'chat', key: chatEntryKey(item), item, archived: true, nextUp: false });
        }
      }
    }
    return out;
  }, [chats, archiveOpen]);

  const openChat = useCallback((item: ChatListEntry) => {
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
  }, [navigation]);

  const toggleArchive = useCallback(() => setArchiveOpen((o) => !o), []);
  const findSparring = useCallback(() => navigation.navigate('Tabs', { screen: 'Sparring' }), [navigation]);
  const retry = useCallback(() => { void refetch(); }, [refetch]);

  const renderItem = useCallback(({ item: row }: ListRenderItemInfo<Row>) => {
    if (row.type === 'empty') return <ChatOverviewEmpty onFind={findSparring} />;
    if (row.type === 'archive') {
      return <ArchiveToggle count={row.count} unread={row.unread} open={archiveOpen} onToggle={toggleArchive} />;
    }
    return <ChatOverviewRow item={row.item} nextUp={row.nextUp} archived={row.archived} onOpen={openChat} />;
  }, [archiveOpen, findSparring, openChat, toggleArchive]);

  const firstLoadFailed = failed && chats.length === 0;

  return (
    <View style={styles.root}>
      <ChatOverviewHeader onBack={() => navigation.goBack()} />

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.accentBlue} />
      ) : firstLoadFailed ? (
        <ChatOverviewNotice text={t('chat.overview.loadFailed')} onRetry={retry} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={renderItem}
          ItemSeparatorComponent={Separator}
          ListHeaderComponent={failed ? (
            <ChatOverviewNotice text={t('chat.overview.maybeStale')} onRetry={retry} />
          ) : null}
          contentContainerStyle={styles.list}
          initialNumToRender={12}
          windowSize={7}
        />
      )}
    </View>
  );
}

// Hairlines only between two plain chat rows (not around the highlighted
// row, the archive toggle or the empty state).
function Separator({ leadingItem, trailingItem }: { leadingItem?: Row; trailingItem?: Row }): React.ReactElement | null {
  if (leadingItem?.type !== 'chat' || trailingItem?.type !== 'chat') return null;
  if (leadingItem.nextUp || trailingItem.nextUp) return null;
  return <RowSeparator />;
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: colors.background,
  },
  loader: {
    marginTop: 48,
  },
  list: {
    paddingBottom: 40,
  },
});
