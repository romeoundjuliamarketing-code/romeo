// Pure helpers for chat message lists: stable ordering, merging, keyset cursors,
// per-cell layout flags and scroll decisions. Framework-free so they can be unit tested.
import { isSameDay } from './chatDate';

export interface ChatRow {
  id:         string;
  created_at: string;
}

export const CHAT_PAGE_SIZE = 50;

const ISO_RE = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)?$/;

/**
 * Sortable key with microsecond precision (Postgres timestamptz). Accepts both
 * PostgREST ("2026-09-25T10:00:00.123456+00:00") and Postgres text output
 * ("2026-09-25 10:00:00.123456+00"). Different offsets for the same instant yield the same key.
 */
export function timeKey(iso: string): string {
  const m = ISO_RE.exec(iso);
  let seconds: number;
  let micros: string;
  if (m !== null) {
    const [, date, time, fraction, rawOffset] = m;
    let offset = rawOffset ?? 'Z';
    if (offset !== 'Z') {
      const digits = offset.replace(':', '');
      offset = `${digits.slice(0, 3)}:${(digits.slice(3) || '00')}`;
    }
    seconds = Math.floor(Date.parse(`${date}T${time}${offset}`) / 1000);
    micros  = (fraction ?? '').padEnd(6, '0').slice(0, 6);
  } else {
    const ms = Date.parse(iso);
    seconds  = Math.floor(ms / 1000);
    micros   = String((ms % 1000) * 1000).padStart(6, '0');
  }
  return `${String(seconds).padStart(12, '0')}.${micros}`;
}

/** Canonical UTC ISO string (microseconds, "Z") for use as a PostgREST filter value. */
export function canonicalIso(iso: string): string {
  const [secs, micros] = timeKey(iso).split('.');
  const base = new Date(Number(secs) * 1000).toISOString().slice(0, 19);
  return `${base}.${micros}Z`;
}

/** Total order matching Postgres `ORDER BY created_at, id` (uuid order == lowercase hex order). */
export function compareRows(a: ChatRow, b: ChatRow): number {
  const ka = timeKey(a.created_at);
  const kb = timeKey(b.created_at);
  if (ka !== kb) return ka < kb ? -1 : 1;
  const ia = a.id.toLowerCase();
  const ib = b.id.toLowerCase();
  return ia < ib ? -1 : ia > ib ? 1 : 0;
}

/**
 * Merges rows ascending by (created_at, id), deduped by id. An already present row wins,
 * so a server echo of a known message never remounts its cell. Returns `existing` if unchanged.
 */
export function mergeMessages<T extends ChatRow>(existing: T[], incoming: T[]): T[] {
  const known = new Set(existing.map((m) => m.id));
  const fresh: T[] = [];
  for (const m of incoming) {
    if (!known.has(m.id)) {
      known.add(m.id);
      fresh.push(m);
    }
  }
  if (fresh.length === 0) return existing;
  return [...existing, ...fresh].sort(compareRows);
}

export function hasMoreAfterPage(pageLength: number, pageSize: number = CHAT_PAGE_SIZE): boolean {
  return pageLength >= pageSize;
}

/** Keyset cursor. `id: null` means "every row at or after created_at" (overlap window). */
export interface Cursor {
  created_at: string;
  id:         string | null;
}

/** True if `row` sorts strictly after the cursor (or at/after it when cursor.id is null). */
export function isAfterCursor(row: ChatRow, cursor: Cursor): boolean {
  const kr = timeKey(row.created_at);
  const kc = timeKey(cursor.created_at);
  if (cursor.id === null) return kr >= kc;
  return compareRows(row, { id: cursor.id, created_at: cursor.created_at }) > 0;
}

/** True if `row` sorts strictly before the cursor. */
export function isBeforeCursor(row: ChatRow, cursor: Cursor): boolean {
  if (cursor.id === null) return timeKey(row.created_at) < timeKey(cursor.created_at);
  return compareRows(row, { id: cursor.id, created_at: cursor.created_at }) < 0;
}

/**
 * PostgREST `or` filter implementing the same keyset predicate as isAfterCursor/isBeforeCursor.
 * Values are double-quoted because timestamps contain reserved characters (`:` and `.`).
 * Returns null when a plain `gte` on created_at is enough (cursor.id === null).
 */
export function keysetOrFilter(direction: 'after' | 'before', cursor: Cursor): string | null {
  if (cursor.id === null) return null;
  const op = direction === 'after' ? 'gt' : 'lt';
  const ts = canonicalIso(cursor.created_at);
  return `created_at.${op}."${ts}",and(created_at.eq."${ts}",id.${op}."${cursor.id}")`;
}

export interface LayoutFlags {
  showDateSeparator: boolean;
  isFirstInGroup:    boolean;
  isLastInGroup:     boolean;
}

/**
 * Flags for one cell of an inverted (newest-first) list. Visually above = index + 1,
 * visually below = index - 1.
 */
export function computeLayoutFlags<T extends ChatRow>(
  newestFirst: T[],
  index:       number,
  sameGroup:   (a: T, b: T) => boolean,
): LayoutFlags {
  const item  = newestFirst[index];
  const above = index + 1 < newestFirst.length ? newestFirst[index + 1] : null;
  const below = index > 0 ? newestFirst[index - 1] : null;
  const day   = (m: T): Date => new Date(m.created_at);

  const showDateSeparator = above === null || !isSameDay(day(above), day(item));
  const isFirstInGroup    = showDateSeparator || above === null || !sameGroup(above, item);
  const isLastInGroup     =
    below === null || !sameGroup(item, below) || !isSameDay(day(item), day(below));

  return { showDateSeparator, isFirstInGroup, isLastInGroup };
}

export type ScrollDecision = 'none' | 'scrollToLatest' | 'showHint';

/**
 * What to do when the newest message changes. Near the latest message the list follows
 * natively (maintainVisibleContentPosition.autoscrollToTopThreshold), so no JS scroll command
 * competes with it.
 */
export function decideScrollOnNewest(args: {
  prevNewestId: string | null;
  newestId:     string | null;
  newestIsOwn:  boolean;
  nearLatest:   boolean;
}): ScrollDecision {
  const { prevNewestId, newestId, newestIsOwn, nearLatest } = args;
  if (prevNewestId === null || newestId === null || newestId === prevNewestId) return 'none';
  if (newestIsOwn) return nearLatest ? 'none' : 'scrollToLatest';
  return nearLatest ? 'none' : 'showHint';
}
