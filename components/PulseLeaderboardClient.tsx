'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy } from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  drepId: string;
  name: string;
  score: number;
  sizeTier: string;
  participation: number;
  rationale: number;
}

interface PulseLeaderboardClientProps {
  initialLeaderboard: LeaderboardEntry[];
}

const SIZE_COLORS: Record<string, string> = {
  Small: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Large: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Whale: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function tierColorClass(score: number) {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export function PulseLeaderboardClient({ initialLeaderboard }: PulseLeaderboardClientProps) {
  const [tierFilter, setTierFilter] = useState('all');
  const [leaderboard, setLeaderboard] = useState(initialLeaderboard);

  useEffect(() => {
    if (tierFilter === 'all') {
      setLeaderboard(initialLeaderboard);
      return;
    }
    fetch(`/api/governance/leaderboard?tier=${tierFilter}`)
      .then((r) => r.json())
      .then((d) => setLeaderboard(d.leaderboard))
      .catch(() => {});
  }, [tierFilter, initialLeaderboard]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            DRep Leaderboard
          </CardTitle>
          <div className="flex gap-1.5">
            {['all', 'Small', 'Medium', 'Large', 'Whale'].map((t) => (
              <Button
                key={t}
                variant={tierFilter === t ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-7 px-2.5"
                onClick={() => setTierFilter(t)}
              >
                {t === 'all' ? 'All' : t}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {leaderboard.map((d) => (
            <Link key={d.drepId} href={`/drep/${encodeURIComponent(d.drepId)}`} className="block">
              <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <span
                  className={`text-lg font-bold tabular-nums w-8 ${d.rank <= 3 ? 'text-amber-500' : 'text-muted-foreground'}`}
                >
                  #{d.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${SIZE_COLORS[d.sizeTier] || ''}`}
                    >
                      {d.sizeTier}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      P:{d.participation}% R:{d.rationale}%
                    </span>
                  </div>
                </div>
                <span className={`text-xl font-bold tabular-nums ${tierColorClass(d.score)}`}>
                  {d.score}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
