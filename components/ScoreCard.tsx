'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb } from 'lucide-react';
import { type PillarStatus } from '@/utils/scoring';
import { useWallet } from '@/utils/wallet';
import { HexScore } from '@/components/HexScore';
import { extractAlignments } from '@/lib/drepIdentity';
import { PillarCard } from '@/components/PillarCard';
import { MethodologyAccordion } from '@/components/MethodologyAccordion';
import { ShareActions } from '@/components/ShareActions';
import { buildDRepUrl } from '@/lib/share';

interface ScoreCardProps {
  drep: {
    drepId: string;
    name: string | null;
    drepScore: number;
    effectiveParticipation: number;
    reliabilityScore: number;
    profileCompleteness: number;
    [key: string]: unknown;
  };
  adjustedRationale: number;
  pillars: { value: number; label: string; weight: string; maxPoints: number }[];
  pillarStatuses: PillarStatus[];
  quickWin: string | null;
  percentile: number;
  participationHint: string;
  rationaleHint: string;
  reliabilityHint: string;
  profileHint: string;
}

function getCardGradient(score: number): string {
  if (score >= 80)
    return 'bg-gradient-to-br from-green-50/50 to-transparent dark:from-green-950/20 dark:to-transparent';
  if (score >= 60)
    return 'bg-gradient-to-br from-amber-50/50 to-transparent dark:from-amber-950/20 dark:to-transparent';
  return 'bg-gradient-to-br from-red-50/30 to-transparent dark:from-red-950/15 dark:to-transparent';
}

export function ScoreCard({
  drep,
  adjustedRationale,
  pillars,
  pillarStatuses,
  quickWin,
  percentile,
  participationHint,
  rationaleHint,
  reliabilityHint,
  profileHint,
}: ScoreCardProps) {
  const { isAuthenticated, ownDRepId } = useWallet();

  const isOwnProfile = isAuthenticated && ownDRepId === drep.drepId;
  const shareUrl = buildDRepUrl(drep.drepId);
  const ogImageUrl = `/api/og/drep/${encodeURIComponent(drep.drepId)}`;

  const shareText = isOwnProfile
    ? `My DRepScore is ${drep.drepScore}/100!\n\nParticipation: ${drep.effectiveParticipation}% | Rationale: ${adjustedRationale}% | Reliability: ${drep.reliabilityScore}%\n\nSee my full report on @drepscore:`
    : `${drep.name || 'This DRep'} scored ${drep.drepScore}/100 on @drepscore!\n\nCheck out their governance track record:`;

  const hints = [participationHint, rationaleHint, reliabilityHint, profileHint];

  return (
    <Card className={getCardGradient(drep.drepScore)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle>DRep Score</CardTitle>
            <div
              className="flex items-center gap-1"
              role="group"
              aria-label={`${pillarStatuses.filter((s) => s === 'strong').length} of 4 pillars at Strong`}
            >
              {pillarStatuses.map((s, i) => (
                <span
                  key={i}
                  className={`h-2.5 w-2.5 rounded-full ${
                    s === 'strong'
                      ? 'bg-green-500'
                      : s === 'needs-work'
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                  }`}
                  role="img"
                  aria-label={`Pillar ${i + 1}: ${s === 'strong' ? 'Strong' : s === 'needs-work' ? 'Needs work' : 'Weak'}`}
                />
              ))}
            </div>
          </div>
          <ShareActions
            url={shareUrl}
            text={shareText}
            imageUrl={ogImageUrl}
            surface="score_card"
            metadata={{ drep_id: drep.drepId, score: drep.drepScore }}
            variant="dropdown"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Score hero — side-by-side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 items-center">
          <div className="flex justify-center lg:justify-start">
            <HexScore
              score={drep.drepScore}
              alignments={extractAlignments(drep as Record<string, unknown>)}
              size="hero-lg"
              className="hidden lg:inline-flex"
            />
            <HexScore
              score={drep.drepScore}
              alignments={extractAlignments(drep as Record<string, unknown>)}
              size="hero"
              className="lg:hidden"
            />
          </div>
          <div className="flex flex-col items-center lg:items-start gap-3">
            {percentile > 0 && (
              <span className="text-sm font-medium text-foreground/80">
                Higher than {percentile}% of DReps
              </span>
            )}
            {quickWin && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center gap-2 w-full">
                <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <p className="text-xs font-medium text-blue-800 dark:text-blue-300">
                  Biggest opportunity: {quickWin}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Pillar cards — 2-column on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {pillars.map((p, i) => (
            <PillarCard
              key={p.label}
              label={p.label}
              value={p.value}
              weight={p.weight}
              maxPoints={p.maxPoints}
              status={pillarStatuses[i]}
              hint={hints[i]}
            />
          ))}
        </div>

        <div className="border-t pt-4">
          <MethodologyAccordion />
        </div>
      </CardContent>
    </Card>
  );
}
