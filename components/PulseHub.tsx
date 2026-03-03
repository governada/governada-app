'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { GovernanceHealthIndex } from '@/components/GovernanceHealthIndex';
import { CrossProposalInsights } from '@/components/CrossProposalInsights';
import { InterBodyPulse } from '@/components/InterBodyPulse';
import { TreasuryHealthWidget } from '@/components/TreasuryHealthWidget';
import { PulseLeaderboardClient } from '@/components/PulseLeaderboardClient';
import { GovernanceObservatory } from '@/components/GovernanceObservatory';

import { GHI_BAND_COLORS, GHI_BAND_LABELS, type GHIBand } from '@/lib/ghi';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import {
  ArrowRight,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  BarChart3,
  Sparkles,
} from 'lucide-react';

interface GHIData {
  score: number;
  band: GHIBand;
  components: Array<{ name: string; value: number; weight: number }>;
}

interface GHITrend {
  direction: 'up' | 'down' | 'flat';
  delta: number;
  streakEpochs: number;
}

interface EpochRecap {
  epoch: number;
  ai_narrative: string;
  proposals_submitted: number;
  votes_cast: number;
  active_dreps: number;
}

interface EDIData {
  current: { compositeScore: number };
  activeDrepCount: number;
  history: Array<{ epoch_no: number; composite_score: number }>;
}

interface LeaderboardData {
  leaderboard: Array<{
    rank: number;
    drepId: string;
    name: string;
    score: number;
    sizeTier: string;
    participation: number;
    rationale: number;
  }>;
}

interface TreasuryData {
  balance: number;
  runwayMonths: number;
  trend: 'growing' | 'shrinking' | 'stable';
}

function formatAda(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(2)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toFixed(0);
}

