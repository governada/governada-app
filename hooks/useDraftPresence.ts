'use client';

/**
 * useDraftPresence — Supabase Realtime presence for draft collaboration.
 *
 * Tracks which team members are currently viewing a draft. Shows avatar
 * stack in the studio header. Uses Supabase Realtime presence channels.
 *
 * Feature-flagged behind `amendment_presence`.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PresenceUser {
  stakeAddress: string;
  displayName: string;
  joinedAt: string;
}

interface PresenceState {
  /** Other users currently viewing this draft (excludes self) */
  viewers: PresenceUser[];
  /** Whether the channel is connected */
  isConnected: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDraftPresence(
  draftId: string | null,
  currentUser: { stakeAddress: string; displayName?: string } | null,
  enabled = true,
): PresenceState {
  const [viewers, setViewers] = useState<PresenceUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const syncPresence = useCallback(
    (
      presenceState: Record<
        string,
        Array<{ stakeAddress: string; displayName: string; joinedAt: string }>
      >,
    ) => {
      const allUsers: PresenceUser[] = [];

      for (const [, userList] of Object.entries(presenceState)) {
        for (const user of userList) {
          // Exclude self
          if (currentUser && user.stakeAddress === currentUser.stakeAddress) continue;
          // Deduplicate by stake address
          if (!allUsers.some((u) => u.stakeAddress === user.stakeAddress)) {
            allUsers.push({
              stakeAddress: user.stakeAddress,
              displayName: user.displayName,
              joinedAt: user.joinedAt,
            });
          }
        }
      }

      setViewers(allUsers);
    },
    [currentUser],
  );

  useEffect(() => {
    if (!draftId || !currentUser || !enabled) return;

    const supabase = createClient();
    const channel = supabase.channel(`draft-presence:${draftId}`, {
      config: { presence: { key: currentUser.stakeAddress } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{
          stakeAddress: string;
          displayName: string;
          joinedAt: string;
        }>();
        syncPresence(state);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          await channel.track({
            stakeAddress: currentUser.stakeAddress,
            displayName: currentUser.displayName ?? currentUser.stakeAddress.slice(0, 12),
            joinedAt: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      setIsConnected(false);
      setViewers([]);
    };
  }, [draftId, currentUser, enabled, syncPresence]);

  return { viewers, isConnected };
}
