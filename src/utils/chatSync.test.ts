import { createChatSync } from './chatSync';
import { compareRows, isAfterCursor, isBeforeCursor } from './chatMessages';

type Row = { id: string; created_at: string };
type Query =
  | { kind: 'latest' }
  | { kind: 'before'; cursor: { created_at: string; id: string | null } }
  | { kind: 'after'; cursor: { created_at: string; id: string | null } };

const T0 = Date.parse('2026-09-25T10:00:00Z');
const at = (sec: number) => new Date(T0 + sec * 1000).toISOString();
const id = (n: number) => `m${String(n).padStart(4, '0')}`;
const row = (n: number, sec = n): Row => ({ id: id(n), created_at: at(sec) });

// In-memory table: answers are computed at call time (snapshot), resolution can be held back.
function fakeDb(initial: Row[]) {
  const table = [...initial];
  const held: Array<() => void> = [];
  let holdCount = 0;
  const calls: Query[] = [];
  async function fetchPage(q: Query, limit: number): Promise<Row[]> {
    calls.push(q);
    const sorted = [...table].sort(compareRows);
    let result: Row[];
    if (q.kind === 'latest') result = sorted.slice(-limit);
    else if (q.kind === 'before') result = sorted.filter((x) => isBeforeCursor(x, q.cursor)).slice(-limit);
    else result = sorted.filter((x) => isAfterCursor(x, q.cursor)).slice(0, limit);
    if (holdCount === 0) return result;
    holdCount -= 1;
    return new Promise((resolve) => held.push(() => resolve(result)));
  }
  return {
    table, calls, fetchPage,
    holdNext: () => { holdCount = 1; },
    release: () => { held.splice(0).forEach((f) => f()); },
  };
}

