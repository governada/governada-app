'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import type { AlignmentScores } from '@/lib/drepIdentity';
import type { AlignmentSummary } from '@/lib/matching/proposalAlignment';
import type { DelegationSimulation } from '@/lib/matching/delegationSimulation';
import type { TrustSignal } from './TrustSignals';
import { loadMatchProfile, saveMatchProfile, type StoredMatchProfile } from '@/lib/matchStore';
import { useSegment } from '@/components/providers/SegmentProvider';
import { DepthGate } from '@/components/providers/DepthGate';
import { DecisionEngine } from './DecisionEngine';
import { DiscoveryMode } from './DiscoveryMode';
import { ActivityHeatmap } from '@/components/ActivityHeatmap';
import { RecordSummaryCard } from './RecordSummaryCard';
import { TrajectoryCard } from './TrajectoryCard';
import { SenecaAnnotationStack } from '@/components/governada/annotations/SenecaAnnotation';
import { useSenecaAnnotations } from '@/hooks/useSenecaAnnotations';
import { DelegationCoachingBadge } from '@/components/governada/annotations/DelegationCoachingBadge';

/* ─── Types ───────────────────────────────────────────── */

interface AlignmentResponse {
  alignment: AlignmentSummary | null;
  simulation: DelegationSimulation | null;
  comparison: null;
  trustSignals: TrustSignal[];
}

/** Lightweight DRep info for comparison strip */
interface ComparisonDRepInfo {
  drepId: string;
  name: string;
  score: number;
  tier: string;
  participationRate: number;
}

export interface DRepProfileClientProps {
  drepId: string;
  drepName: string;
  drepScore: number;
  delegatorCount: number;
  endorsementCount: number;
  participationRate: number;
  tier: string;
  /** Data for the evidence layer */
  scoreHistory: { date: string; score: number }[];
  delegationTrend: { epoch: number; votingPowerAda: number; delegatorCount: number }[];
  currentScore: number;
  scoreMomentum: number | null;
  votingPowerFormatted: string;
  totalVotes: number;
  rationaleRate: number;
  treasuryJudgmentScore: number | null;
  treasuryProposalCount: number;
}

/* ─── Alignment fetcher ───────────────────────────────── */

