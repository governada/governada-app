'use client';

/**
 * PresenceIndicator — Avatar stack showing team members currently viewing the draft.
 *
 * Renders in the StudioHeader. Shows up to 3 avatars with overflow count.
 * Hover to see full list of names.
 */

import { cn } from '@/lib/utils';
import type { PresenceUser } from '@/hooks/useDraftPresence';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PresenceIndicatorProps {
  viewers: PresenceUser[];
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function avatarInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'bg-violet-500/20 text-violet-400 border-violet-500/30',
  'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'bg-rose-500/20 text-rose-400 border-rose-500/30',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PresenceIndicator({ viewers, className }: PresenceIndicatorProps) {
  if (viewers.length === 0) return null;

  const visible = viewers.slice(0, 3);
  const overflow = viewers.length - 3;

  return (
    <div
      className={cn('flex items-center gap-1', className)}
      title={viewers.map((v) => v.displayName || truncateAddress(v.stakeAddress)).join(', ')}
    >
      {/* Avatar stack */}
      <div className="flex -space-x-1.5">
        {visible.map((viewer, i) => (
          <div
            key={viewer.stakeAddress}
            className={cn(
              'inline-flex items-center justify-center w-6 h-6 rounded-full border text-[9px] font-bold',
              AVATAR_COLORS[i % AVATAR_COLORS.length],
            )}
          >
            {avatarInitial(viewer.displayName || viewer.stakeAddress)}
          </div>
        ))}
        {overflow > 0 && (
          <div className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-border bg-muted text-[9px] font-medium text-muted-foreground">
            +{overflow}
          </div>
        )}
      </div>

      {/* Label */}
      <span className="text-[10px] text-muted-foreground/60 hidden sm:inline">
        {viewers.length} viewing
      </span>
    </div>
  );
}
