'use client';

import { Megaphone } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { HubCard, HubCardSkeleton, HubCardError } from './HubCard';

interface ActivePoll {
  txHash: string;
  index: number;
  title: string;
  proposalType: string;
  voteCount: number;
}

/**
 * EngagementCard — One active poll/action, if any.
 *
 * Conditional: only renders when there's something the citizen can act on.
 * Shows the single most relevant engagement opportunity.
 *
 * JTBD: "Is there something I can weigh in on?"
 * Links to /governance/proposals.
 */
export function EngagementCard() {
  const {
    data: pollsRaw,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['active-polls-hub'],
    queryFn: async () => {
      const res = await fetch('/api/governance/pulse');
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <HubCardSkeleton />;
  if (isError) return <HubCardError message="Couldn't load engagement" onRetry={() => refetch()} />;

  const pulse = pollsRaw as Record<string, unknown> | undefined;
  const activePolls = (pulse?.activePolls as ActivePoll[]) ?? [];
  const activeProposals = (pulse?.activeProposals as number) ?? 0;

  // No engagement opportunities — don't render
  if (activePolls.length === 0 && activeProposals === 0) return null;

  const activePoll = activePolls[0];

  return (
    <HubCard
      href="/governance/proposals"
      urgency="default"
      label={activePoll ? `Poll: ${activePoll.title}` : `${activeProposals} active proposals`}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Your Voice
          </span>
        </div>
        {activePoll ? (
          <>
            <p className="text-base font-semibold text-foreground truncate">{activePoll.title}</p>
            <p className="text-sm text-muted-foreground">
              {activePoll.voteCount} citizen{activePoll.voteCount !== 1 ? 's' : ''} voted &mdash;
              add yours
            </p>
          </>
        ) : (
          <>
            <p className="text-base font-semibold text-foreground">
              {activeProposals} proposal{activeProposals !== 1 ? 's' : ''} being decided
            </p>
            <p className="text-sm text-muted-foreground">
              Share your perspective on active governance
            </p>
          </>
        )}
      </div>
    </HubCard>
  );
}
