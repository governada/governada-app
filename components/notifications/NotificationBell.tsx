'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useNotificationCount } from '@/hooks/useNotifications';

interface NotificationBellProps {
  className?: string;
}

/**
 * NotificationBell — header icon with unread count badge.
 * Links to /you/inbox.
 */
export function NotificationBell({ className }: NotificationBellProps) {
  const { unreadCount } = useNotificationCount();

  return (
    <Link
      href="/you/inbox"
      className={cn(
        'relative inline-flex items-center justify-center h-9 w-9 rounded-lg hover:text-primary hover:bg-primary/10 transition-colors',
        className,
      )}
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1 flex items-center justify-center">
          <span className="absolute h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="relative h-2 w-2 rounded-full bg-amber-500" />
        </span>
      )}
    </Link>
  );
}
