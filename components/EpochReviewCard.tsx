'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Vote, BarChart3, TrendingUp, TrendingDown, Share2, Check } from 'lucide-react';
import { getStoredSession } from '@/lib/supabaseAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { fadeInUp, staggerContainer } from '@/lib/animations';

interface EpochReviewStats {
  proposalsCreated: number;
  drepVotesCast: number;
  yourPollsTaken: number;
  activeDReps: number;
  yourDRepName: string | null;
  yourDRepScore: number | null;
  yourDRepScoreTrend: number;
  governanceLevel: string;
  participationTier: string;
}

interface EpochReviewData {
  epoch: number;
  stats: EpochReviewStats;
}

export function EpochReviewCard() {
  const [data, setData] = useState<EpochReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    const token = getStoredSession();
    if (!token) {
      setLoading(false);
      return;
    }

    fetch('/api/governance/epoch-review', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleShare = () => {
    if (!data) return;
    const s = data.stats;
    const drepName = s.yourDRepName ?? 'My DRep';
    const score = s.yourDRepScore ?? 0;
    const votes = s.drepVotesCast;
    const polls = s.yourPollsTaken;
    const text = `My Epoch ${data.epoch} Review on @GovernadaIO: ${drepName} scored ${score}, ${votes} votes cast, ${polls} polls taken. #CardanoGovernance`;
    navigator.clipboard.writeText(text).then(() => {
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    });
  };

  if (loading) {
    return (
      <Card className="overflow-hidden bg-gradient-to-br from-primary/5 via-background to-cyan-500/5">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="overflow-hidden bg-gradient-to-br from-primary/5 via-background to-cyan-500/5">
        <CardContent className="py-8 text-center text-muted-foreground">
          Connect wallet to see your epoch review
        </CardContent>
      </Card>
    );
  }

  const { epoch, stats } = data;
  const trendIcon =
    stats.yourDRepScoreTrend > 0 ? (
      <TrendingUp className="h-4 w-4 text-emerald-500" />
    ) : stats.yourDRepScoreTrend < 0 ? (
      <TrendingDown className="h-4 w-4 text-amber-500" />
    ) : null;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      <motion.div variants={fadeInUp}>
        <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-cyan-500/5">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Epoch {epoch} Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <motion.div
                variants={fadeInUp}
                className="flex items-center gap-3 rounded-lg border bg-background/50 p-3"
              >
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold tabular-nums">{stats.proposalsCreated}</p>
                  <p className="text-xs text-muted-foreground">Proposals created</p>
                </div>
              </motion.div>
              <motion.div
                variants={fadeInUp}
                className="flex items-center gap-3 rounded-lg border bg-background/50 p-3"
              >
                <Vote className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold tabular-nums">{stats.drepVotesCast}</p>
                  <p className="text-xs text-muted-foreground">DRep votes cast</p>
                </div>
              </motion.div>
              <motion.div
                variants={fadeInUp}
                className="flex items-center gap-3 rounded-lg border bg-background/50 p-3"
              >
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold tabular-nums">{stats.yourPollsTaken}</p>
                  <p className="text-xs text-muted-foreground">Your polls taken</p>
                </div>
              </motion.div>
              <motion.div
                variants={fadeInUp}
                className="flex items-center gap-3 rounded-lg border bg-background/50 p-3"
              >
                <div className="flex items-center gap-2">
                  {trendIcon}
                  <span className="text-2xl font-bold tabular-nums">
                    {stats.yourDRepScore ?? '—'}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Your DRep score</p>
                  {stats.yourDRepScoreTrend !== 0 && (
                    <p
                      className={`text-xs font-medium ${
                        stats.yourDRepScoreTrend > 0 ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {stats.yourDRepScoreTrend > 0 ? '+' : ''}
                      {stats.yourDRepScoreTrend}
                    </p>
                  )}
                </div>
              </motion.div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{stats.governanceLevel}</Badge>
              <Badge variant="outline">{stats.participationTier}</Badge>
            </div>

            <Button variant="outline" size="sm" onClick={handleShare} className="w-full sm:w-auto">
              {shared ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              <span>{shared ? 'Copied!' : 'Share'}</span>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
