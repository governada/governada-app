'use client';

import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { ShareActions } from '@/components/ShareActions';
import { buildDRepUrl } from '@/lib/share';
import { posthog } from '@/lib/posthog';
import { useDashboardScoreChange } from '@/hooks/queries';

interface ScoreChangeMomentProps {
  drepId: string;
  drepName: string;
  currentScore: number;
}

interface ScoreChange {
  previousScore: number;
  delta: number;
  date: string;
}

export function ScoreChangeMoment({ drepId, drepName, currentScore }: ScoreChangeMomentProps) {
  const { data: raw } = useDashboardScoreChange(drepId);
  const scoreData = raw as ScoreChange | undefined;
  const change = scoreData?.delta && Math.abs(scoreData.delta) >= 3 ? scoreData : null;

  useEffect(() => {
    if (change) {
      posthog.capture('score_change_moment_viewed', {
        drep_id: drepId,
        delta: change.delta,
        previous_score: change.previousScore,
      });
    }
  }, [change, drepId]);

  if (!change) return null;

  const isGain = change.delta > 0;
  const Icon = isGain ? TrendingUp : TrendingDown;
  const colorClass = isGain
    ? 'text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/20'
    : 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20';

  const shareUrl = buildDRepUrl(drepId);
  const imageUrl = `/api/og/moment/score-change/${encodeURIComponent(drepId)}?prev=${change.previousScore}`;
  const shareText = isGain
    ? `My Governada Score went up ${change.delta} points to ${currentScore}/100! Improving my governance game on @GovernadaIO.`
    : `My Governada Score changed by ${change.delta} points to ${currentScore}/100. Governance accountability in action on @GovernadaIO.`;

  return (
    <Card className={`border ${isGain ? 'border-green-500/20' : 'border-red-500/20'}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-10 h-10 rounded-full ${colorClass}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">
              Score {isGain ? 'increased' : 'decreased'} by {Math.abs(change.delta)} points
            </p>
            <p className="text-xs text-muted-foreground">
              {change.previousScore} → {currentScore}
            </p>
          </div>
        </div>

        <ShareActions
          url={shareUrl}
          text={shareText}
          imageUrl={imageUrl}
          imageFilename={`governada-change-${drepName.replace(/\s+/g, '-').toLowerCase()}.png`}
          surface="score_change_moment"
          metadata={{ drep_id: drepId, delta: change.delta }}
          variant="compact"
        />
      </CardContent>
    </Card>
  );
}
