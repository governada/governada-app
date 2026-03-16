'use client';

import Link from 'next/link';
import { AlertTriangle, Clock, Sparkles, ExternalLink, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SentimentBar } from '@/components/workspace/shared/SentimentBar';
import { VoteTally } from '@/components/workspace/shared/VoteTally';
import type { ReviewQueueItem } from '@/lib/workspace/types';

interface ReviewBriefProps {
  item: ReviewQueueItem;
  position: number;
  total: number;
}

function formatAda(lovelaces: number): string {
  if (lovelaces >= 1_000_000) {
    return `${(lovelaces / 1_000_000).toFixed(1)}M ADA`;
  }
  if (lovelaces >= 1_000) {
    return `${(lovelaces / 1_000).toFixed(0)}K ADA`;
  }
  return `${lovelaces.toLocaleString()} ADA`;
}

/**
 * ReviewBrief — the main reading area showing proposal details and intelligence.
 */
export function ReviewBrief({ item, position, total }: ReviewBriefProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-foreground leading-tight">{item.title}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">{item.proposalType}</Badge>
          {item.epochsRemaining !== null && (
            <Badge
              variant={item.isUrgent ? 'destructive' : 'outline'}
              className={cn('gap-1', !item.isUrgent && 'text-muted-foreground')}
            >
              {item.isUrgent ? (
                <AlertTriangle className="h-3 w-3" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
              {item.epochsRemaining === 0
                ? 'Expires this epoch'
                : `${item.epochsRemaining} epoch${item.epochsRemaining !== 1 ? 's' : ''} remaining`}
            </Badge>
          )}
          {item.existingVote && (
            <Badge
              variant="outline"
              className={cn(
                'gap-1',
                item.existingVote === 'Yes'
                  ? 'text-emerald-600 border-emerald-500/30'
                  : item.existingVote === 'No'
                    ? 'text-rose-600 border-rose-500/30'
                    : 'text-muted-foreground',
              )}
            >
              Already voted: {item.existingVote}
            </Badge>
          )}
        </div>
      </div>

      {/* AI Summary or Abstract */}
      {(item.aiSummary || item.abstract) && (
        <Card>
          <CardContent className="pt-4 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              {item.aiSummary ? 'AI Summary' : 'Abstract'}
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">
              {item.aiSummary || item.abstract}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Treasury Context */}
      {item.proposalType === 'TreasuryWithdrawals' && item.withdrawalAmount !== null && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full p-2 bg-amber-100 dark:bg-amber-900/30">
                <Wallet className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {formatAda(item.withdrawalAmount)}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Treasury withdrawal</span>
                  {item.treasuryTier && (
                    <Badge variant="outline" className="text-[10px]">
                      {item.treasuryTier}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Citizen Sentiment */}
      {item.citizenSentiment && item.citizenSentiment.total > 0 && (
        <Card>
          <CardContent className="pt-4">
            <SentimentBar sentiment={item.citizenSentiment} />
          </CardContent>
        </Card>
      )}

      {/* Inter-Body Votes */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Inter-Body Vote Tallies</p>
          <VoteTally
            rows={[
              { label: 'DRep', ...item.interBodyVotes.drep },
              { label: 'SPO', ...item.interBodyVotes.spo },
              { label: 'CC', ...item.interBodyVotes.cc },
            ]}
          />
        </CardContent>
      </Card>

      {/* Footer: batch context + source link */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-sm text-muted-foreground">
          Proposal {position} of {total}
        </span>
        <Link
          href={`/proposal/${item.txHash}/${item.proposalIndex}`}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          View full proposal
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
