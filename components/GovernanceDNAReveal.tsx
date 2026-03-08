'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dna, RefreshCw, ArrowRight, Share2, Vote } from 'lucide-react';
import Link from 'next/link';
import { ShareActions } from '@/components/ShareActions';
import { GovernanceRadar } from '@/components/GovernanceRadar';
import { MatchCard } from '@/components/matching/MatchCard';
import { ConfidenceBar } from '@/components/matching/ConfidenceBar';
import { MatchConfidenceCTA } from '@/components/matching/MatchConfidenceCTA';
import { posthog } from '@/lib/posthog';
import type { AlignmentScores, AlignmentDimension } from '@/lib/drepIdentity';
import type { ConfidenceBreakdown } from '@/lib/matching/confidence';

export interface QuizMatchDRep {
  drepId: string;
  name: string;
  matchScore: number;
  agreed: number;
  total: number;
  confidence?: number;
  agreeDimensions?: string[];
  differDimensions?: string[];
  alignments?: AlignmentScores | null;
}

export interface QuizResult {
  votesCount: number;
  topMatches: QuizMatchDRep[];
  currentDRepMatch: { matchScore: number; agreed: number; total: number } | null;
  overallConfidence?: number;
  matchMethod?: string;
  userAlignments?: AlignmentScores | null;
  personalityLabel?: string | null;
  confidenceBreakdown?: ConfidenceBreakdown | null;
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
      match_method: result.matchMethod ?? 'unknown',
      overall_confidence: result.overallConfidence ?? null,
    });
  }, [result]);

  const hasAlignments =
    result.userAlignments && Object.values(result.userAlignments).some((v) => v !== null);

  return (
    <div className="space-y-6">
      {/* Section 1: Your Governance Identity */}
      {hasAlignments && result.userAlignments && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Dna className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Your Governance Identity</h3>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6">
                <GovernanceRadar alignments={result.userAlignments} size="full" animate />
                <div className="text-center sm:text-left space-y-2">
                  {result.personalityLabel && (
                    <Badge variant="outline" className="text-sm px-3 py-1">
                      {result.personalityLabel}
                    </Badge>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Based on {result.votesCount} vote{result.votesCount !== 1 ? 's' : ''} on real
                    governance proposals
                  </p>
                  {result.matchMethod === 'pca' && (
                    <p className="text-[10px] text-muted-foreground/60">
                      Matched using PCA cosine similarity
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Section 2: Your Top Matches */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="space-y-3"
      >
        <h3 className="text-lg font-semibold">Your Top Matches</h3>

        {result.topMatches.length > 0 ? (
          <div className="space-y-3">
            {result.topMatches.map((m, i) => (
              <motion.div
                key={m.drepId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
              >
                <MatchCard
                  rank={i + 1}
                  drepId={m.drepId}
                  drepName={m.name}
                  matchScore={m.matchScore}
                  confidence={m.confidence ?? 0}
                  agreed={m.agreed}
                  overlapping={m.total}
                  agreeDimensions={m.agreeDimensions}
                  differDimensions={m.differDimensions}
                  userAlignments={result.userAlignments}
                  drepAlignments={m.alignments}
                  showRadar={!!result.userAlignments && !!m.alignments}
                />
              </motion.div>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                Not enough overlapping votes to calculate matches yet. Vote on more proposals to
                improve accuracy.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Current DRep comparison */}
        {result.currentDRepMatch && (
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="p-4">
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
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Section 3: Improve Your Matches */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        {result.confidenceBreakdown ? (
          <MatchConfidenceCTA breakdown={result.confidenceBreakdown} variant="full" />
        ) : (
          <Card className="border-muted">
            <CardContent className="p-6 space-y-4">
              <h4 className="font-semibold text-sm">Improve Your Matches</h4>

              <ConfidenceBar votesUsed={result.votesCount} />

              <p className="text-xs text-muted-foreground">
                Vote on more proposals to sharpen your results. Each vote improves your governance
                profile and match accuracy.
              </p>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={onRetake} className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retake Quiz
                </Button>
                <Link href="/discover">
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    <Vote className="h-3.5 w-3.5" />
                    Vote on Proposals
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Share */}
      {result.topMatches.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.55 }}
        >
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 space-y-3">
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
                metadata={{
                  votes_count: result.votesCount,
                  top_match: result.topMatches[0]?.drepId,
                }}
              />
            </CardContent>
          </Card>
        </motion.div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        The DRep grid below is now sorted by your match.
      </p>
    </div>
  );
}
