import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import i18n from '../i18n';
import { getCached, setCached } from '../lib/queryCache';

export interface BlockedUser {
  id:        string;
  name:      string | null;
  avatarUrl: string | null;
  blockedAt: string;
}

interface UseBlockedUsersResult {
  blocked:    BlockedUser[];
  blockedIds: ReadonlySet<string>;
  loading:    boolean;
  block:      (target: { id: string; name: string | null; avatarUrl: string | null }) => Promise<{ error: string | null }>;
  unblock:    (id: string) => Promise<{ error: string | null }>;
  refetch:    () => void;
}

type BlockedSnapshot = { blocked: BlockedUser[] };

type BlockRow = {
  blocked_id: string;
  created_at: string;
  profiles:   { name: string | null; avatar_url: string | null } | null;
};

export function useBlockedUsers(refetchTrigger = 0): UseBlockedUsersResult {
  const { user } = useAuth();
  // Depend on the id, not the user object: a token refresh creates a new object.
  const userId = user?.id ?? null;
  const cacheKey = userId !== null ? `useBlockedUsers:${userId}` : null;
  const cached = cacheKey !== null ? getCached<BlockedSnapshot>(cacheKey) : undefined;
  const [blocked, setBlocked] = useState<BlockedUser[]>(() => cached?.blocked ?? []);
  const [loading, setLoading] = useState(cached === undefined);
  const [localTrigger, setLocalTrigger] = useState(0);

  // Other mounted consumers (e.g. an open chat below the profile) read the cache on refocus.
  const commit = useCallback((next: BlockedUser[]) => {
    setBlocked(next);
    if (cacheKey !== null) setCached<BlockedSnapshot>(cacheKey, { blocked: next });
  }, [cacheKey]);

  useEffect(() => {
    if (userId === null) { setBlocked([]); setLoading(false); return; }
    let cancelled = false;
    void supabase
      .from('user_blocks')
      .select('blocked_id, created_at, profiles!blocked_id(name, avatar_url)')
      .eq('blocker_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error === null) {
          const rows = (data ?? []) as unknown as BlockRow[];
          commit(rows.map((r) => ({
            id:        r.blocked_id,
            name:      r.profiles?.name ?? null,
            avatarUrl: r.profiles?.avatar_url ?? null,
            blockedAt: r.created_at,
          })));
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId, refetchTrigger, localTrigger, commit]);

  const blockedIds = useMemo(() => new Set(blocked.map((b) => b.id)), [blocked]);

  const block = useCallback(async (
    target: { id: string; name: string | null; avatarUrl: string | null },
  ): Promise<{ error: string | null }> => {
    if (userId === null) return { error: i18n.t('profile.errors.notLoggedIn') };
    const before = blocked;
    if (!before.some((b) => b.id === target.id)) {
      commit([{ ...target, blockedAt: new Date().toISOString() }, ...before]);
    }
    const { error } = await supabase
      .from('user_blocks')
      .upsert({ blocker_id: userId, blocked_id: target.id }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });
    if (error !== null) { commit(before); return { error: error.message }; }
    return { error: null };
  }, [userId, blocked, commit]);

  const unblock = useCallback(async (id: string): Promise<{ error: string | null }> => {
    if (userId === null) return { error: i18n.t('profile.errors.notLoggedIn') };
    const before = blocked;
    commit(before.filter((b) => b.id !== id));
    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', userId)
      .eq('blocked_id', id);
    if (error !== null) { commit(before); return { error: error.message }; }
    return { error: null };
  }, [userId, blocked, commit]);

  const refetch = useCallback(() => { setLocalTrigger((n) => n + 1); }, []);

  return { blocked, blockedIds, loading, block, unblock, refetch };
}
