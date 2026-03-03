'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dna, RefreshCw, ArrowRight, Share2 } from 'lucide-react';
import Link from 'next/link';
import { ShareActions } from '@/components/ShareActions';
import { posthog } from '@/lib/posthog';

export interface QuizMatchDRep {
  drepId: string;
  name: string;
  matchScore: number;
  agreed: number;
  total: number;
}

export interface QuizResult {
  votesCount: number;
  topMatches: QuizMatchDRep[];
  currentDRepMatch: { matchScore: number; agreed: number; total: number } | null;
}

interface GovernanceDNARevealProps {
  result: QuizResult;
  onRetake: () => void;
}

function getMatchColor(score: number) {
  if (score >= 70) return 'text-green-600 dark:text-green-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-muted-foreground';
}

export function GovernanceDNAReveal({ result, onRetake }: GovernanceDNARevealProps) {
  useEffect(() => {
    posthog.capture('governance_dna_reveal_viewed', {
      votes_count: result.votesCount,
      top_match_score: result.topMatches[0]?.matchScore ?? null,
      matches_count: result.topMatches.length,
      has_current_drep_match: !!result.currentDRepMatch,
    });
  }, [result]);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Dna className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Your Governance DNA</h3>
        </div>

        <p className="text-sm text-muted-foreground">
          Based on {result.votesCount} vote{result.votesCount !== 1 ? 's' : ''}, your top matches:
        </p>

        {result.topMatches.length > 0 ? (
          <div className="space-y-2">
            {result.topMatches.map((m, i) => (
              <Link
                key={m.drepId}
                href={`/drep/${encodeURIComponent(m.drepId)}`}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-muted-foreground w-5">{i + 1}.</span>
                  <div>
                    <span className="text-sm font-medium group-hover:text-primary transition-colors">
                      {m.name}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      agreed on {m.agreed}/{m.total}
                    </span>
                  </div>
                </div>
                <Badge variant="outline" className={getMatchColor(m.matchScore)}>
                  {m.matchScore}% match
                </Badge>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Not enough overlapping votes to calculate matches yet. Vote on more proposals to improve
            accuracy.
          </p>
        )}

        {result.currentDRepMatch && (
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-sm">
              <span className="text-muted-foreground">vs your current DRep: </span>
              <span
                className={`font-semibold ${getMatchColor(result.currentDRepMatch.matchScore)}`}
              >
                {result.currentDRepMatch.matchScore}% match
              </span>
              <span className="text-xs text-muted-foreground ml-1">
                ({result.currentDRepMatch.agreed}/{result.currentDRepMatch.total})
              </span>
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          The DRep grid below is now sorted by your match.
        </p>

        {/* Share your Governance DNA — prominent callout */}
        {result.topMatches.length > 0 && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Share your Governance DNA</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Show the Cardano community your governance personality. Your top match:{' '}
              <span className="font-semibold text-foreground">{result.topMatches[0].name}</span> (
              {result.topMatches[0].matchScore}%)
            </p>
            <ShareActions
              url="https://drepscore.io/discover"
              text={`I took the Governance DNA Quiz on @drepscore! My top match: ${result.topMatches[0].name} (${result.topMatches[0].matchScore}%). Find your ideal DRep:`}
              imageUrl={`/api/og/governance-dna?votes=${result.votesCount}${result.topMatches
                .slice(0, 3)
                .map(
                  (m, i) =>
                    `&m${i + 1}name=${encodeURIComponent(m.name)}&m${i + 1}score=${m.matchScore}`,
                )
                .join('')}`}
              imageFilename="my-governance-dna.png"
              surface="governance_dna"
              metadata={{ votes_count: result.votesCount, top_match: result.topMatches[0]?.drepId }}
            />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onRetake} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Retake Quiz
          </Button>
          <Link href="/proposals">
            <Button variant="ghost" size="sm" className="gap-1.5">
              Vote on More Proposals <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
