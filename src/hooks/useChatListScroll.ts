import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { FlatList, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { decideScrollOnNewest, type ChatRow } from '../utils/chatMessages';

// In an inverted list offset 0 is the latest message.
export const NEAR_LATEST_PX = 80;

// Keeps the reading position when messages arrive; follows them natively near the bottom.
export const CHAT_MAINTAIN_POSITION = { minIndexForVisible: 0, autoscrollToTopThreshold: NEAR_LATEST_PX };

export function chatKeyExtractor(m: ChatRow): string {
  return m.id;
}

export interface ChatListScroll<T> {
  listRef:               RefObject<FlatList<T> | null>;
  onScroll:              (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  showHint:              boolean;
  scrollToLatest:        () => void;
}

export function useChatListScroll<T extends ChatRow>(
  newestFirst: T[],
  isOwn:       (m: T) => boolean,
): ChatListScroll<T> {
  const listRef       = useRef<FlatList<T>>(null);
  const nearLatestRef = useRef(true);
  const prevNewestRef = useRef<string | null>(null);
  const isOwnRef      = useRef(isOwn);
  isOwnRef.current    = isOwn;
  const [showHint, setShowHint] = useState(false);

  const scrollToLatest = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    setShowHint(false);
  }, []);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const near = e.nativeEvent.contentOffset.y < NEAR_LATEST_PX;
    nearLatestRef.current = near;
    if (near) setShowHint(false);
  }, []);

  const newest   = newestFirst[0] ?? null;
  const newestId = newest?.id ?? null;
  useEffect(() => {
    const decision = decideScrollOnNewest({
      prevNewestId: prevNewestRef.current,
      newestId,
      // Own messages (text echo or realtime image) are always revealed.
      newestIsOwn:  newest !== null && isOwnRef.current(newest),
      nearLatest:   nearLatestRef.current,
    });
    prevNewestRef.current = newestId;
    if (decision === 'scrollToLatest') scrollToLatest();
    else if (decision === 'showHint') setShowHint(true);
    // Only a change of the newest message matters; older pages keep newestId unchanged.
  }, [newestId]);

  return { listRef, onScroll, showHint, scrollToLatest };
}
