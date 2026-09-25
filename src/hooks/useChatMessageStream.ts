import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import type { ChatRow } from '../utils/chatMessages';
import { createChatSync, type ChatSync, type ChatSyncState, type PageQuery } from '../utils/chatSync';

// Show the first page even if the realtime join is slow; a later join catches up.
const JOIN_FALLBACK_MS = 2_500;

// realtime-js returns an existing channel with the same topic, even one still leaving.
// A per-mount suffix guarantees a fresh channel on quick reopen or user switch.
let channelSeq = 0;

export interface ChatMessageStreamOptions<Row extends ChatRow, Msg extends ChatRow> {
  /** Identity of the stream (chat id + user id). A change tears everything down. */
  streamKey:      string;
  channelName:    string;
  table:          string;
  /** Realtime filter, e.g. `sparring_id=eq.<id>`. */
  filter:         string;
  fetchPage:      (query: PageQuery, limit: number) => Promise<Row[]>;
  enrich:         (rows: Row[]) => Promise<Msg[]>;
  /** Called when new messages became visible while the chat is open (realtime insert or catch-up). */
  onMessagesSeen?: () => void;
}

export interface ChatMessageStream<Msg extends ChatRow> {
  messages:     Msg[];
  loading:      boolean;
  loadingOlder: boolean;
  hasMore:      boolean;
  loadOlder:    () => void;
  /** Returns the live sync instance; capture it before awaiting so a late result cannot leak into another chat. */
  currentSync:  () => ChatSync<Msg> | null;
}

function initialState<Msg>(): ChatSyncState<Msg> {
  return { messages: [], loading: true, loadingOlder: false, hasMore: false };
}

export function useChatMessageStream<Row extends ChatRow, Msg extends ChatRow>(
  opts: ChatMessageStreamOptions<Row, Msg>,
): ChatMessageStream<Msg> {
  const [state, setState] = useState<ChatSyncState<Msg>>(initialState);
  const syncRef = useRef<ChatSync<Msg> | null>(null);
  // Latest callbacks without re-running the effect (they change with render, the stream does not).
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const o = optsRef.current;
    let active = true;
    setState(initialState<Msg>());

    const sync = createChatSync<Msg>({
      fetchPage: async (query, limit) => optsRef.current.enrich(await optsRef.current.fetchPage(query, limit)),
      onChange:  setState,
    });
    syncRef.current = sync;

    const runSync = (): void => {
      void sync.sync().then(() => {
        if (active && !sync.getState().loading) optsRef.current.onMessagesSeen?.();
      });
    };
    // Fallback and join errors only need to trigger the first load once; later joins catch up.
    let initialRequested = false;
    const requestInitial = (): void => {
      if (initialRequested) return;
      initialRequested = true;
      runSync();
    };

    const fallback = setTimeout(requestInitial, JOIN_FALLBACK_MS);

    channelSeq += 1;
    const channel = supabase
      .channel(`${o.channelName}-${channelSeq}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: o.table, filter: o.filter },
        (payload) => {
          const row = payload.new as unknown as Row;
          if (!row?.id) return;
          optsRef.current.enrich([row])
            .then(([msg]) => {
              if (!active || msg === undefined) return;
              sync.receive(msg);
              optsRef.current.onMessagesSeen?.();
            })
            .catch(() => undefined);
        },
      )
      .subscribe((status) => {
        if (!active) return;
        if (status === 'SUBSCRIBED') {
          // First join: initial page (no gap between snapshot and subscription).
          // Every re-join after a socket drop: catch up on what was missed.
          clearTimeout(fallback);
          initialRequested = true;
          runSync();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Realtime unavailable: still show history; the client retries the join by itself.
          requestInitial();
        }
      });

    const appSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') runSync();
    });

    return () => {
      active = false;
      sync.dispose();
      clearTimeout(fallback);
      appSub.remove();
      void supabase.removeChannel(channel);
      if (syncRef.current === sync) syncRef.current = null;
    };
  }, [opts.streamKey]);

  const loadOlder   = useCallback(() => { void syncRef.current?.loadOlder(); }, []);
  const currentSync = useCallback(() => syncRef.current, []);

  return {
    messages:     state.messages,
    loading:      state.loading,
    loadingOlder: state.loadingOlder,
    hasMore:      state.hasMore,
    loadOlder,
    currentSync,
  };
}
