'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sparkles,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  FileText,
  CheckCircle2,
  ExternalLink,
  PenLine,
} from 'lucide-react';
import { VoteRecord } from '@/types/drep';
import { type ScoreSnapshot } from '@/lib/data';
import {
  type Recommendation,
  generateRecommendations,
  getMissingRationaleVotes,
} from '@/utils/recommendations';
import { getStoredSession } from '@/lib/supabaseAuth';
import { VoteExplanationEditor } from '@/components/VoteExplanationEditor';
import { FeatureGate } from '@/components/FeatureGate';

interface DRepDashboardProps {
  drep: {
    drepId: string;
    effectiveParticipation: number;
    rationaleRate: number;
    reliabilityScore: number;
    profileCompleteness: number;
    deliberationModifier: number;
    metadata: Record<string, unknown> | null;
    votes: VoteRecord[];
    drepScore: number;
    brokenLinks?: string[];
  };
  scoreHistory: ScoreSnapshot[];
  isSimulated?: boolean;
}

const PRIORITY_CONFIG = {
  high: { class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'High' },
  medium: {
    class: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    label: 'Medium',
  },
  low: { class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: 'Low' },
};

const IMPORTANCE_BADGE: Record<string, string> = {
  HardForkInitiation: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  NoConfidence: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  NewCommittee: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  NewConstitutionalCommittee: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  NewConstitution: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  UpdateConstitution: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  ParameterChange: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  TreasuryWithdrawals: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

export function DRepDashboard({ drep, scoreHistory, isSimulated }: DRepDashboardProps) {
  const [claimed, setClaimed] = useState(false);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const recommendations = generateRecommendations(drep);
  const missingRationale = getMissingRationaleVotes(drep.votes);

  // Score change since last snapshot
  const prevSnapshot = scoreHistory.length >= 2 ? scoreHistory[scoreHistory.length - 2] : null;
  const scoreChange = prevSnapshot ? drep.drepScore - prevSnapshot.score : null;

  // Auto-claim on mount if this is not simulated
  useEffect(() => {
    if (isSimulated || claimed) return;

    const session = getStoredSession();
    if (!session) return;

    fetch('/api/drep-claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken: session, drepId: drep.drepId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.claimed) {
          setClaimed(true);
          import('@/lib/posthog')
            .then(({ posthog }) => {
              posthog.capture('drep_profile_claimed', { drep_id: drep.drepId });
              posthog.identify(drep.drepId, { segment: 'drep', is_drep: true });
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [drep.drepId, isSimulated, claimed]);

  return (
    <Card className="border-2 border-primary/20">
      {/* Claim success banner */}
      {claimed && !isSimulated && (
        <div className="bg-green-50 dark:bg-green-950/20 border-b border-green-200 dark:border-green-800 px-4 py-2.5 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
          <p className="text-xs font-medium text-green-800 dark:text-green-300">
            Profile claimed! Your DRep Dashboard is now active.
          </p>
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Your DRep Dashboard</CardTitle>
            {isSimulated && (
              <Badge
                variant="outline"
                className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
              >
                Simulated
              </Badge>
            )}
          </div>
          {scoreChange !== null && scoreChange !== 0 && (
            <div
              className={`flex items-center gap-1 text-sm font-medium ${
                scoreChange > 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {scoreChange > 0 ? (
                <ArrowUpRight className="h-4 w-4" />
              ) : (
                <ArrowDownRight className="h-4 w-4" />
              )}
              {scoreChange > 0 ? '+' : ''}
              {scoreChange} pts since last snapshot
            </div>
          )}
          {scoreChange === 0 && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Minus className="h-4 w-4" />
              No change since last snapshot
            </div>
          )}
        </div>
        <CardDescription>Personalized insights to help you improve your DRep Score</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-primary" />
              Improvement Recommendations
            </h3>
            <div className="space-y-2">
              {recommendations.map((rec, i) => (
                <RecommendationCard key={i} rec={rec} />
              ))}
            </div>
          </div>
        )}

        {recommendations.length === 0 && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              All pillars are performing well. Keep up the great work!
            </p>
          </div>
        )}

        {/* Metadata guidance */}
        {recommendations.some((r) => r.pillar === 'profile') && (
          <div className="bg-muted/40 rounded-lg p-3 flex items-start gap-2">
            <ExternalLink className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              To update your DRep profile metadata (name, objectives, social links), use a wallet
              that supports CIP-119 metadata editing such as{' '}
              <a
                href="https://gov.tools"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                gov.tools
              </a>{' '}
              or your wallet&apos;s governance section. Scoring methodology is explained on each
              DRep&apos;s profile page.
            </p>
          </div>
        )}

        {/* Explain Your Vote — votes missing on-chain rationale */}
        {missingRationale.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <PenLine className="h-4 w-4 text-primary" />
                Explain Your Vote ({missingRationale.length})
              </h3>
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                DRepScore Explanations
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              These votes lack on-chain rationale. Add a DRepScore explanation so delegators
              understand your reasoning.
            </p>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proposal</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[70px]">Vote</TableHead>
                    <TableHead className="w-[90px]">Date</TableHead>
                    <TableHead className="w-[80px] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missingRationale.slice(0, 10).map((v) => {
                    const key = `${v.proposalTxHash}-${v.proposalIndex}`;
                    const hasExplanation = !!explanations[key];
                    return (
                      <TableRow key={v.voteTxHash}>
                        <TableCell className="text-xs font-medium">
                          {v.title || 'Unknown Proposal'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${IMPORTANCE_BADGE[v.proposalType || ''] || ''}`}
                          >
                            {v.proposalType || 'Standard'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              v.vote === 'Yes'
                                ? 'default'
                                : v.vote === 'No'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                            className="text-[10px]"
                          >
                            {v.vote}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(v.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          {hasExplanation ? (
                            <Badge variant="secondary" className="text-[10px]">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Done
                            </Badge>
                          ) : (
                            <FeatureGate flag="drep_authoring">
                              <VoteExplanationEditor
                                drepId={drep.drepId}
                                proposalTxHash={v.proposalTxHash}
                                proposalIndex={v.proposalIndex}
                                proposalTitle={v.title || 'Unknown Proposal'}
                                vote={v.vote}
                                onSaved={(text) =>
                                  setExplanations((prev) => ({ ...prev, [key]: text }))
                                }
                              />
                            </FeatureGate>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {missingRationale.length > 10 && (
              <p className="text-xs text-muted-foreground">
                Showing 10 of {missingRationale.length} votes without rationale
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const config = PRIORITY_CONFIG[rec.priority];

  return (
    <div className="border rounded-lg p-3 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="outline" className={`text-[10px] shrink-0 ${config.class}`}>
            {config.label}
          </Badge>
          <span className="text-sm font-medium truncate">{rec.title}</span>
        </div>
        <Badge variant="secondary" className="text-[10px] shrink-0">
          +{rec.potentialGain} pts
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{rec.description}</p>
    </div>
  );
}
