// Framework-free sync controller for a realtime chat: initial page, older pages, catch-up after
// reconnect/foreground, and realtime inserts, all merged into one ordered, deduped list.
// The React hook wires it to Supabase; tests drive it with an in-memory fake.
import {
  CHAT_PAGE_SIZE,
  canonicalIso,
  compareRows,
  hasMoreAfterPage,
  mergeMessages,
  type ChatRow,
  type Cursor,
} from './chatMessages';

export type PageQuery =
  | { kind: 'latest' }
  | { kind: 'before'; cursor: Cursor }
  | { kind: 'after';  cursor: Cursor };

export interface ChatSyncState<T> {
  messages:     T[];
  loading:      boolean;
  loadingOlder: boolean;
  hasMore:      boolean;
}

export interface ChatSyncOptions<T extends ChatRow> {
  /**
   * Returns at most `limit` rows ascending by (created_at, id).
   * 'latest' / 'before': the newest matching rows. 'after': the oldest matching rows.
   */
  fetchPage:        (query: PageQuery, limit: number) => Promise<T[]>;
  onChange:         (state: ChatSyncState<T>) => void;
  pageSize?:        number;
  /** Catch-up pages before giving up and jumping to the latest page. */
  maxCatchUpPages?: number;
  /** Catch-up re-reads this window before the newest known row (late commits with older now()). */
  overlapMs?:       number;
  /** After a failed older-page request, further attempts wait this long (list re-fires onEndReached). */
  olderRetryMs?:    number;
  now?:             () => number;
}

export interface ChatSync<T> {
  /** Initial load if nothing is loaded yet, catch-up otherwise. Serialized; never rejects. */
  sync:      () => Promise<void>;
  /** Realtime insert or own-send echo. */
  receive:   (row: T) => void;
  loadOlder: () => Promise<void>;
  /** After dispose, late responses are ignored and onChange is never called again. */
  dispose:   () => void;
  getState:  () => ChatSyncState<T>;
}

export function createChatSync<T extends ChatRow>(opts: ChatSyncOptions<T>): ChatSync<T> {
  const pageSize  = opts.pageSize ?? CHAT_PAGE_SIZE;
  const maxPages  = opts.maxCatchUpPages ?? 10;
  const overlapMs = opts.overlapMs ?? 5_000;
  const retryMs   = opts.olderRetryMs ?? 5_000;
  const now       = opts.now ?? Date.now;

  let state: ChatSyncState<T> = { messages: [], loading: true, loadingOlder: false, hasMore: false };
  let disposed = false;
  let loaded   = false;
  // Bumped when the list is replaced; older-page responses from before are dropped.
  let epoch    = 0;
  let chain: Promise<void> = Promise.resolve();
  let queued: Promise<void> | null = null;
  let olderBlockedUntil = 0;

  function set(patch: Partial<ChatSyncState<T>>): void {
    if (disposed) return;
    state = { ...state, ...patch };
    opts.onChange(state);
  }

  function add(rows: T[]): void {
    if (disposed) return;
    const merged = mergeMessages(state.messages, rows);
    if (merged !== state.messages) set({ messages: merged });
  }

  async function loadLatest(): Promise<void> {
    const rows = await opts.fetchPage({ kind: 'latest' }, pageSize);
    if (disposed) return;
    add(rows);
    loaded = true;
    set({ loading: false, hasMore: hasMoreAfterPage(rows.length, pageSize) });
  }

  async function catchUp(): Promise<void> {
    const newest = state.messages[state.messages.length - 1];
    if (newest === undefined) {
      await loadLatest();
      return;
    }
    const startMs = Date.parse(canonicalIso(newest.created_at)) - overlapMs;
    let cursor: Cursor = { created_at: new Date(startMs).toISOString(), id: null };

    for (let page = 0; page < maxPages; page++) {
      const rows = await opts.fetchPage({ kind: 'after', cursor }, pageSize);
      if (disposed) return;
      // Pages are contiguous from the newest known row, so partial results never leave a hole.
      add(rows);
      if (!hasMoreAfterPage(rows.length, pageSize)) return;
      const last = rows[rows.length - 1];
      cursor = { created_at: last.created_at, id: last.id };
    }

    // Gap too large to bridge: show the latest page rather than a list with a hole in it.
    const latest = await opts.fetchPage({ kind: 'latest' }, pageSize);
    if (disposed) return;
    const oldestLatest = latest[0];
    const keep = oldestLatest === undefined
      ? state.messages
      : state.messages.filter((m) => compareRows(m, oldestLatest) >= 0);
    epoch += 1;
    set({
      messages:     mergeMessages(keep, latest),
      hasMore:      hasMoreAfterPage(latest.length, pageSize),
      loadingOlder: false,
    });
  }

  function sync(): Promise<void> {
    // A sync that is queued but not started yet already covers this request.
    if (queued !== null) return queued;
    const run = chain.then(() => {
      queued = null;
      if (disposed) return undefined;
      return loaded ? catchUp() : loadLatest();
    });
    const settled = run.then(() => {
      // Connectivity is back: allow older pages again right away.
      olderBlockedUntil = 0;
    }, () => {
      // Keep the list usable; the next sync (rejoin/foreground) retries.
      if (!loaded) set({ loading: false });
    });
    queued = settled;
    chain  = settled;
    return settled;
  }

  async function loadOlder(): Promise<void> {
    if (disposed || !loaded || state.loadingOlder || !state.hasMore) return;
    if (now() < olderBlockedUntil) return;
    const oldest = state.messages[0];
    if (oldest === undefined) return;
    const myEpoch = epoch;
    set({ loadingOlder: true });
    try {
      const rows = await opts.fetchPage(
        { kind: 'before', cursor: { created_at: oldest.created_at, id: oldest.id } },
        pageSize,
      );
      if (disposed || myEpoch !== epoch) return;
      add(rows);
      set({ hasMore: hasMoreAfterPage(rows.length, pageSize), loadingOlder: false });
    } catch {
      // Keep hasMore so a later scroll retries, but not in a tight loop while offline.
      olderBlockedUntil = now() + retryMs;
      if (myEpoch === epoch) set({ loadingOlder: false });
    }
  }

  return {
    sync,
    receive:  (row: T) => add([row]),
    loadOlder,
    dispose:  () => { disposed = true; },
    getState: () => state,
  };
}
