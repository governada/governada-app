'use client';

import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ShareActions } from '@/components/ShareActions';
import { fillMilestoneDescription } from '@/lib/delegationMilestones';
import { posthog } from '@/lib/posthog';
import { Trophy, Medal, Star, Crown } from 'lucide-react';

const MILESTONE_ICONS: Record<string, typeof Trophy> = {
  '1_month': Trophy,
  '3_months': Medal,
  '6_months': Star,
  '1_year': Crown,
};

const MILESTONE_COLORS: Record<string, string> = {
  '1_month': 'from-amber-500/20 to-orange-500/20',
  '3_months': 'from-blue-500/20 to-indigo-500/20',
  '6_months': 'from-purple-500/20 to-pink-500/20',
  '1_year': 'from-yellow-400/20 to-amber-500/20',
};

interface DelegationAnniversaryCardProps {
  milestone: {
    key: string;
    label: string;
    description: string;
    days: number;
  };
  drepName: string;
  proposalCount: number;
}

export function DelegationAnniversaryCard({
  milestone,
  drepName,
  proposalCount,
}: DelegationAnniversaryCardProps) {
  useEffect(() => {
    posthog.capture('delegation_anniversary_viewed', { milestone: milestone.key });
  }, [milestone.key]);

  const Icon = MILESTONE_ICONS[milestone.key] || Trophy;
  const gradient = MILESTONE_COLORS[milestone.key] || MILESTONE_COLORS['1_month'];
  const description = fillMilestoneDescription(milestone.description, {
    drepName,
    proposalCount,
  });

  return (
    <Card className="relative overflow-hidden border-0 shadow-lg">
      {/* CSS confetti-like decoration */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${gradient} pointer-events-none`}
        aria-hidden
      />
      <div className="absolute top-2 right-3 text-2xl opacity-30 select-none" aria-hidden>
        ✨
      </div>
      <div className="absolute bottom-2 left-4 text-lg opacity-20 select-none" aria-hidden>
        🎉
      </div>

      <CardContent className="relative p-5 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-background/80 shadow-sm">
            <Icon className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h3 className="font-semibold text-base leading-tight">{milestone.label}!</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <ShareActions
            url={typeof window !== 'undefined' ? window.location.href : ''}
            text={`🎉 ${milestone.label} — ${description}`}
            surface="delegation_anniversary"
            metadata={{ milestone: milestone.key, drepName }}
            variant="compact"
          />
        </div>
      </CardContent>
    </Card>
  );
}
