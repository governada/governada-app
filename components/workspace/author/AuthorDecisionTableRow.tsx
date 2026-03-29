'use client';

import Link from 'next/link';
import { TableRow, TableCell } from '@/components/ui/table';
import { TypeBadgeCell } from '@/components/workspace/review/cells/TypeBadgeCell';
import { ConstitutionalRiskCell } from '@/components/workspace/review/cells/ConstitutionalRiskCell';
import { AuthorPhaseCell } from './cells/AuthorPhaseCell';
import { QualityCell } from './cells/QualityCell';
import { FeedbackCell } from './cells/FeedbackCell';
import { UpdatedCell } from './cells/UpdatedCell';
import { NextActionCell } from './cells/NextActionCell';
import type { AuthorDecisionTableItem } from '@/lib/workspace/types';

interface AuthorDecisionTableRowProps {
  item: AuthorDecisionTableItem;
  isFocused: boolean;
  itemProps: Record<string, unknown>;
}

export function AuthorDecisionTableRow({
  item,
  isFocused,
  itemProps,
}: AuthorDecisionTableRowProps) {
  const isArchived = item.phase === 'archived';

  return (
    <TableRow
      className={`group cursor-pointer ${isArchived ? 'opacity-60 hover:opacity-80' : ''} ${isFocused ? 'ring-1 ring-[var(--compass-teal)] bg-accent/30' : ''}`}
      data-focus-active={isFocused || undefined}
      {...itemProps}
    >
      {/* Draft title — always visible */}
      <TableCell className="min-w-[180px] max-w-[300px]">
        <Link href={item.href} className="block">
          <span className="text-sm font-medium line-clamp-1 group-hover:text-[var(--compass-teal)] transition-colors">
            {item.title}
          </span>
        </Link>
      </TableCell>

      {/* Type — always visible */}
      <TableCell>
        <TypeBadgeCell proposalType={item.proposalType} />
      </TableCell>

      {/* Phase — hidden on mobile */}
      <TableCell className="hidden md:table-cell">
        <AuthorPhaseCell phase={item.phase} />
      </TableCell>

      {/* Quality — always visible */}
      <TableCell>
        <QualityCell completeness={item.fieldCompleteness} />
      </TableCell>

      {/* Constitutional Risk — hidden on mobile+tablet */}
      <TableCell className="hidden lg:table-cell">
        <ConstitutionalRiskCell risk={item.constitutionalRisk} />
      </TableCell>

      {/* Feedback — hidden on mobile+tablet */}
      <TableCell className="hidden lg:table-cell">
        <FeedbackCell count={item.feedbackCount} />
      </TableCell>

      {/* Updated — hidden on mobile */}
      <TableCell className="hidden md:table-cell">
        <UpdatedCell updatedAt={item.updatedAt} />
      </TableCell>

      {/* Next Action — always visible */}
      <TableCell>
        <NextActionCell action={item.nextAction} />
      </TableCell>
    </TableRow>
  );
}
