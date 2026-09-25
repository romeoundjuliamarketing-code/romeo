import {
  mergeMessages, hasMoreAfterPage, CHAT_PAGE_SIZE, timeKey, compareRows,
  keysetOrFilter, isAfterCursor, isBeforeCursor,
  computeLayoutFlags, decideScrollOnNewest,
} from './chatMessages';

type Row = { id: string; created_at: string; sender: string };
const r = (id: string, created_at: string, sender = 'a'): Row => ({ id, created_at, sender });
const same = (a: Row, b: Row) => a.sender === b.sender;

describe('timeKey / compareRows', () => {
  it('treats PostgREST and Postgres text formats of one instant as equal', () => {
    expect(timeKey('2026-09-25T10:00:00.123456+00:00')).toBe(timeKey('2026-09-25 12:00:00.123456+02'));
  });
  it('orders by microseconds inside the same millisecond', () => {
    const a = r('z', '2026-09-25T10:00:00.123001+00:00');
    const b = r('a', '2026-09-25T10:00:00.123002+00:00');
    expect(compareRows(a, b)).toBeLessThan(0);
  });
  it('breaks equal timestamps by id', () => {
    const t = '2026-09-25T10:00:00.5+00:00';
    expect(compareRows(r('a', t), r('b', t))).toBeLessThan(0);
    expect(compareRows(r('b', t), r('a', t))).toBeGreaterThan(0);
  });
});

describe('mergeMessages', () => {
  it('dedupes by id and keeps ascending order', () => {
    const existing = [r('1', '2026-09-25T10:00:00Z'), r('2', '2026-09-25T10:01:00Z')];
    const merged = mergeMessages(existing, [r('2', '2026-09-25T10:01:00Z'), r('3', '2026-09-25T10:00:30Z')]);
    expect(merged.map((m) => m.id)).toEqual(['1', '3', '2']);
  });
  it('keeps the existing object for a known id (no remount on server echo)', () => {
    const own = r('1', '2026-09-25T10:00:00Z');
    const merged = mergeMessages([own], [{ ...own }, r('2', '2026-09-25T10:01:00Z')]);
    expect(merged[0]).toBe(own);
  });
  it('dedupes within a single incoming batch', () => {
    const merged = mergeMessages([], [r('1', '2026-09-25T10:00:00Z'), r('1', '2026-09-25T10:00:00Z')]);
    expect(merged).toHaveLength(1);
  });
  it('returns the same reference when nothing is new', () => {
    const existing = [r('1', '2026-09-25T10:00:00Z')];
    expect(mergeMessages(existing, [r('1', '2026-09-25T10:00:00Z')])).toBe(existing);
    expect(mergeMessages(existing, [])).toBe(existing);
  });
});

describe('hasMoreAfterPage', () => {
  it('is true only for a full page', () => {
    expect(hasMoreAfterPage(CHAT_PAGE_SIZE)).toBe(true);
    expect(hasMoreAfterPage(CHAT_PAGE_SIZE - 1)).toBe(false);
    expect(hasMoreAfterPage(0)).toBe(false);
  });
});

describe('keyset cursor', () => {
  const t = '2026-09-25T10:00:00.000000+00:00';
  it('before/after split equal timestamps by id without overlap or gap', () => {
    const rows = ['a', 'b', 'c'].map((id) => r(id, t));
    const cursor = { created_at: t, id: 'b' };
    expect(rows.filter((x) => isBeforeCursor(x, cursor)).map((x) => x.id)).toEqual(['a']);
    expect(rows.filter((x) => isAfterCursor(x, cursor)).map((x) => x.id)).toEqual(['c']);
  });
  it('builds a quoted PostgREST filter with canonical UTC time', () => {
    expect(keysetOrFilter('before', { created_at: '2026-09-25 12:00:00.5+02', id: 'b' }))
      .toBe('created_at.lt."2026-09-25T10:00:00.500000Z",and(created_at.eq."2026-09-25T10:00:00.500000Z",id.lt."b")');
    expect(keysetOrFilter('after', { created_at: t, id: null })).toBeNull();
  });
});

describe('computeLayoutFlags (newest-first list)', () => {
  const newestFirst = [
    r('4', '2026-09-25T10:05:00', 'b'),
    r('3', '2026-09-25T10:00:00', 'b'),
    r('2', '2026-09-24T09:01:00', 'a'),
    r('1', '2026-09-24T09:00:00', 'a'),
  ];
  it('marks a date separator above the oldest message of each day', () => {
    const flags = newestFirst.map((_, i) => computeLayoutFlags(newestFirst, i, same).showDateSeparator);
    expect(flags).toEqual([false, true, false, true]);
  });
  it('groups consecutive messages of the same sender on the same day', () => {
    expect(computeLayoutFlags(newestFirst, 3, same)).toEqual({ showDateSeparator: true, isFirstInGroup: true, isLastInGroup: false });
    expect(computeLayoutFlags(newestFirst, 2, same)).toEqual({ showDateSeparator: false, isFirstInGroup: false, isLastInGroup: true });
    expect(computeLayoutFlags(newestFirst, 0, same)).toEqual({ showDateSeparator: false, isFirstInGroup: false, isLastInGroup: true });
  });
  it('splits a group across a day boundary even for the same sender', () => {
    const list = [r('2', '2026-09-25T00:01:00', 'a'), r('1', '2026-09-24T23:59:00', 'a')];
    expect(computeLayoutFlags(list, 1, same).isLastInGroup).toBe(true);
    expect(computeLayoutFlags(list, 0, same).isFirstInGroup).toBe(true);
  });
  it('handles a single message', () => {
    const one = [r('1', '2026-09-25T10:00:00')];
    expect(computeLayoutFlags(one, 0, same)).toEqual({ showDateSeparator: true, isFirstInGroup: true, isLastInGroup: true });
  });
});

describe('decideScrollOnNewest', () => {
  const base = { prevNewestId: 'a', newestId: 'b', newestIsOwn: false, nearLatest: true };
  it('does nothing when only older messages were added', () => {
    expect(decideScrollOnNewest({ ...base, newestId: 'a', nearLatest: false })).toBe('none');
  });
  it('does nothing on the initial load', () => {
    expect(decideScrollOnNewest({ ...base, prevNewestId: null, nearLatest: false })).toBe('none');
  });
  it('lets the list follow natively when the reader is near the latest message', () => {
    expect(decideScrollOnNewest(base)).toBe('none');
    expect(decideScrollOnNewest({ ...base, newestIsOwn: true })).toBe('none');
  });
  it('shows a hint for incoming messages while reading older ones', () => {
    expect(decideScrollOnNewest({ ...base, nearLatest: false })).toBe('showHint');
  });
  it('reveals the own message even while reading older ones', () => {
    expect(decideScrollOnNewest({ ...base, nearLatest: false, newestIsOwn: true })).toBe('scrollToLatest');
  });
});
