'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface GovernanceConsequenceCardProps {
  activeProposals: number;
  totalDelegators: number;
}

/**
 * GovernanceConsequenceCard — Shows anonymous visitors why governance matters to their ADA.
 *
 * Compact amber/gold card with a concrete consequence statement and a link
 * to the governance overview. Designed to create urgency by framing governance
 * as something that directly affects their investment.
 */
export function GovernanceConsequenceCard({
  activeProposals,
  totalDelegators,
}: GovernanceConsequenceCardProps) {
  // Build a concrete consequence statement from available data
  const delegatorLabel =
    totalDelegators > 0 ? `${totalDelegators.toLocaleString()} ADA holders` : 'ADA holders';

  const proposalDetail =
    activeProposals > 0
      ? `Right now, ${activeProposals} proposal${activeProposals !== 1 ? 's are' : ' is'} deciding how Cardano\u2019s treasury is spent.`
      : 'Decisions about Cardano\u2019s treasury are being made right now.';

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-950/15 backdrop-blur-md px-4 py-3">
      <p className="text-sm leading-relaxed text-amber-200/90">
        {proposalDetail} {delegatorLabel} are already represented.{' '}
        <span className="text-amber-100/80">
          Governance decisions shape your ADA&rsquo;s future.
        </span>
      </p>
      <Link
        href="/governance"
        className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
      >
        See what&rsquo;s happening
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
