/**
 * TanStack Query hooks for the notification system.
 *
 * useNotifications() — full notification list for inbox page
 * useNotificationCount() — lightweight unread count for header bell
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStoredSession } from '@/lib/supabaseAuth';

// ── Types ───────────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  title: string;
  body: string | null;
  type: string;
  action_url: string | null;
  metadata: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  hasMore: boolean;
  unreadCount: number;
}

// ── Fetch helpers ───────────────────────────────────────────────────────────

async function fetchNotifications(
  unreadOnly = false,
  cursor?: string,
): Promise<NotificationsResponse> {
  const token = getStoredSession();
  if (!token) return { notifications: [], hasMore: false, unreadCount: 0 };

  const params = new URLSearchParams();
  if (unreadOnly) params.set('unread_only', 'true');
  if (cursor) params.set('cursor', cursor);

  const res = await fetch(`/api/you/notifications?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return { notifications: [], hasMore: false, unreadCount: 0 };
  return res.json();
}

async function patchNotifications(body: { ids?: string[]; markAllRead?: boolean }) {
  const token = getStoredSession();
  if (!token) return;

  await fetch('/api/you/notifications', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

// ── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Full notifications list for the inbox page.
 * Polls every 60 seconds.
 */
export function useNotifications(enabled = true) {
  return useQuery<NotificationsResponse>({
    queryKey: ['notifications'],
    queryFn: () => fetchNotifications(),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/**
 * Lightweight unread count for the notification bell.
 * Polls every 60 seconds.
 */
export function useNotificationCount() {
  const { data } = useQuery<NotificationsResponse>({
    queryKey: ['notifications'],
    queryFn: () => fetchNotifications(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return {
    unreadCount: data?.unreadCount ?? 0,
  };
}

/**
 * Mark specific notifications as read.
 */
export function useMarkRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => patchNotifications({ ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/**
 * Mark all notifications as read.
 */
export function useMarkAllRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => patchNotifications({ markAllRead: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
