import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import { getCached, setCached } from '../lib/queryCache';
import type { AppNotification } from '../types/database.types';

type NotificationFeedSnapshot = { notifications: AppNotification[] };

export interface UseNotificationFeedResult {
  notifications: AppNotification[];
  unreadCount:   number;
  loading:       boolean;
  refetch:       () => void;
  markAllRead:   () => Promise<void>;
}

// Loads the current user's notifications (newest first).
// markAllRead calls the mark_all_notifications_read RPC then refetches.
export function useNotificationFeed(refetchTrigger = 0): UseNotificationFeedResult {
  const { user } = useAuth();
  const cacheKey = user ? `useNotificationFeed:${user.id}` : null;
  const cached = cacheKey ? getCached<NotificationFeedSnapshot>(cacheKey) : undefined;
  const [notifications, setNotifications] = useState<AppNotification[]>(() => cached?.notifications ?? []);
  const [loading,       setLoading]        = useState(cached === undefined);
  const [localTrigger,  setLocalTrigger]   = useState(0);

  const refetch = useCallback(() => setLocalTrigger((n) => n + 1), []);

  useEffect(() => {
    if (user === null) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (cancelled) return;

      if (error !== null) {
        reportNetworkError(error);
        setLoading(false);
        return;
      }

      reportNetworkSuccess();
      // Cast data column: Supabase returns jsonb as unknown, ensure correct shape
      const rows: AppNotification[] = (data ?? []).map((row) => ({
        ...row,
        data: (row.data ?? {}) as Record<string, unknown>,
      }));
      setNotifications(rows);
      if (cacheKey) setCached<NotificationFeedSnapshot>(cacheKey, { notifications: rows });
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, refetchTrigger, localTrigger]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.read_at === null).length,
    [notifications],
  );

  const markAllRead = useCallback(async (): Promise<void> => {
    if (user === null) return;
    const { error } = await supabase.rpc('mark_all_notifications_read');
    if (error !== null) {
      reportNetworkError(error);
      return;
    }
    reportNetworkSuccess();
    refetch();
  }, [user, refetch]);

  return { notifications, unreadCount, loading, refetch, markAllRead };
}
