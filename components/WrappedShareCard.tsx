'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';
import { ShareActions } from '@/components/ShareActions';
import { buildDRepUrl } from '@/lib/share';
import { posthog } from '@/lib/posthog';

interface WrappedShareCardProps {
  variant: 'drep' | 'delegator';
  drepId: string;
  drepName: string;
  score: number;
  participation?: number;
  rationale?: number;
  reliability?: number;
  rank?: number | null;
  delegators?: number;
}

export function WrappedShareCard({
  variant,
  drepId,
  drepName,
  score,
  participation,
  rationale,
  reliability,
  rank,
  delegators,
}: WrappedShareCardProps) {
  useEffect(() => {
    posthog.capture('wrapped_card_viewed', { variant, drep_id: drepId, score });
  }, [variant, drepId, score]);

  const profileUrl = buildDRepUrl(drepId);
  const encodedId = encodeURIComponent(drepId);

  const imageUrl =
    variant === 'drep'
      ? `/api/og/wrapped/drep/${encodedId}`
      : `/api/og/wrapped/delegator?drepId=${encodedId}`;

  const shareText =
    variant === 'drep'
      ? `My Governada Score: ${score}/100! ${rank ? `Ranked #${rank}. ` : ''}${delegators ? `${delegators} delegators trust my governance. ` : ''}Check your DRep's score on @GovernadaIO:`
      : `I'm delegated to ${drepName} on @GovernadaIO — they scored ${score}/100 with ${participation || 0}% participation. Who's your DRep?`;

  const tierColor =
    score >= 80
      ? 'text-green-600 dark:text-green-400'
      : score >= 60
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4" />
          {variant === 'drep' ? 'Share Your Score' : "Who's Your DRep?"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Inline preview */}
        <div className="rounded-lg bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent p-4">
          <div className="text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              {variant === 'drep' ? 'My Governada Score' : `I'm delegated to`}
            </p>
            {variant === 'delegator' && <p className="text-sm font-semibold">{drepName}</p>}
            <p className={`text-3xl font-bold tabular-nums ${tierColor}`}>
              {score}
              <span className="text-lg text-muted-foreground">/100</span>
            </p>
            {variant === 'drep' && (
              <div className="flex justify-center gap-4 text-[10px] text-muted-foreground">
                {participation !== undefined && <span>Participation: {participation}%</span>}
                {rationale !== undefined && <span>Rationale: {rationale}%</span>}
                {reliability !== undefined && <span>Reliability: {reliability}%</span>}
              </div>
            )}
            {variant === 'delegator' && (
              <p className="text-xs font-medium text-indigo-500 dark:text-indigo-400">
                Who&apos;s your DRep?
              </p>
            )}
          </div>
        </div>

        <ShareActions
          url={profileUrl}
          text={shareText}
          imageUrl={imageUrl}
          imageFilename={`governada-${variant}-${drepName.replace(/\s+/g, '-').toLowerCase()}.png`}
          surface={`wrapped_${variant}`}
          metadata={{ drep_id: drepId, score }}
        />
      </CardContent>
    </Card>
  );
}
