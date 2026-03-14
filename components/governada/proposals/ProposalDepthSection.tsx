'use client';

import { useDepthConfig, type ProposalSection } from '@/hooks/useDepthConfig';

interface ProposalDepthSectionProps {
  section: ProposalSection;
  children: React.ReactNode;
}

/**
 * Renders children only if the user's governance depth level includes this section.
 * Gated-out sections render nothing (progressive disclosure, not restriction).
 */
export function ProposalDepthSection({ section, children }: ProposalDepthSectionProps) {
  const config = useDepthConfig('governance');
  if (!config.proposalSections[section]) return null;
  return <>{children}</>;
}
