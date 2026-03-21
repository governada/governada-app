'use client';

/**
 * PanelRouter — Route-based content switcher for the intelligence panel.
 *
 * Renders the appropriate panel component based on the current page route.
 * Each route gets AI-synthesized briefing content from the intelligence API.
 */

import type { PanelRoute } from '@/hooks/useIntelligencePanel';
import { HubPanel } from './HubPanel';
import { ProposalPanel } from './ProposalPanel';
import { DRepPanel } from './DRepPanel';
import { TreasuryPanel } from './TreasuryPanel';
import { GovernancePanel } from './GovernancePanel';
import { DefaultPanel } from './DefaultPanel';

interface PanelRouterProps {
  /** Current panel route */
  panelRoute: PanelRoute;
  /** Entity ID for entity-specific panels */
  entityId?: string;
}

export function PanelRouter({ panelRoute, entityId }: PanelRouterProps) {
  switch (panelRoute) {
    case 'hub':
      return <HubPanel />;
    case 'proposal':
      return <ProposalPanel entityId={entityId} />;
    case 'drep':
      return <DRepPanel entityId={entityId} />;
    case 'treasury':
      return <TreasuryPanel />;
    case 'proposals-list':
    case 'representatives-list':
    case 'health':
    case 'workspace':
      return <GovernancePanel panelRoute={panelRoute} />;
    case 'default':
    default:
      return <DefaultPanel />;
  }
}
