import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useNotificationFeed, type UseNotificationFeedResult } from '../hooks/useNotificationFeed';

// Single source of truth for the in-app notification feed.
//
// Mounted once around the app stack so the header bell, the Home-tab dot and the
// app-icon badge all read the same unread count and stay in sync. A central
// effect mirrors the unread count onto the app-icon badge; AppState changes and
// foreground push deliveries trigger a refetch so the count stays fresh.
const NotificationsContext = createContext<UseNotificationFeedResult | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { notifications, unreadCount, loading, refetch, markAllRead } = useNotificationFeed();

  // Keep the app-icon badge aligned with the unread feed count while the app is
  // running. When the app is closed, the push payload's `badge` field (set
  // server-side) keeps the icon up to date.
  useEffect(() => {
    void Notifications.setBadgeCountAsync(unreadCount).catch(() => undefined);
  }, [unreadCount]);

  // Refetch when the app returns to the foreground (a push may have arrived) and
  // when a push is delivered while the app is open.
  useEffect(() => {
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refetch();
    });
    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      refetch();
    });
    return () => {
      appStateSub.remove();
      receivedSub.remove();
    };
  }, [refetch]);

  // Memoize so consumers (e.g. the tab bar) only re-render when the feed
  // actually changes, not on every provider render.
  const value = useMemo<UseNotificationFeedResult>(
    () => ({ notifications, unreadCount, loading, refetch, markAllRead }),
    [notifications, unreadCount, loading, refetch, markAllRead],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

// Reads the shared notification feed. Must be used within NotificationsProvider.
export function useNotificationsContext(): UseNotificationFeedResult {
  const ctx = useContext(NotificationsContext);
  if (ctx === null) {
    throw new Error('useNotificationsContext must be used within a NotificationsProvider');
  }
  return ctx;
}
