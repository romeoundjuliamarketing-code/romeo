import { canonicalIso, keysetOrFilter } from '../utils/chatMessages';
import type { PageQuery } from '../utils/chatSync';
import { reportNetworkError, reportNetworkSuccess } from './networkStatus';

// The subset of a PostgREST filter builder that page queries need.
interface PageableQuery<Row> extends PromiseLike<{ data: Row[] | null; error: unknown }> {
  or(filters: string): PageableQuery<Row>;
  gte(column: 'created_at', value: string): PageableQuery<Row>;
  lt(column: 'created_at', value: string): PageableQuery<Row>;
  order(column: 'created_at' | 'id', options: { ascending: boolean }): PageableQuery<Row>;
  limit(count: number): PageableQuery<Row>;
}

/**
 * Runs one keyset page query on `(created_at, id)` against an already filtered base query
 * (e.g. `supabase.from('event_messages').select('*').eq('event_id', id)`) and returns the rows
 * ascending. Reports connectivity to the app-wide network status; throws on error.
 */
export async function fetchChatPage<Row>(
  base:  PageableQuery<Row>,
  query: PageQuery,
  limit: number,
): Promise<Row[]> {
  let q = base;
  const ascending = query.kind === 'after';
  if (query.kind !== 'latest') {
    const keyset = keysetOrFilter(query.kind, query.cursor);
    const ts     = canonicalIso(query.cursor.created_at);
    if (keyset !== null)             q = q.or(keyset);
    else if (query.kind === 'after') q = q.gte('created_at', ts);
    else                             q = q.lt('created_at', ts);
  }
  const { data, error } = await q
    .order('created_at', { ascending })
    .order('id',         { ascending })
    .limit(limit);
  if (error !== null) {
    reportNetworkError(error);
    throw error;
  }
  reportNetworkSuccess();
  const rows = data ?? [];
  return ascending ? rows : rows.reverse();
}