async function fetchAlignment(
  drepId: string,
  userAlignment: AlignmentScores,
): Promise<AlignmentResponse> {
  const res = await fetch(`/api/drep/${encodeURIComponent(drepId)}/alignment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userAlignment }),
  });
  if (!res.ok) throw new Error(`Alignment API error: ${res.status}`);
  return res.json();
}

/* ─── Delegation trend classifier ─────────────────────── */

function classifyDelegationTrend(
  trend: { epoch: number; delegatorCount: number }[],
): 'growing' | 'stable' | 'declining' {
  if (trend.length < 2) return 'stable';
  const latest = trend[trend.length - 1];
  const previous = trend[trend.length - 2];
  if (!latest || !previous || previous.delegatorCount === 0) return 'stable';
  const change =
    ((latest.delegatorCount - previous.delegatorCount) / previous.delegatorCount) * 100;
  if (change > 5) return 'growing';
  if (change < -5) return 'declining';
  return 'stable';
}

/* ─── Component ───────────────────────────────────────── */

export function DRepProfileClient({
  drepId,
  drepName,
  drepScore: _drepScore,
  delegatorCount,
  endorsementCount,
  participationRate,
  tier,
  scoreHistory,
  delegationTrend,
  currentScore,
  scoreMomentum,
  votingPowerFormatted,
  totalVotes,
  rationaleRate,
  treasuryJudgmentScore,
  treasuryProposalCount,
}: DRepProfileClientProps) {
  const { delegatedDrep } = useSegment();

  // Check localStorage for existing quiz results
  const [localAlignment, setLocalAlignment] = useState<AlignmentScores | null>(() => {
    if (typeof window === 'undefined') return null;
    const profile = loadMatchProfile();
    return profile?.userAlignments ?? null;
  });

  // Hash alignment for stable cache key
  const alignmentHash = useMemo(() => {
    if (!localAlignment) return null;
    return JSON.stringify(localAlignment);
  }, [localAlignment]);

  // Fetch alignment data from API when user has alignment scores
  const { data: alignmentData, isLoading: alignmentLoading } = useQuery<AlignmentResponse>({
    queryKey: ['drep-alignment', drepId, alignmentHash],
    queryFn: () => fetchAlignment(drepId, localAlignment!),
    enabled: !!localAlignment,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch comparison DRep alignment (for ComparisonStrip) when viewer is delegated elsewhere
  const { data: comparisonAlignmentData } = useQuery<AlignmentResponse | null>({
    queryKey: ['drep-alignment-comparison', delegatedDrep, alignmentHash],
    queryFn: async () => {
      const res = await fetch(`/api/drep/${encodeURIComponent(delegatedDrep!)}/alignment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAlignment: localAlignment }),
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!delegatedDrep && delegatedDrep !== drepId && !!localAlignment,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch comparison DRep basic info (name, score, tier, participation rate)
  const { data: comparisonDRepInfo } = useQuery<ComparisonDRepInfo | null>({
    queryKey: ['drep-basic-info', delegatedDrep],
    queryFn: async () => {
      const res = await fetch(`/api/drep/${encodeURIComponent(delegatedDrep!)}/basic`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!delegatedDrep && delegatedDrep !== drepId,
    staleTime: 10 * 60 * 1000,
  });

  // Handle quiz completion — transition from Discovery to Decision Engine
  const handleMatchComplete = useCallback((alignment: AlignmentScores) => {
    // Save to localStorage (match existing pattern)
    saveMatchProfile({
      userAlignments: alignment,
      personalityLabel: '',
      identityColor: '',
      matchType: 'drep',
      answers: {},
      timestamp: Date.now(),
    } satisfies StoredMatchProfile);

    // Update local state to trigger Decision Engine mode
    setLocalAlignment(alignment);
  }, []);

  // Determine rendering mode
  const hasAlignment = !!localAlignment;
  const hasAlignmentData = !!alignmentData?.alignment;

  // Build comparison data for ComparisonStrip
  const comparisonDrep =
    delegatedDrep && delegatedDrep !== drepId && comparisonDRepInfo
      ? {
          drepId: delegatedDrep,
          name: comparisonDRepInfo.name,
          alignment: comparisonAlignmentData?.alignment?.overallAlignment ?? null,
          participationRate: comparisonDRepInfo.participationRate,
          tier: comparisonDRepInfo.tier,
        }
      : null;
  const comparisonType = comparisonDrep ? ('current_drep' as const) : null;

  const viewingDrepData = {
    drepId,
    name: drepName,
    alignment: alignmentData?.alignment?.overallAlignment ?? null,
    participationRate,
    tier,
  };

  const trendLabel = classifyDelegationTrend(delegationTrend);

  // 2D: Ambient Seneca annotations for DRep profiles
  const { annotations: senecaAnnotations, dismiss: dismissAnnotation } = useSenecaAnnotations({
    pageContext: 'drep',
    entityId: drepId,
  });

  return (
    <div className="space-y-6">
      {/* 2D: Ambient Seneca annotations */}
      <SenecaAnnotationStack
        annotations={senecaAnnotations}
        onDismiss={dismissAnnotation}
        className="mb-2"
      />

      {/* 2E: Delegation coaching — cohort-based comparative insights */}
      <DelegationCoachingBadge isAuthenticated={!!delegatedDrep} />

      {/* ── Decision Engine or Discovery Mode ── */}
      {hasAlignment ? (
        alignmentLoading ? (
          <div className={cn('space-y-4 animate-pulse')}>
            <div className="h-8 w-48 rounded bg-muted" />
            <div className="h-6 w-32 rounded bg-muted" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-24 rounded-lg bg-muted" />
              <div className="h-24 rounded-lg bg-muted" />
            </div>
          </div>
        ) : hasAlignmentData ? (
          <DecisionEngine
            drepId={drepId}
            drepName={drepName}
            alignment={alignmentData!.alignment!}
            simulation={alignmentData!.simulation}
            comparisonDrep={comparisonDrep}
            comparisonType={comparisonType}
            viewingDrepData={viewingDrepData}
          />
        ) : (
          // Has alignment but API returned no data (e.g., DRep has no classified votes)
          <DiscoveryMode
            drepId={drepId}
            drepName={drepName}
            delegatorCount={delegatorCount}
            endorsementCount={endorsementCount}
            delegationTrend={trendLabel}
            onMatchComplete={handleMatchComplete}
            treasuryJudgmentScore={treasuryJudgmentScore}
            treasuryProposalCount={treasuryProposalCount}
          />
        )
      ) : (
        <DiscoveryMode
          drepId={drepId}
          drepName={drepName}
          delegatorCount={delegatorCount}
          endorsementCount={endorsementCount}
          delegationTrend={trendLabel}
          onMatchComplete={handleMatchComplete}
          treasuryJudgmentScore={treasuryJudgmentScore}
          treasuryProposalCount={treasuryProposalCount}
        />
      )}

      {/* AI Delegation Verdict removed — redundant with DecisionEngine alignment display */}

      {/* ── Evidence Layer (depth-gated) ── */}
      <DepthGate minDepth="informed">
        <ActivityHeatmap drepId={drepId} />
      </DepthGate>

      <DepthGate minDepth="informed">
        <RecordSummaryCard
          drepId={drepId}
          totalVotes={totalVotes}
          participationRate={participationRate}
          rationaleRate={rationaleRate}
        />
      </DepthGate>

      <DepthGate minDepth="engaged">
        <TrajectoryCard
          scoreHistory={scoreHistory}
          delegationTrend={delegationTrend}
          currentScore={currentScore}
          scoreMomentum={scoreMomentum}
          delegatorCount={delegatorCount}
          votingPowerFormatted={votingPowerFormatted}
        />
      </DepthGate>
    </div>
  );
}
