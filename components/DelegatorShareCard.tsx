'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ShareActions } from '@/components/ShareActions';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { posthog } from '@/lib/posthog';

interface DelegatorData {
  drepName: string;
  drepScore: number;
  governanceLevel: string | null;
  pollCount: number;
  representationScore: number | null;
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const strokeWidth = Math.max(4, size * 0.065);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, score)) / 100;
  const dashOffset = circumference * (1 - progress);

  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="absolute -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-muted/20"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-all duration-700"
        />
      </svg>
      <span className="text-xl font-bold tabular-nums" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

export function DelegatorShareCard() {
  const { isAuthenticated, delegatedDrepId, address, reconnecting } = useWallet();
  const [data, setData] = useState<DelegatorData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (reconnecting) return;
    if (!isAuthenticated || !delegatedDrepId) {
      setLoading(false);
      return;
    }

    const token = getStoredSession();
    if (!token) {
      setLoading(false);
      return;
    }

    const params = new URLSearchParams({ drepId: delegatedDrepId });
    fetch(`/api/governance/holder?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((json) => {
        setData({
          drepName: json.delegationHealth?.drepName ?? delegatedDrepId.slice(0, 16) + '…',
          drepScore: json.delegationHealth?.drepScore ?? 0,
          governanceLevel: null,
          pollCount: json.pollHistory?.length ?? 0,
          representationScore: json.representationScore?.score ?? null,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAuthenticated, delegatedDrepId, reconnecting]);

  const hasData = data !== null;
  useEffect(() => {
    if (!hasData) return;
    posthog.capture('delegator_share_card_viewed');

    const token = getStoredSession();
    if (token) {
      fetch('/api/user', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((user) => {
          if (user) {
            setData((prev) =>
              prev
                ? {
                    ...prev,
                    governanceLevel: user.governance_level ?? null,
                    pollCount: user.poll_count ?? prev.pollCount,
                  }
                : prev,
            );
          }
        })
        .catch(() => {});
    }
  }, [hasData]);

  if (!isAuthenticated || !delegatedDrepId) return null;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-4 w-40" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const ogImageUrl = `/api/og/delegator?wallet=${address}`;
  const shareUrl = typeof window !== 'undefined' ? window.location.origin : 'https://governada.io';
  const shareText = `I'm delegated to ${data.drepName} (Score: ${data.drepScore}/100) on Cardano. Who's your DRep? Find out at Governada!`;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6 space-y-4">
        {/* Governance level badge */}
        {data.governanceLevel && (
          <Badge variant="secondary" className="text-xs">
            {data.governanceLevel}
          </Badge>
        )}

        {/* DRep identity + score ring */}
        <div className="flex items-center gap-4">
          <ScoreRing score={data.drepScore} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground">I&apos;m delegated to</p>
            <p className="text-lg font-semibold truncate">{data.drepName}</p>
            <p className="text-sm tabular-nums">
              Score: <span className="font-semibold">{data.drepScore}</span>/100
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6 text-sm">
          {data.representationScore != null && (
            <div>
              <span className="text-muted-foreground">Representation Match</span>
              <p className="font-semibold tabular-nums">{data.representationScore}%</p>
            </div>
          )}
          {data.pollCount > 0 && (
            <div>
              <span className="text-muted-foreground">Voted on</span>
              <p className="font-semibold tabular-nums">{data.pollCount} proposals</p>
            </div>
          )}
        </div>

        {/* CTA */}
        <p className="text-base font-semibold text-primary">Who&apos;s your DRep?</p>

        {/* Share */}
        <ShareActions
          url={shareUrl}
          text={shareText}
          imageUrl={ogImageUrl}
          imageFilename="my-drep-card.png"
          surface="delegator_share"
          metadata={{
            drepScore: data.drepScore,
            representationScore: data.representationScore,
          }}
        />
      </CardContent>
    </Card>
  );
}
