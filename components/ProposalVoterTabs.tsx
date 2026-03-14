'use client';

import { useState, useMemo } from 'react';
import { ProposalVoteDetail, SpoVoteDetail, CcVoteDetail } from '@/lib/data';
import { useSpoVotes, useCcVotes } from '@/hooks/queries';
import { ProposalVotersWithContext } from '@/components/ProposalVotersWithContext';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CopyableAddress } from '@/components/CopyableAddress';
import { ChevronDown, ChevronUp, Users, Server, ShieldCheck } from 'lucide-react';
import { type ProposalStatus, STATUS_STYLES } from '@/utils/proposalPriority';

type Tab = 'dreps' | 'spos' | 'cc';

interface ProposalVoterTabsProps {
  votes: ProposalVoteDetail[];
  txHash: string;
  proposalIndex: number;
  status?: ProposalStatus;
}

function VoteBadge({ vote }: { vote: string }) {
  const variant = vote === 'Yes' ? 'default' : vote === 'No' ? 'destructive' : 'secondary';
  return <Badge variant={variant}>{vote}</Badge>;
}

function SpoVotersList({ txHash, proposalIndex }: { txHash: string; proposalIndex: number }) {
  const { data: spoData, isLoading: loading } = useSpoVotes(txHash, proposalIndex);
  const spoVotes = (Array.isArray(spoData) ? spoData : []) as SpoVoteDetail[];
  const [showAll, setShowAll] = useState(false);

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Loading SPO votes...</p>;
  }

  if (spoVotes.length === 0) {
    return (
      <EmptyState
        icon={Server}
        title="No SPO votes yet"
        message="No Stake Pool Operators have voted on this proposal yet."
        compact
        component="SpoVotersList"
      />
    );
  }

  const visible = showAll ? spoVotes : spoVotes.slice(0, 20);

  return (
    <div className="space-y-2">
      {visible.map((v) => (
        <div key={v.poolId} className="border rounded-lg p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <VoteBadge vote={v.vote} />
                <CopyableAddress
                  address={v.poolId}
                  truncate
                  className="text-sm font-medium text-muted-foreground"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(v.blockTime * 1000).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>
      ))}
      {spoVotes.length > 20 && (
        <Button variant="outline" onClick={() => setShowAll(!showAll)} className="w-full mt-2">
          {showAll ? (
            <>
              Show less <ChevronUp className="h-4 w-4 ml-2" />
            </>
          ) : (
            <>
              Show all {spoVotes.length} SPO votes <ChevronDown className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      )}
    </div>
  );
}

function CcVotersList({ txHash, proposalIndex }: { txHash: string; proposalIndex: number }) {
  const { data: ccData, isLoading: loading } = useCcVotes(txHash, proposalIndex);
  const ccVotes = (Array.isArray(ccData) ? ccData : []) as CcVoteDetail[];

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Loading CC votes...</p>;
  }

  if (ccVotes.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="No CC votes yet"
        message="No Constitutional Committee members have voted on this proposal yet."
        compact
        component="CcVotersList"
      />
    );
  }

  return (
    <div className="space-y-2">
      {ccVotes.map((v) => (
        <div key={v.ccHotId} className="border rounded-lg p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <VoteBadge vote={v.vote} />
                <CopyableAddress
                  address={v.ccHotId}
                  truncate
                  className="text-sm font-medium text-muted-foreground"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(v.blockTime * 1000).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProposalVoterTabs({
  votes,
  txHash,
  proposalIndex,
  status,
}: ProposalVoterTabsProps) {
  const [tab, setTab] = useState<Tab>('dreps');

  const tabs: { key: Tab; label: string; icon: typeof Users; count?: number }[] = useMemo(
    () => [
      { key: 'dreps', label: 'DReps', icon: Users, count: votes.length },
      { key: 'spos', label: 'SPOs', icon: Server },
      { key: 'cc', label: 'CC', icon: ShieldCheck },
    ],
    [votes.length],
  );

  const statusStyle = status ? STATUS_STYLES[status] : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b pb-2" role="tablist" aria-label="Voter type">
        <div className="flex gap-1.5 sm:gap-2 flex-1 overflow-x-auto">
          {tabs.map(({ key, label, icon: Icon, count }) => (
            <Button
              key={key}
              variant={tab === key ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTab(key)}
              className="gap-1.5 shrink-0"
              role="tab"
              aria-selected={tab === key}
              aria-controls={`voters-panel-${key}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {count != null && <span className="text-xs opacity-70">({count})</span>}
            </Button>
          ))}
        </div>
        {statusStyle && (
          <Badge variant="outline" className={`text-xs ${statusStyle.className}`}>
            {statusStyle.label}
          </Badge>
        )}
      </div>

      {tab === 'dreps' && (
        <div role="tabpanel" id="voters-panel-dreps" aria-label="DRep votes">
          <ProposalVotersWithContext votes={votes} />
        </div>
      )}
      {tab === 'spos' && (
        <div role="tabpanel" id="voters-panel-spos" aria-label="SPO votes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-4 w-4 text-cyan-500" />
                SPO Votes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SpoVotersList txHash={txHash} proposalIndex={proposalIndex} />
            </CardContent>
          </Card>
        </div>
      )}
      {tab === 'cc' && (
        <div role="tabpanel" id="voters-panel-cc" aria-label="Constitutional Committee votes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-500" />
                Constitutional Committee Votes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CcVotersList txHash={txHash} proposalIndex={proposalIndex} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
