// Display-only timeline for group chats: runs of consecutive system events
// (sign-ups, cancellations) on the same day are merged into one item so they
// do not dominate the history. Real messages and day boundaries always split a
// run. The underlying message list is never changed.
import { isSameDay } from './chatDate';
import type { ChatRow } from './chatMessages';

export interface TimelineSource extends ChatRow {
  is_system: boolean;
}

export interface TimelineMessage<T> {
  kind:       'message';
  id:         string;
  created_at: string;
  message:    T;
}

export interface TimelineSystemRun<T> {
  kind:       'system';
  /** Id of the OLDEST event: new events arrive at the newest end, so the key stays stable. */
  id:         string;
  /** Timestamp of the newest event in the run. */
  created_at: string;
  /** Oldest first (reading order). */
  events:     T[];
}

export type TimelineItem<T> = TimelineMessage<T> | TimelineSystemRun<T>;

/** Builds the newest-first timeline for an inverted list from newest-first messages. */
export function buildTimeline<T extends TimelineSource>(newestFirst: readonly T[]): TimelineItem<T>[] {
  const out: TimelineItem<T>[] = [];
  // Events of the run currently being collected, newest first.
  let run: T[] | null = null;

  const flush = (): void => {
    if (run === null) return;
    const events = [...run].reverse();
    out.push({ kind: 'system', id: events[0].id, created_at: run[0].created_at, events });
    run = null;
  };

  for (const m of newestFirst) {
    if (!m.is_system) {
      flush();
      out.push({ kind: 'message', id: m.id, created_at: m.created_at, message: m });
      continue;
    }
    if (run !== null && !isSameDay(new Date(run[run.length - 1].created_at), new Date(m.created_at))) {
      flush();
    }
    if (run === null) run = [];
    run.push(m);
  }
  flush();
  return out;
}
