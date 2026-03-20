'use client';

import Link from 'next/link';
import { Activity, ArrowRight, Thermometer } from 'lucide-react';
import { motion } from 'framer-motion';
import { briefingItem } from '@/lib/animations';
import { Card, CardContent } from '@/components/ui/card';
import { useGovernanceTemperature } from '@/hooks/useGovernanceTemperature';

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
const TEMP_PILL_STYLES = {
  cool: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
  neutral: 'bg-muted text-muted-foreground border-border/60',
  warm: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  urgent: 'bg-red-500/15 text-red-400 border-red-500/20',
} as const;

export function GovernancePulse({
  activeProposalCount,
  aiHeadline,
  compact,
}: GovernancePulseProps) {
  const hasActivity = activeProposalCount > 0;
  const { temperature, label: tempLabel } = useGovernanceTemperature();

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
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">
                  Governance This Epoch
                  {compact && hasActivity && (
                    <span className="ml-2 text-muted-foreground font-normal">
                      &middot; {activeProposalCount} active
                    </span>
                  )}
                </p>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${TEMP_PILL_STYLES[tempLabel]}`}
                >
                  <Thermometer className="h-2.5 w-2.5" />
                  {tempLabel} {Math.round(temperature)}°
                </span>
              </div>
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
