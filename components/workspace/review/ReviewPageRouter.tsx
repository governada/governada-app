'use client';

/**
 * ReviewPageRouter — client component that switches between the portfolio view
 * (no proposal selected) and the deep-dive ReviewWorkspace (proposal selected).
 *
 * The existing ReviewWorkspace is untouched; this component simply decides which
 * view to render based on the `proposal` search param.
 */

import { ReviewPortfolio } from './ReviewPortfolio';
import { ReviewWorkspace } from './ReviewWorkspace';

interface ReviewPageRouterProps {
  initialProposalKey?: string;
}

export function ReviewPageRouter({ initialProposalKey }: ReviewPageRouterProps) {
  // If a specific proposal key is provided (via deep link or card click),
  // render the existing deep-dive ReviewWorkspace
  if (initialProposalKey) {
    return <ReviewWorkspace initialProposalKey={initialProposalKey} />;
  }

  // Otherwise show the portfolio index view
  return <ReviewPortfolio />;
}
