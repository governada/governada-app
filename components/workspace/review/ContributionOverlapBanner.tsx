'use client';

import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Loader2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContributionOverlapBannerProps {
  proposalTxHash: string;
  proposalIndex: number;
  text: string;
}

interface ContributionCheckResult {
  overlapScore: number;
  existingThemes: string[];
}

/**
 * ContributionOverlapBanner — shows real-time feedback on how unique
 * the reviewer's rationale is compared to existing perspectives.
 * Triggers check when text exceeds 50 characters (debounced).
 */
export function ContributionOverlapBanner({
  proposalTxHash,
  proposalIndex,
  text,
}: ContributionOverlapBannerProps) {
  const [result, setResult] = useState<ContributionCheckResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCheckedRef = useRef('');

  const { mutate: checkContribution, isPending } = useMutation({
    mutationFn: async (input: {
      proposalTxHash: string;
      proposalIndex: number;
      text: string;
    }): Promise<ContributionCheckResult> => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        const { getStoredSession } = await import('@/lib/supabaseAuth');
        const token = getStoredSession();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch {
        // No session
      }
      const res = await fetch('/api/workspace/contribution-check', {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      import('@/lib/posthog')
        .then(({ posthog }) => {
          posthog.capture('review_contribution_checked', {
            proposal_tx_hash: proposalTxHash,
            proposal_index: proposalIndex,
            overlap_score: data.overlapScore,
          });
        })
        .catch(() => {});
    },
  });

  // Debounced check trigger
  useEffect(() => {
    if (text.length < 50) {
      setResult(null);
      return;
    }

    // Don't re-check if text hasn't meaningfully changed
    if (text === lastCheckedRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      lastCheckedRef.current = text;
      checkContribution({ proposalTxHash, proposalIndex, text });
    }, 1500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text, proposalTxHash, proposalIndex, checkContribution]);

  // Reset when proposal changes
  useEffect(() => {
    setResult(null);
    lastCheckedRef.current = '';
  }, [proposalTxHash, proposalIndex]);

  // Don't show anything until there's enough text
  if (text.length < 50 && !result) return null;

  // Loading state
  if (isPending) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
        Checking uniqueness of your perspective...
      </div>
    );
  }

  if (!result) return null;

  const overlapPct = Math.round(result.overlapScore * 100);
  const isHighOverlap = result.overlapScore > 0.7;
  const isLowOverlap = result.overlapScore < 0.3;

  return (
    <div
      className={cn(
        'flex items-start gap-2 px-3 py-2 rounded-lg border text-xs',
        isHighOverlap && 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400',
        isLowOverlap &&
          'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400',
        !isHighOverlap && !isLowOverlap && 'bg-muted/30 border-border text-muted-foreground',
      )}
    >
      {isHighOverlap ? (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      ) : isLowOverlap ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      ) : (
        <Users className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      )}
      <div className="space-y-1">
        <p>
          Your feedback overlaps {overlapPct}% with existing perspectives.
          {result.existingThemes.length > 0 && (
            <span className="text-muted-foreground">
              {' '}
              Top themes already raised: {result.existingThemes.join(', ')}
            </span>
          )}
        </p>
        {isHighOverlap && (
          <p className="text-[10px] opacity-80">
            Consider endorsing existing perspectives or focusing on what&apos;s unique in your
            analysis.
          </p>
        )}
        {isLowOverlap && (
          <p className="text-[10px] opacity-80">
            Your analysis raises points not covered by other reviewers.
          </p>
        )}
      </div>
    </div>
  );
}
