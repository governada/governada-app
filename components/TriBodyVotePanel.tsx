'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TriBodyVoteBar } from '@/components/TriBodyVoteBar';
import { ThresholdMeter } from '@/components/ThresholdMeter';
import { Users, Server, ShieldCheck, TrendingUp, TrendingDown, Equal } from 'lucide-react';
import {
  getVotingBodies,
  getIneligibilityNote,
  type GovernanceBody,
} from '@/lib/governance/votingBodies';
import type { TriBodyVotes } from '@/lib/data';

const BODY_CONFIG: Record<GovernanceBody, { label: string; icon: typeof Users; color: string }> = {
  drep: { label: 'DReps', icon: Users, color: 'text-primary' },
  spo: { label: 'SPOs', icon: Server, color: 'text-cyan-500' },
  cc: { label: 'CC', icon: ShieldCheck, color: 'text-amber-500' },
};

interface TriBodyVotePanelProps {
  triBody: TriBodyVotes;
  txHash: string;
  proposalIndex: number;
  proposalType: string;
  /** DRep vote counts for integrated threshold meter */
  yesCount?: number;
  noCount?: number;
  abstainCount?: number;
  totalVotes?: number;
  isOpen?: boolean;
}

interface AlignmentData {
  alignmentScore: number;
  drep: { yes: number; no: number; abstain: number; total: number; yesPct: number };
  spo: { yes: number; no: number; abstain: number; total: number; yesPct: number };
  cc: { yes: number; no: number; abstain: number; total: number; yesPct: number };
}

function BodyColumn({
  label,
  icon: Icon,
  color,
  votes,
  isOpen,
}: {
  label: string;
  icon: typeof Users;
  color: string;
  votes: { yes: number; no: number; abstain: number };
  isOpen?: boolean;
}) {
  const total = votes.yes + votes.no + votes.abstain;
  if (total === 0) {
    return (
      <div className="flex-1 text-center p-4 rounded-lg bg-muted/30">
        <div className="flex items-center justify-center gap-1.5 mb-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {isOpen ? 'No votes yet' : `No ${label} participated`}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 text-center p-4 rounded-lg bg-muted/30">
      <div className="flex items-center justify-center gap-1.5 mb-3">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-green-600 dark:text-green-400">Yes</span>
          <span className="tabular-nums font-medium">{votes.yes}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-red-600 dark:text-red-400">No</span>
          <span className="tabular-nums font-medium">{votes.no}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Abstain</span>
          <span className="tabular-nums font-medium">{votes.abstain}</span>
        </div>
        <div className="border-t pt-1.5 flex justify-between font-medium">
          <span>Total</span>
          <span className="tabular-nums">{total}</span>
        </div>
      </div>
    </div>
  );
}

export function TriBodyVotePanel({
  triBody,
  txHash,
  proposalIndex,
  proposalType,
  yesCount,
  noCount,
  abstainCount,
  totalVotes,
  isOpen,
}: TriBodyVotePanelProps) {
  const [alignment, setAlignment] = useState<AlignmentData | null>(null);

  useEffect(() => {
    fetch(`/api/governance/inter-body?proposal=${txHash}-${proposalIndex}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.alignmentScore != null) setAlignment(data);
      })
      .catch(() => {});
  }, [txHash, proposalIndex]);

  const eligibleBodies = getVotingBodies(proposalType);
  const hasSpo =
    eligibleBodies.includes('spo') && triBody.spo.yes + triBody.spo.no + triBody.spo.abstain > 0;
  const hasCc =
    eligibleBodies.includes('cc') && triBody.cc.yes + triBody.cc.no + triBody.cc.abstain > 0;

  const drepMajority =
    triBody.drep.yes >= triBody.drep.no && triBody.drep.yes >= triBody.drep.abstain
      ? 'Yes'
      : triBody.drep.no >= triBody.drep.abstain
        ? 'No'
        : 'Abstain';
  const spoMajority = hasSpo
    ? triBody.spo.yes >= triBody.spo.no && triBody.spo.yes >= triBody.spo.abstain
      ? 'Yes'
      : triBody.spo.no >= triBody.spo.abstain
        ? 'No'
        : 'Abstain'
    : null;

  let alignmentCallout: string | null = null;
  if (hasSpo && spoMajority) {
    if (drepMajority === spoMajority) {
      alignmentCallout = `DReps and SPOs agreed on this proposal \u2014 both majority voted ${drepMajority}.`;
    } else {
      alignmentCallout = `DReps and SPOs diverged \u2014 DReps voted ${drepMajority} while SPOs voted ${spoMajority}.`;
    }
  }

  const gridCols =
    eligibleBodies.length === 1
      ? 'grid-cols-1'
      : eligibleBodies.length === 2
        ? 'grid-cols-2'
        : 'grid-cols-3';

  const showThreshold =
    yesCount != null &&
    noCount != null &&
    abstainCount != null &&
    totalVotes != null &&
    isOpen != null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>
            {eligibleBodies.length === 1 ? 'DRep Voting Power' : 'Governance Voting Power'}
          </CardTitle>
          {alignment && eligibleBodies.length > 1 && (
            <Badge
              variant="outline"
              className={
                alignment.alignmentScore >= 80
                  ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30'
                  : alignment.alignmentScore >= 50
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                    : 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30'
              }
            >
              {alignment.alignmentScore >= 80 ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : alignment.alignmentScore >= 50 ? (
                <Equal className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {alignment.alignmentScore}% alignment
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* PRIMARY: DRep voting power threshold — this is what determines outcomes */}
        {showThreshold && (
          <div>
            <ThresholdMeter
              txHash={txHash}
              proposalIndex={proposalIndex}
              proposalType={proposalType}
              yesCount={yesCount!}
              noCount={noCount!}
              abstainCount={abstainCount!}
              totalVotes={totalVotes!}
              isOpen={isOpen!}
              variant="full"
            />
          </div>
        )}

        {/* SECONDARY: Per-body vote breakdown bars (counts in tooltips) */}
        <TriBodyVoteBar
          size="lg"
          drep={triBody.drep}
          spo={hasSpo ? triBody.spo : undefined}
          cc={hasCc ? triBody.cc : undefined}
        />

        {/* Ineligibility note when some governance bodies cannot vote */}
        {(() => {
          const note = getIneligibilityNote(proposalType);
          return note ? <p className="text-xs text-muted-foreground text-center">{note}</p> : null;
        })()}

        {alignmentCallout && (
          <div className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Inter-body alignment:</span>{' '}
            {alignmentCallout}
          </div>
        )}

        <InterBodyNarrative txHash={txHash} proposalIndex={proposalIndex} />
      </CardContent>
    </Card>
  );
}

function InterBodyNarrative({ txHash, proposalIndex }: { txHash: string; proposalIndex: number }) {
  const [narrative, setNarrative] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/governance/inter-body-narrative?txHash=${txHash}&index=${proposalIndex}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.narrative) setNarrative(data.narrative);
      })
      .catch(() => {});
  }, [txHash, proposalIndex]);

  if (!narrative) return null;

  return (
    <div className="rounded-md border border-primary/10 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
      <span className="font-medium text-primary text-xs uppercase tracking-wider block mb-1">
        Governance Dynamics
      </span>
      {narrative}
    </div>
  );
}
