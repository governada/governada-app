'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, AlertCircle, Clock, XCircle, Scale, TrendingUp } from 'lucide-react';
import { formatAda } from '@/lib/treasury';
import { posthog } from '@/lib/posthog';

interface Effectiveness {
  totalSpentAda: number;
  totalEnacted: number;
  ratingBreakdown: { delivered: number; partial: number; notDelivered: number; tooEarly: number; pendingReview: number };
  effectivenessRate: number | null;
  topRated: Array<{ title: string; amountAda: number; rating: string }>;
  bottomRated: Array<{ title: string; amountAda: number; rating: string }>;
}

const RATING_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  delivered: { label: 'Delivered', color: 'hsl(142, 71%, 45%)', icon: CheckCircle2 },
  partial: { label: 'Partially Delivered', color: 'hsl(45, 93%, 47%)', icon: AlertCircle },
  notDelivered: { label: 'Did Not Deliver', color: 'hsl(0, 84%, 60%)', icon: XCircle },
  tooEarly: { label: 'Too Early to Tell', color: 'hsl(210, 20%, 60%)', icon: Clock },
  pendingReview: { label: 'Pending Review', color: 'hsl(210, 10%, 75%)', icon: Scale },
};

function DonutChart({ data }: { data: Array<{ name: string; value: number; color: string }> }) {
  const size = 160;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const total = data.reduce((sum, d) => sum + d.value, 0);

  let currentOffset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={center} cy={center} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/20" />
      {data.map((segment, i) => {
        if (segment.value === 0 || total === 0) return null;
        const pct = segment.value / total;
        const segmentLength = pct * circumference;
        const offset = currentOffset;
        currentOffset += segmentLength;

        return (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        );
      })}
    </svg>
  );
}

export function TreasuryAccountabilitySection() {
  const [data, setData] = useState<Effectiveness | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    posthog.capture('treasury_accountability_viewed');
    fetch('/api/treasury/accountability')
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const pieData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.ratingBreakdown)
      .filter(([_, v]) => v > 0)
      .map(([key, value]) => ({
        name: RATING_CONFIG[key]?.label || key,
        value,
        color: RATING_CONFIG[key]?.color || '#888',
      }));
  }, [data]);

  if (loading) return <Skeleton className="h-64 w-full" />;

  if (!data || data.totalEnacted === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Scale className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <h3 className="font-medium text-foreground mb-1">Treasury Accountability</h3>
          <p className="text-sm">No enacted treasury proposals to evaluate yet. Accountability polls will open automatically as enacted proposals become eligible for community review.</p>
        </CardContent>
      </Card>
    );
  }

  const effectivenessColor = data.effectivenessRate === null ? 'text-muted-foreground'
    : data.effectivenessRate >= 70 ? 'text-green-500'
    : data.effectivenessRate >= 50 ? 'text-amber-500'
    : 'text-red-500';

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardContent className="pt-6 pb-4 text-center">
            <div className="text-xs text-muted-foreground mb-1">Spending Effectiveness</div>
            <div className={`text-4xl font-bold tabular-nums ${effectivenessColor}`}>
              {data.effectivenessRate ?? '—'}<span className="text-lg font-normal text-muted-foreground">%</span>
            </div>
            <div className="text-xs text-muted-foreground mt-2">of community-assessed spending rated as delivering</div>
            <div className="mt-3 text-sm">
              <span className="font-semibold">{formatAda(data.totalSpentAda)} ADA</span>
              <span className="text-muted-foreground"> across {data.totalEnacted} proposals</span>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Rating Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="w-40 h-40 flex items-center justify-center">
                <DonutChart data={pieData} />
              </div>
              <div className="flex-1 space-y-2">
                {Object.entries(data.ratingBreakdown).map(([key, value]) => {
                  const config = RATING_CONFIG[key];
                  if (!config || value === 0) return null;
                  const Icon = config.icon;
                  return (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <Icon className="h-3.5 w-3.5" style={{ color: config.color }} />
                      <span className="flex-1">{config.label}</span>
                      <span className="font-mono tabular-nums">{value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {data.topRated.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" /> Best Rated Spending
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.topRated.map((p, i) => (
                <div key={i} className="flex justify-between items-center text-sm py-1.5 border-b last:border-0">
                  <span className="truncate flex-1">{p.title}</span>
                  <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    {formatAda(p.amountAda)} ADA
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {data.bottomRated.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" /> Lowest Rated Spending
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.bottomRated.map((p, i) => (
                <div key={i} className="flex justify-between items-center text-sm py-1.5 border-b last:border-0">
                  <span className="truncate flex-1">{p.title}</span>
                  <Badge variant="secondary" className="ml-2 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    {formatAda(p.amountAda)} ADA
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
