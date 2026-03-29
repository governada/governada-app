'use client';

import Link from 'next/link';
import { TableRow, TableCell } from '@/components/ui/table';
import { ProposalCell } from './cells/ProposalCell';
import { TypeBadgeCell } from './cells/TypeBadgeCell';
import { PhaseCell } from './cells/PhaseCell';
import { UrgencyCell } from './cells/UrgencyCell';
import { ConstitutionalRiskCell } from './cells/ConstitutionalRiskCell';
import { TreasuryImpactCell } from './cells/TreasuryImpactCell';
import { CommunitySignalCell } from './cells/CommunitySignalCell';
import { StatusCell } from './cells/StatusCell';
import type { DecisionTableItem } from '@/lib/workspace/types';

interface DecisionTableRowProps {
  item: DecisionTableItem;
  isFocused: boolean;
  itemProps: Record<string, unknown>;
}

export function DecisionTableRow({ item, isFocused, itemProps }: DecisionTableRowProps) {
  const isCompleted = item.phase === 'completed';

  return (
    <TableRow
      className={`group cursor-pointer ${isCompleted ? 'opacity-60 hover:opacity-80' : ''} ${isFocused ? 'ring-1 ring-[var(--compass-teal)] bg-accent/30' : ''}`}
      data-focus-active={isFocused || undefined}
      {...itemProps}
    >
      {/* Proposal title — always visible */}
      <TableCell className="min-w-[180px] max-w-[300px]">
        <Link href={item.href} className="block">
          <ProposalCell item={item} />
        </Link>
      </TableCell>

      {/* Type — always visible */}
      <TableCell>
        <TypeBadgeCell proposalType={item.proposalType} />
      </TableCell>

      {/* Phase — hidden on mobile */}
      <TableCell className="hidden md:table-cell">
        <PhaseCell phase={item.phase} />
      </TableCell>

      {/* Urgency — always visible */}
      <TableCell>
        <UrgencyCell item={item} />
      </TableCell>

      {/* Constitutional Risk — hidden on mobile+tablet */}
      <TableCell className="hidden lg:table-cell">
        <ConstitutionalRiskCell risk={item.constitutionalRisk} />
      </TableCell>

      {/* Treasury Impact — hidden on mobile */}
      <TableCell className="hidden md:table-cell">
        <TreasuryImpactCell amount={item.treasuryAmount} tier={item.treasuryTier} />
      </TableCell>

      {/* Community Signal — hidden on mobile+tablet */}
      <TableCell className="hidden lg:table-cell">
        <CommunitySignalCell signal={item.communitySignal} />
      </TableCell>

      {/* Status — always visible */}
      <TableCell>
        <StatusCell status={item.status} voteChoice={item.voteChoice} />
      </TableCell>
    </TableRow>
  );
}
