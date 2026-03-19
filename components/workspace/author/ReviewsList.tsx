'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { MessageSquare, Star, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDraftReviews } from '@/hooks/useDraftReviews';
import { ResponseEditor } from './ResponseEditor';
import type { DraftReview } from '@/lib/workspace/types';

// ---------------------------------------------------------------------------
// Score bar
// ---------------------------------------------------------------------------

function ScoreBar({ label, score }: { label: string; score: number | null }) {
  if (score == null) return null;
  const pct = (score / 5) * 100;
  const color = score >= 4 ? 'bg-emerald-500' : score >= 3 ? 'bg-amber-500' : 'bg-destructive';

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 text-muted-foreground truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-right font-medium">{score}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aggregate scores header
// ---------------------------------------------------------------------------

function AggregateScores({
  scores,
  hasStaleReviews,
}: {
  scores: {
    impact: number | null;
    feasibility: number | null;
    constitutional: number | null;
    value: number | null;
  };
  hasStaleReviews: boolean;
}) {
  const items = [
    { label: 'Impact', score: scores.impact },
    { label: 'Feasibility', score: scores.feasibility },
    { label: 'Constitutional', score: scores.constitutional },
    { label: 'Value', score: scores.value },
  ].filter((i) => i.score != null);

  if (items.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-muted/30">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="text-lg font-bold">{item.score}</span>
            </div>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>
      {hasStaleReviews && (
        <p className="text-xs text-muted-foreground italic">Averages exclude stale reviews</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single review card
// ---------------------------------------------------------------------------

function ReviewCard({
  review,
  responses,
  isOwner,
  draftId,
}: {
  review: DraftReview;
  responses: Array<{
    id: string;
    responseType: string;
    responseText: string;
    createdAt: string;
  }>;
  isOwner: boolean;
  draftId: string;
}) {
  const truncatedAddress =
    review.reviewerStakeAddress.slice(0, 12) + '...' + review.reviewerStakeAddress.slice(-6);
  const hasResponse = responses.length > 0;

  return (
    <div
      className={cn(
        'space-y-3 border-b last:border-0 pb-4 last:pb-0',
        review.isStale && 'opacity-50',
      )}
    >
      {/* Review header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">{truncatedAddress}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(review.createdAt).toLocaleDateString()}
          </span>
          {review.isStale && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="text-xs border-amber-500/30 text-amber-600 dark:text-amber-400 gap-1"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    Stale
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  This review was submitted for version {review.reviewedAtVersion ?? '?'}. The
                  proposal has been updated since.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {hasResponse && (
          <Badge
            variant="outline"
            className={`text-xs ${
              responses[0].responseType === 'accept'
                ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : responses[0].responseType === 'decline'
                  ? 'border-destructive/30 text-destructive'
                  : 'border-amber-500/30 text-amber-600 dark:text-amber-400'
            }`}
          >
            {responses[0].responseType === 'accept'
              ? 'Accepted'
              : responses[0].responseType === 'decline'
                ? 'Declined'
                : 'Modified'}
          </Badge>
        )}
      </div>

      {/* Score bars */}
      <div className="space-y-1">
        <ScoreBar label="Impact" score={review.impactScore} />
        <ScoreBar label="Feasibility" score={review.feasibilityScore} />
        <ScoreBar label="Constitutional" score={review.constitutionalScore} />
        <ScoreBar label="Value" score={review.valueScore} />
      </div>

      {/* Feedback text */}
      <p className="text-sm whitespace-pre-wrap">{review.feedbackText}</p>

      {/* Theme badges */}
      {review.feedbackThemes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {review.feedbackThemes.map((theme) => (
            <Badge key={theme} variant="outline" className="text-xs">
              {theme}
            </Badge>
          ))}
        </div>
      )}

      {/* Author responses */}
      {responses.map((resp) => (
        <div key={resp.id} className="ml-4 pl-3 border-l-2 border-primary/30 space-y-1">
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className={`text-xs ${
                resp.responseType === 'accept'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : resp.responseType === 'decline'
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              }`}
            >
              {resp.responseType === 'accept'
                ? 'Accepted'
                : resp.responseType === 'decline'
                  ? 'Declined'
                  : 'Modified'}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(resp.createdAt).toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{resp.responseText}</p>
        </div>
      ))}

      {/* Response editor for owner on unresponded reviews */}
      {isOwner && !hasResponse && (
        <ResponseEditor review={review} draftId={draftId} onSuccess={() => {}} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ReviewsListProps {
  draftId: string;
  isOwner: boolean;
}

export function ReviewsList({ draftId, isOwner }: ReviewsListProps) {
  const { data, isLoading } = useDraftReviews(draftId);
  const [staleExpanded, setStaleExpanded] = useState(false);

  // Separate current and stale reviews
  const { currentReviews, staleReviews } = useMemo(() => {
    if (!data) return { currentReviews: [], staleReviews: [] };
    const current: DraftReview[] = [];
    const stale: DraftReview[] = [];
    for (const review of data.reviews) {
      if (review.isStale) {
        stale.push(review);
      } else {
        current.push(review);
      }
    }
    return { currentReviews: current, staleReviews: stale };
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Reviews</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full rounded" />
          <Skeleton className="h-24 w-full rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.reviews.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Reviews
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Reviews ({data.total})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <AggregateScores scores={data.aggregateScores} hasStaleReviews={staleReviews.length > 0} />

        {/* Current reviews */}
        <div className="space-y-4">
          {currentReviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              responses={data.responsesByReview[review.id] ?? []}
              isOwner={isOwner}
              draftId={draftId}
            />
          ))}
        </div>

        {/* Stale reviews — collapsible section */}
        {staleReviews.length > 0 && (
          <div className="border-t pt-3">
            <button
              onClick={() => setStaleExpanded(!staleExpanded)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full cursor-pointer"
            >
              {staleExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              <AlertTriangle className="h-3 w-3 text-amber-400" />
              Stale Reviews ({staleReviews.length})
            </button>
            {staleExpanded && (
              <div className="space-y-4 mt-3">
                {staleReviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    responses={data.responsesByReview[review.id] ?? []}
                    isOwner={isOwner}
                    draftId={draftId}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
