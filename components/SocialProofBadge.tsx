'use client';

import { useEffect, useState } from 'react';
import { Eye, Users, BarChart3 } from 'lucide-react';
import { posthog } from '@/lib/posthog';

interface SocialProofBadgeProps {
  drepId?: string;
  proposalTxHash?: string;
  proposalIndex?: number;
  variant?: 'views' | 'poll' | 'participants';
  className?: string;
}

const MIN_THRESHOLD: Record<string, number> = {
  views: 5,
  poll: 1,
  participants: 3,
};

const ICONS = {
  views: Eye,
  poll: BarChart3,
  participants: Users,
};

export function SocialProofBadge({
  drepId,
  proposalTxHash,
  proposalIndex,
  variant = 'views',
  className = '',
}: SocialProofBadgeProps) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (drepId) params.set('drepId', drepId);
    if (proposalTxHash) params.set('proposalTxHash', proposalTxHash);
    if (proposalIndex !== undefined) params.set('proposalIndex', String(proposalIndex));

    fetch(`/api/social-proof?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        if (variant === 'views') setCount(data.weeklyViews ?? 0);
        else if (variant === 'poll') setCount(data.pollResponses ?? 0);
        else setCount(data.activeParticipants ?? 0);
      })
      .catch(() => {});
  }, [drepId, proposalTxHash, proposalIndex, variant]);

  if (count === null || count < (MIN_THRESHOLD[variant] ?? 1)) return null;

  const Icon = ICONS[variant];

  const labels: Record<string, string> = {
    views: `${count.toLocaleString()} viewed this week`,
    poll: `${count.toLocaleString()} community ${count === 1 ? 'member' : 'members'} polled`,
    participants: `${count.toLocaleString()} active participants this week`,
  };

  posthog.capture('social_proof_badge_viewed', { variant, count, drep_id: drepId });

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground px-2.5 py-1 rounded-full bg-muted/50 border border-border/30 ${className}`}
      aria-label={labels[variant]}
    >
      <Icon className="h-3 w-3" />
      <span className="tabular-nums">{labels[variant]}</span>
    </span>
  );
}
