'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { ShareActions } from '@/components/ShareActions';
import { buildDRepUrl } from '@/lib/share';
import { posthog } from '@/lib/posthog';

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
  const [change, setChange] = useState<ScoreChange | null>(null);

  useEffect(() => {
    fetch(`/api/dashboard/score-change?drepId=${encodeURIComponent(drepId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.delta && Math.abs(data.delta) >= 3) {
          setChange(data);
          posthog.capture('score_change_moment_viewed', {
            drep_id: drepId,
            delta: data.delta,
            previous_score: data.previousScore,
          });
        }
      })
      .catch(() => {});
  }, [drepId]);

  if (!change) return null;

  const isGain = change.delta > 0;
  const Icon = isGain ? TrendingUp : TrendingDown;
  const colorClass = isGain
    ? 'text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/20'
    : 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20';

  const shareUrl = buildDRepUrl(drepId);
  const imageUrl = `/api/og/moment/score-change/${encodeURIComponent(drepId)}?prev=${change.previousScore}`;
  const shareText = isGain
    ? `My DRepScore went up ${change.delta} points to ${currentScore}/100! Improving my governance game on @drepscore.`
    : `My DRepScore changed by ${change.delta} points to ${currentScore}/100. Governance accountability in action on @drepscore.`;

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
          imageFilename={`drepscore-change-${drepName.replace(/\s+/g, '-').toLowerCase()}.png`}
          surface="score_change_moment"
          metadata={{ drep_id: drepId, delta: change.delta }}
          variant="compact"
        />
      </CardContent>
    </Card>
  );
}
