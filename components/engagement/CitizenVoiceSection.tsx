'use client';

import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CitizenVoiceData } from '@/hooks/useEngagement';

interface CitizenVoiceSectionProps {
  data: CitizenVoiceData;
}

export function CitizenVoiceSection({ data }: CitizenVoiceSectionProps) {
  if (!data.summary || data.summary.totalVotes === 0) return null;

  const { summary, proposals } = data;
  const recentProposals = proposals.slice(0, 5);
  const alignmentRate =
    summary.drepAligned + summary.drepDiverged > 0
      ? Math.round((summary.drepAligned / (summary.drepAligned + summary.drepDiverged)) * 100)
      : null;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" />
        Your Governance Voice
      </h2>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Proposals Voted" value={summary.totalVotes} />
        {alignmentRate !== null && <StatCard label="DRep Alignment" value={`${alignmentRate}%`} />}
        {summary.avgCommunityAgreement !== null && (
          <StatCard label="Community Agreement" value={`${summary.avgCommunityAgreement}%`} />
        )}
      </div>

      {/* Recent proposals */}
      {recentProposals.length > 0 && (
        <Card>
          <CardContent className="divide-y divide-border py-0">
            {recentProposals.map((p) => (
              <Link
                key={`${p.txHash}-${p.index}`}
                href={`/proposal/${p.txHash}/${p.index}`}
                className="flex items-center justify-between py-3 hover:bg-muted/30 transition-colors -mx-6 px-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {p.title ?? `Proposal ${p.txHash.slice(0, 8)}...`}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <SentimentBadge sentiment={p.userSentiment} />
                    {p.drepAligned !== null && (
                      <span
                        className={cn(
                          'text-xs',
                          p.drepAligned ? 'text-emerald-500' : 'text-rose-500',
                        )}
                      >
                        {p.drepAligned ? '✓ DRep aligned' : '✗ DRep diverged'}
                      </span>
                    )}
                  </div>
                </div>
                <OutcomeBadge outcome={p.outcome} />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {summary.drepDiverged > 0 && (
        <p className="text-xs text-muted-foreground">
          Your DRep voted differently on {summary.drepDiverged} proposal
          {summary.drepDiverged !== 1 ? 's' : ''}.{' '}
          <Link href="/governance/representatives" className="text-primary hover:underline">
            Explore other DReps
          </Link>
        </p>
      )}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-center">
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const config: Record<string, { label: string; class: string }> = {
    support: { label: 'Support', class: 'text-green-600 bg-green-500/10' },
    oppose: { label: 'Oppose', class: 'text-red-600 bg-red-500/10' },
    unsure: { label: 'Unsure', class: 'text-amber-600 bg-amber-500/10' },
  };
  const c = config[sentiment] ?? config.unsure;
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', c.class)}>
      {c.label}
    </span>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const config: Record<string, { label: string; class: string }> = {
    ratified: { label: 'Ratified', class: 'text-green-600 bg-green-500/10' },
    dropped: { label: 'Dropped', class: 'text-rose-600 bg-rose-500/10' },
    expired: { label: 'Expired', class: 'text-muted-foreground bg-muted' },
    active: { label: 'Active', class: 'text-blue-600 bg-blue-500/10' },
  };
  const c = config[outcome] ?? config.active;
  return (
    <Badge variant="outline" className={cn('text-[10px] shrink-0', c.class)}>
      {c.label}
    </Badge>
  );
}
