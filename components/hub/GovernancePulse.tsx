'use client';

import Link from 'next/link';
import { Activity, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { briefingItem } from '@/lib/animations';
import { Card, CardContent } from '@/components/ui/card';

interface GovernancePulseProps {
  /** Number of active (open) proposals this epoch */
  activeProposalCount: number;
  /** AI-generated epoch headline, if available */
  aiHeadline: string | null;
  /** Compact mode — single line, no description or CTA */
  compact?: boolean;
}

/**
 * GovernancePulse — compact teaser card for undelegated citizens.
 *
 * Shows a glimpse of governance activity (active proposals, AI headline)
 * to create urgency around delegation. Only rendered when the user has
 * no DRep delegation.
 */
export function GovernancePulse({
  activeProposalCount,
  aiHeadline,
  compact,
}: GovernancePulseProps) {
  const hasActivity = activeProposalCount > 0;

  const summaryText = aiHeadline
    ? aiHeadline
    : hasActivity
      ? `${activeProposalCount} governance proposal${activeProposalCount !== 1 ? 's' : ''} being decided right now`
      : 'Governance proposals are being decided right now';

  return (
    <motion.div variants={briefingItem}>
      <Card className="border-white/[0.08] bg-card/15 backdrop-blur-md py-0">
        <CardContent className="py-3 px-4 sm:px-5">
          <div className="flex items-start gap-3">
            <Activity className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-foreground">
                Governance This Epoch
                {compact && hasActivity && (
                  <span className="ml-2 text-muted-foreground font-normal">
                    &middot; {activeProposalCount} active
                  </span>
                )}
              </p>
              {!compact && (
                <>
                  <p className="text-sm text-muted-foreground leading-snug">{summaryText}</p>
                  <Link
                    href="/match"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline pt-0.5"
                  >
                    Delegate to get personalized briefings
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
