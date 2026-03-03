'use client';

import { useEffect, useState, useCallback } from 'react';
import { posthog } from '@/lib/posthog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calculator, ArrowRight, TrendingUp } from 'lucide-react';

interface SimulationResult {
  current: { score: number; participation: number; rationale: number; rank: number };
  simulated: { score: number; participation: number; rationale: number; rank: number };
}

export function ScoreSimulator({ drepId, pendingCount }: { drepId: string; pendingCount: number }) {
  const [votes, setVotes] = useState(0);
  const [rationales, setRationales] = useState(0);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const maxVotes = Math.max(pendingCount, 10);

  const simulate = useCallback(async () => {
    if (votes === 0) {
      setResult(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/dashboard/simulate?drepId=${encodeURIComponent(drepId)}&votes=${votes}&rationales=${rationales}`,
      );
      const data = await res.json();
      if (data.current) setResult(data);
      posthog.capture('score_simulator_adjusted', { drepId, votes, rationales });
    } catch {
    } finally {
      setLoading(false);
    }
  }, [drepId, votes, rationales]);

  useEffect(() => {
    const timer = setTimeout(simulate, 300);
    return () => clearTimeout(timer);
  }, [simulate]);

  useEffect(() => {
    posthog.capture('score_simulator_viewed', { drepId });
  }, [drepId]);

  const presets = [
    { label: 'All + rationale', v: pendingCount, r: pendingCount },
    { label: 'All, no rationale', v: pendingCount, r: 0 },
    { label: 'Half + rationale', v: Math.ceil(pendingCount / 2), r: Math.ceil(pendingCount / 2) },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4" />
          Score Simulator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Presets */}
        {pendingCount > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <Button
                key={p.label}
                variant={votes === p.v && rationales === p.r ? 'default' : 'outline'}
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => {
                  setVotes(p.v);
                  setRationales(p.r);
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
        )}

        {/* Sliders */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Votes to cast</span>
              <span className="font-medium tabular-nums">{votes}</span>
            </div>
            <input
              type="range"
              min={0}
              max={maxVotes}
              value={votes}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                setVotes(v);
                if (rationales > v) setRationales(v);
              }}
              className="w-full accent-primary h-1.5"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">With rationale</span>
              <span className="font-medium tabular-nums">{rationales}</span>
            </div>
            <input
              type="range"
              min={0}
              max={votes}
              value={rationales}
              onChange={(e) => setRationales(parseInt(e.target.value))}
              className="w-full accent-primary h-1.5"
            />
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className="bg-muted/40 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-center gap-3">
              <div className="text-center">
                <span className="text-xl font-bold tabular-nums">{result.current.score}</span>
                <p className="text-[10px] text-muted-foreground">Current</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="text-center">
                <span
                  className={`text-xl font-bold tabular-nums ${result.simulated.score > result.current.score ? 'text-green-600 dark:text-green-400' : ''}`}
                >
                  {result.simulated.score}
                </span>
                <p className="text-[10px] text-muted-foreground">Projected</p>
              </div>
              {result.simulated.score > result.current.score && (
                <Badge variant="secondary" className="text-[10px]">
                  <TrendingUp className="h-3 w-3 mr-1" />+
                  {result.simulated.score - result.current.score}
                </Badge>
              )}
            </div>

            {result.simulated.rank < result.current.rank && (
              <p className="text-[10px] text-center text-muted-foreground">
                Rank: #{result.current.rank} →{' '}
                <span className="font-semibold text-foreground">#{result.simulated.rank}</span>
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <span className="text-muted-foreground">Participation:</span>{' '}
                <span className="font-medium">
                  {result.current.participation}% → {result.simulated.participation}%
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Rationale:</span>{' '}
                <span className="font-medium">
                  {result.current.rationale}% → {result.simulated.rationale}%
                </span>
              </div>
            </div>
          </div>
        )}

        {!result && votes === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Adjust the sliders to see how your score would change.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
