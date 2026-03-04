'use client';

import { Eye, Users, BarChart3 } from 'lucide-react';
import { useSocialProof } from '@/hooks/queries';
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
  const { data: proofData } = useSocialProof(drepId);
  const count = (() => {
    const d = proofData as any;
    if (!d) return null;
    if (variant === 'views') return (d.weeklyViews ?? 0) as number;
    if (variant === 'poll') return (d.pollResponses ?? 0) as number;
    return (d.activeParticipants ?? 0) as number;
  })();

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
