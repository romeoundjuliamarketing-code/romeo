import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { useMyUpcomingSparrings } from './useMyUpcomingSparrings';
import { useSparringActions } from './useSparringActions';
import { pickFeaturedSparring, msUntilNextMidnight } from '../utils/homeAgenda';
import { hasStarted } from '../utils/sparringCommitment';
import type { HomeSparring } from '../utils/homeAgenda';
import type { MyUpcomingStatus } from './useMyUpcomingSparrings';
import i18n from '../i18n';

// "Now" for Home's day labels: refreshed when the app returns to the
// foreground and at local midnight, so "Heute"/"Morgen" never go stale. No
// per-second ticking. `onForeground` lets Home refetch at the same moment.
export function useHomeNow(onForeground: () => void): Date {
  const [now, setNow] = useState(() => new Date());
  const onForegroundRef = useRef(onForeground);
  onForegroundRef.current = onForeground;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setNow(new Date());
      onForegroundRef.current();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setNow(new Date()), msUntilNextMidnight(now) + 1000);
    return () => clearTimeout(timer);
  }, [now]);

  return now;
}

export interface HomeSparringState {
  status:       MyUpcomingStatus;
  featured:     HomeSparring | null;
  /** Upcoming sparrings the user is in (incl. featured) — Home links to all of them when > 1. */
  upcomingCount: number;
  /** Unread messages in the featured sparring's chat (existing get_my_chats count). */
  chatUnread:   number;
  confirming:   boolean;
  confirmError: string | null;
  confirm:      () => void;
  retry:        () => void;
}

// The user's next sparring for Home, plus the confirm action with the existing
// confirm_sparring RPC. A slot only shows as confirmed after the RPC succeeded.
export function useHomeSparring(userId: string | null, now: Date, refetchTrigger: number): HomeSparringState {
  const { items, status, refetch } = useMyUpcomingSparrings(userId, refetchTrigger);
  const { confirmSparring } = useSparringActions();
  const [confirmedIds, setConfirmedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [confirming, setConfirming] = useState(false);
  // Guards against a second tap landing before the re-render disables the button.
  const confirmingRef = useRef(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [chatUnread, setChatUnread] = useState(0);

  // A successful confirmation counts immediately; the refetch brings the server row.
  const effective = useMemo(
    () => items.map((s) => (s.role === 'pending' && confirmedIds.has(s.id) ? { ...s, role: 'confirmed' as const } : s)),
    [items, confirmedIds],
  );
  const featured = pickFeaturedSparring(effective, now);
  const upcomingCount = effective.filter((s) => !hasStarted(s.scheduledAt, now)).length;
  const featuredId = featured?.id ?? null;

  useEffect(() => { setConfirmError(null); }, [featuredId]);

  // One call per focus — no realtime subscription on Home.
  useEffect(() => {
    if (featuredId === null) {
      setChatUnread(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.rpc('get_my_chats');
      if (cancelled || error !== null) return;
      const row = (data ?? []).find((c) => c.kind !== 'event' && c.chat_id === featuredId);
      setChatUnread(row?.unread_count ?? 0);
    })();
    return () => { cancelled = true; };
  }, [featuredId, refetchTrigger]);

  const confirm = useCallback(() => {
    if (featured === null || confirmingRef.current) return;
    const id = featured.id;
    confirmingRef.current = true;
    setConfirming(true);
    setConfirmError(null);
    void (async () => {
      const { error } = await confirmSparring(id);
      confirmingRef.current = false;
      setConfirming(false);
      if (error !== null) {
        // Same message the detail sheet shows (the RPC raises readable German text).
        setConfirmError(error.trim().length > 0
          ? error
          : i18n.t('home.hooks.confirmFailed'));
        refetch();
        return;
      }
      setConfirmedIds((prev) => new Set(prev).add(id));
      refetch();
    })();
  }, [featured, confirmSparring, refetch]);

  return { status, featured, upcomingCount, chatUnread, confirming, confirmError, confirm, retry: refetch };
}
