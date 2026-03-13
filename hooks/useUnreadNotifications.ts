'use client';

import { useNotificationCount } from './useNotifications';

/**
 * Unread notification count for header bell, sidebar, and bottom nav.
 * Delegates to useNotificationCount() which uses TanStack Query with 60s polling.
 *
 * @param stakeAddress — kept for call-site compatibility; auth is token-based internally.
 */
export function useUnreadNotifications(_stakeAddress: string | null): number {
  const { unreadCount } = useNotificationCount();
  return unreadCount;
}
