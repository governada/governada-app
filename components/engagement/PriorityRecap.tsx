'use client';

import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePriorityRankings } from '@/hooks/useEngagement';

const PRIORITY_LABELS: Record<string, string> = {
  infrastructure: 'Infrastructure',
  education: 'Education',
  defi: 'DeFi',
  marketing: 'Marketing',
  developer_tooling: 'Developer Tooling',
  governance_tooling: 'Governance Tooling',
  identity_dids: 'Identity & DIDs',
  interoperability: 'Interoperability',
  security_auditing: 'Security & Auditing',
  community_hubs: 'Community Hubs',
  research: 'Research',
  media_content: 'Media & Content',
};

interface PriorityRecapProps {
  currentEpoch: number;
}

/**
 * Shows last epoch's priority rankings compared to the epoch before,
 * highlighting which priorities moved up/down.
 */
export function PriorityRecap({ currentEpoch }: PriorityRecapProps) {
  const previousEpoch = currentEpoch - 1;
  const twoBack = currentEpoch - 2;

  const { data: lastEpoch } = usePriorityRankings(previousEpoch);
  const { data: priorEpoch } = usePriorityRankings(twoBack);

  if (!lastEpoch?.rankings || lastEpoch.rankings.length === 0 || lastEpoch.totalVoters === 0) {
    return null;
  }

  // Build rank lookup for prior epoch
  const priorRanks = new Map<string, number>();
  if (priorEpoch?.rankings) {
    for (const r of priorEpoch.rankings) {
      priorRanks.set(r.priority, r.rank);
    }
  }

  const top5 = lastEpoch.rankings.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-5 w-5 text-primary" />
          Last Epoch Priorities
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {lastEpoch.totalVoters} citizen{lastEpoch.totalVoters !== 1 ? 's' : ''} ranked their
          priorities in Epoch {previousEpoch}.
        </p>

        <ol className="space-y-2">
          {top5.map((item) => {
            const label = PRIORITY_LABELS[item.priority] ?? item.priority;
            const priorRank = priorRanks.get(item.priority);
            const rankDelta = priorRank != null ? priorRank - item.rank : null;

            return (
              <li key={item.priority} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-muted-foreground tabular-nums w-5 text-right shrink-0">
                    {item.rank}.
                  </span>
                  <span className="font-medium text-foreground truncate">{label}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {rankDelta != null && rankDelta !== 0 && (
                    <span
                      className={`inline-flex items-center gap-0.5 text-xs ${
                        rankDelta > 0 ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {rankDelta > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {Math.abs(rankDelta)}
                    </span>
                  )}
                  {rankDelta === 0 && <Minus className="h-3 w-3 text-muted-foreground" />}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {item.firstChoiceCount} first
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