export function PulseHub() {
  const [ghi, setGhi] = useState<GHIData | null>(null);
  const [ghiTrend, setGhiTrend] = useState<GHITrend | null>(null);
  const [recap, setRecap] = useState<EpochRecap | null>(null);
  const [treasury, setTreasury] = useState<TreasuryData | null>(null);
  const [edi, setEdi] = useState<EDIData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [heroReady, setHeroReady] = useState(false);

  useEffect(() => {
    fetch('/api/governance/health-index/history?epochs=5')
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res) {
          setGhi(res.current);
          setGhiTrend(res.trend ?? null);
        }
      })
      .catch(() => {
        fetch('/api/governance/health-index')
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d) setGhi(d);
          })
          .catch(() => {});
      })
      .finally(() => setHeroReady(true));

    fetch('/api/governance/epoch-recap')
      .then((r) => (r.ok ? r.json() : null))
      .then(setRecap)
      .catch(() => {});

    fetch('/api/treasury/current')
      .then((r) => (r.ok ? r.json() : null))
      .then(setTreasury)
      .catch(() => {});

    fetch('/api/governance/decentralization')
      .then((r) => (r.ok ? r.json() : null))
      .then(setEdi)
      .catch(() => {});

    fetch('/api/governance/leaderboard')
      .then((r) => (r.ok ? r.json() : null))
      .then(setLeaderboard)
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen">
      {/* VP1 — Hero */}
      <section className="relative bg-gradient-to-b from-background to-muted/30 py-16 px-4">
        <div className="container mx-auto max-w-4xl text-center space-y-6">
          <h1 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Governance Intelligence
          </h1>

          {/* GHI Score */}
          {heroReady && ghi ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-2"
            >
              <div className="flex items-baseline gap-3">
                <span
                  className="text-7xl font-bold tabular-nums tracking-tight"
                  style={{ color: GHI_BAND_COLORS[ghi.band] }}
                >
                  {ghi.score}
                </span>
                <div className="flex flex-col items-start">
                  <span
                    className="text-sm font-semibold uppercase tracking-wider"
                    style={{ color: GHI_BAND_COLORS[ghi.band] }}
                  >
                    {GHI_BAND_LABELS[ghi.band]}
                  </span>
                  {ghiTrend && ghiTrend.delta !== 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {ghiTrend.direction === 'up' ? (
                        <TrendingUp className="h-3 w-3 text-green-500" />
                      ) : ghiTrend.direction === 'down' ? (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      ) : (
                        <Minus className="h-3 w-3" />
                      )}
                      {ghiTrend.delta > 0 ? '+' : ''}
                      {Math.round(ghiTrend.delta * 10) / 10} vs last epoch
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ) : heroReady ? (
            <div className="text-4xl font-bold text-muted-foreground/30">—</div>
          ) : (
            <Skeleton className="h-20 w-40 mx-auto rounded-lg" />
          )}

          {/* AI Narrative from epoch recap */}
          {recap?.ai_narrative && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed"
            >
              {recap.ai_narrative.length > 200
                ? recap.ai_narrative.slice(0, 200).trim() + '…'
                : recap.ai_narrative}
            </motion.p>
          )}

          {/* Key stats ticker */}
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground flex-wrap">
            {recap && (
              <>
                <span>{recap.proposals_submitted ?? '—'} proposals this epoch</span>
                <span className="hidden sm:inline text-border">|</span>
                <span>{recap.votes_cast ?? '—'} votes cast</span>
                <span className="hidden sm:inline text-border">|</span>
              </>
            )}
            {treasury && <span>{formatAda(treasury.balance)} ADA in treasury</span>}
          </div>

          <Link
            href="/pulse/report/latest"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Read the full epoch report
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* VP2 — Magazine sections */}
      <div className="container mx-auto max-w-5xl px-4 py-10">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          {/* 1. Epoch Recap */}
          {recap && (
            <motion.div variants={fadeInUp}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5 text-amber-500" />
                    Epoch {recap.epoch} Recap
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {recap.ai_narrative}
                  </p>
                  <Link
                    href="/pulse/history"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Browse all epoch recaps <ArrowRight className="h-3 w-3" />
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* 2. Cross-Proposal Insights */}
          <motion.div variants={fadeInUp}>
            <CrossProposalInsights maxInsights={3} />
          </motion.div>

          {/* 3. Inter-Body Pulse */}
          <motion.div variants={fadeInUp}>
            <InterBodyPulse />
          </motion.div>

          {/* 4. Treasury Health */}
          <motion.div variants={fadeInUp}>
            <TreasuryHealthWidget />
          </motion.div>

          {/* 5. Decentralization */}
          {edi && (
            <motion.div variants={fadeInUp}>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Shield className="h-5 w-5 text-primary" />
                      Decentralization Index
                    </CardTitle>
                    <Link
                      href="/decentralization"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Full dashboard <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-3xl font-bold tabular-nums">
                        {Math.round(edi.current.compositeScore)}
                      </p>
                      <p className="text-xs text-muted-foreground">EDI composite score</p>
                    </div>
                    <div>
                      <p className="text-xl font-semibold tabular-nums text-muted-foreground">
                        {edi.activeDrepCount}
                      </p>
                      <p className="text-xs text-muted-foreground">Active DReps</p>
                    </div>
                    {edi.history.length >= 2 && (
                      <div>
                        <EDITrendBadge history={edi.history} />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* 6. Leaderboard */}
          {leaderboard && (
            <motion.div variants={fadeInUp}>
              <PulseLeaderboardClient initialLeaderboard={leaderboard.leaderboard} />
            </motion.div>
          )}

          {/* 7. Cross-Chain Observatory */}
          <motion.div variants={fadeInUp}>
            <GovernanceObservatory variant="compact" />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

function EDITrendBadge({
  history,
}: {
  history: Array<{ epoch_no: number; composite_score: number }>;
}) {
  const latest = history[history.length - 1];
  const prev = history[history.length - 2];
  if (!latest || !prev) return null;

  const delta = latest.composite_score - prev.composite_score;
  const isUp = delta > 0;
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const color = isUp ? 'text-green-500' : delta < 0 ? 'text-red-500' : 'text-muted-foreground';

  return (
    <div className={`flex items-center gap-1 ${color}`}>
      <Icon className="h-4 w-4" />
      <span className="text-sm font-medium tabular-nums">
        {delta > 0 ? '+' : ''}
        {Math.round(delta * 10) / 10}
      </span>
      <span className="text-xs text-muted-foreground">vs last epoch</span>
    </div>
  );
}
