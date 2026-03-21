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
 * to the governance overview. Entire card is clickable for better UX.
 */
export function GovernanceConsequenceCard({
  activeProposals,
  totalDelegators,
}: GovernanceConsequenceCardProps) {
  const delegatorLabel =
    totalDelegators > 0 ? `${totalDelegators.toLocaleString()} ADA holders` : 'ADA holders';

  const proposalDetail =
    activeProposals > 0
      ? `Right now, ${activeProposals} proposal${activeProposals !== 1 ? 's are' : ' is'} deciding how Cardano\u2019s treasury is spent.`
      : 'Decisions about Cardano\u2019s treasury are being made right now.';

  return (
    <Link
      href="/governance"
      className="block rounded-xl border border-amber-500/20 bg-amber-950/15 backdrop-blur-md px-4 py-3 transition-all duration-200 hover:border-amber-400/40 hover:shadow-lg hover:shadow-amber-500/5 hover:-translate-y-0.5"
    >
      <p className="text-sm leading-relaxed text-amber-200/90">
        {proposalDetail} {delegatorLabel} are already represented.{' '}
        <span className="text-amber-100/80">
          Governance decisions shape your ADA&rsquo;s future.
        </span>
      </p>
      <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-amber-400">
        See what&rsquo;s happening
        <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  );
}