function setup(rows: Row[], pageSize = 5, extra: { maxCatchUpPages?: number } = {}) {
  const db = fakeDb(rows);
  const changes: number[] = [];
  const sync = createChatSync<Row>({
    fetchPage: db.fetchPage, pageSize, overlapMs: 0,
    onChange: (s) => changes.push(s.messages.length), ...extra,
  });
  const ids = () => sync.getState().messages.map((m) => m.id);
  return { db, sync, ids, changes };
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createChatSync', () => {
  it('loads only the latest page and knows there is more', async () => {
    const { sync, ids } = setup(range(1, 12).map((n) => row(n)));
    await sync.sync();
    expect(ids()).toEqual(range(8, 12).map(id));
    expect(sync.getState()).toMatchObject({ loading: false, hasMore: true });
  });

  it('keeps a realtime row that arrives while the initial page is in flight', async () => {
    const { db, sync, ids } = setup([row(1), row(2)]);
    db.holdNext();
    const pending = sync.sync();
    await flush();
    sync.receive(row(3));
    db.release();
    await pending;
    expect(ids()).toEqual([id(1), id(2), id(3)]);
  });

  it('never duplicates a row delivered by page, realtime and send echo', async () => {
    const { sync, ids } = setup([row(1), row(2)]);
    sync.receive(row(2));
    await sync.sync();
    sync.receive(row(2));
    sync.receive({ ...row(2) });
    expect(ids()).toEqual([id(1), id(2)]);
  });

  it('pages through many equal timestamps without skipping or duplicating', async () => {
    // 11 messages from one transaction share the same now().
    const rows = range(1, 11).map((n) => row(n, 0));
    const { sync, ids } = setup(rows, 3);
    await sync.sync();
    while (sync.getState().hasMore) await sync.loadOlder();
    expect(ids()).toEqual(range(1, 11).map(id));
  });

  it('serializes a join during the initial load and catches up rows written in between', async () => {
    const { db, sync, ids } = setup([row(1)]);
    db.holdNext();
    const first = sync.sync();
    await flush();
    db.table.push(row(2));            // written after the snapshot, before the channel joined
    const second = sync.sync();       // SUBSCRIBED arrives
    db.release();
    await Promise.all([first, second]);
    expect(ids()).toEqual([id(1), id(2)]);
  });

  it('coalesces repeated sync triggers (join, foreground) into one queued fetch', async () => {
    const { db, sync } = setup([row(1)]);
    db.holdNext();
    const first = sync.sync();
    await flush();                           // initial fetch is in flight
    const all = [first, sync.sync(), sync.sync(), sync.sync()];
    db.release();
    await Promise.all(all);
    expect(db.calls.map((q) => q.kind)).toEqual(['latest', 'after']);
  });

  it('catches up more missing messages than one page holds', async () => {
    const { db, sync, ids } = setup([row(1), row(2)], 5);
    await sync.sync();
    db.table.push(...range(3, 20).map((n) => row(n)));   // 18 missed while offline
    await sync.sync();
    expect(ids()).toEqual(range(1, 20).map(id));
  });

  it('jumps to the latest page instead of leaving a hole when the gap is too large', async () => {
    const { db, sync, ids } = setup([row(1)], 5, { maxCatchUpPages: 2 });
    await sync.sync();
    db.table.push(...range(2, 40).map((n) => row(n)));
    await sync.sync();
    expect(ids()).toEqual(range(36, 40).map(id));
    expect(sync.getState().hasMore).toBe(true);
    // Paging back afterwards is contiguous.
    await sync.loadOlder();
    expect(ids()).toEqual(range(31, 40).map(id));
  });

  it('drops late responses after dispose (chat switch / logout)', async () => {
    const { db, sync, changes } = setup([row(1)]);
    db.holdNext();
    const pending = sync.sync();
    await flush();
    sync.dispose();
    sync.receive(row(2));
    db.release();
    await pending;
    expect(changes).toEqual([]);
  });

  it('drops an older page that was requested before the list was replaced', async () => {
    const { db, sync, ids } = setup(range(1, 10).map((n) => row(n)), 5, { maxCatchUpPages: 1 });
    await sync.sync();
    db.holdNext();
    const older = sync.loadOlder();          // held: would add rows 1-5
    await flush();
    db.table.push(...range(11, 30).map((n) => row(n)));
    await sync.sync();                       // gap too large -> list replaced by 26-30
    db.release();
    await older;
    expect(ids()).toEqual(range(26, 30).map(id));
    expect(sync.getState().loadingOlder).toBe(false);
  });

  it('does not retry a failed older page in a tight loop, but after the cooldown or a sync', async () => {
    const db = fakeDb(range(1, 10).map((n) => row(n)));
    let clock = 0;
    let failOlder = true;
    let olderCalls = 0;
    const sync = createChatSync<Row>({
      fetchPage: (q, l) => {
        if (q.kind === 'before') {
          olderCalls += 1;
          if (failOlder) return Promise.reject(new Error('offline'));
        }
        return db.fetchPage(q, l);
      },
      onChange: () => undefined, pageSize: 5, olderRetryMs: 5_000, now: () => clock,
    });
    await sync.sync();
    await sync.loadOlder();
    await sync.loadOlder();                 // onEndReached re-fired by the footer toggling
    await sync.loadOlder();
    expect(olderCalls).toBe(1);
    clock = 5_000;
    await sync.loadOlder();                 // cooldown over
    expect(olderCalls).toBe(2);
    failOlder = false;
    await sync.sync();                      // successful sync lifts the block immediately
    await sync.loadOlder();
    expect(olderCalls).toBe(3);
    expect(sync.getState().messages).toHaveLength(10);
  });

  it('recovers from a failed initial load on the next sync', async () => {
    const db = fakeDb([row(1)]);
    let fail = true;
    const sync = createChatSync<Row>({
      fetchPage: (q, l) => (fail ? Promise.reject(new Error('offline')) : db.fetchPage(q, l)),
      onChange: () => undefined,
    });
    await sync.sync();
    expect(sync.getState()).toMatchObject({ loading: false, messages: [] });
    fail = false;
    await sync.sync();
    expect(sync.getState().messages.map((m) => m.id)).toEqual([id(1)]);
  });
});
