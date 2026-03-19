'use client';

/**
 * PeekContent — routes to the correct peek variant based on entity type.
 */

import type { PeekEntity } from '@/hooks/usePeekDrawer';
import { ProposalPeek } from './ProposalPeek';
import { DRepPeek } from './DRepPeek';
import { PoolPeek } from './PoolPeek';
import { CCMemberPeek } from './CCMemberPeek';

interface PeekContentProps {
  entity: PeekEntity;
}

export function PeekContent({ entity }: PeekContentProps) {
  switch (entity.type) {
    case 'proposal':
      return (
        <ProposalPeek
          txHash={entity.id}
          index={
            typeof entity.secondaryId === 'number'
              ? entity.secondaryId
              : parseInt(String(entity.secondaryId ?? '0'), 10)
          }
        />
      );
    case 'drep':
      return <DRepPeek drepId={entity.id} />;
    case 'pool':
      return <PoolPeek poolId={entity.id} />;
    case 'cc':
      return <CCMemberPeek ccHotId={entity.id} />;
    default:
      return null;
  }
}
