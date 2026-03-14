'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { fadeInUp, spring, staggerContainer } from '@/lib/animations';
import { loadMatchProfile, type StoredMatchProfile } from '@/lib/matchStore';
import type { GovernancePassport } from '@/lib/passport';
import dynamic from 'next/dynamic';

const GovernanceRadar = dynamic(
  () => import('@/components/GovernanceRadar').then((m) => ({ default: m.GovernanceRadar })),
  { ssr: false },
);

interface StageDiscoverProps {
  passport: GovernancePassport;
  onComplete: (data: {
    alignment: GovernancePassport['alignment'];
    matchedDrepId?: string;
    matchedDrepName?: string;
    matchScore?: number;
  }) => void;
}

export function StageDiscover({ passport, onComplete }: StageDiscoverProps) {
  const [matchProfile, setMatchProfile] = useState<StoredMatchProfile | null>(null);
  const [checked, setChecked] = useState(false);

  // Check for existing match results — either already in passport or in match localStorage
  useEffect(() => {
    const profile = loadMatchProfile();
    if (profile) {
      setMatchProfile(profile);
    }
    setChecked(true);
  }, []);

  // Poll for match completion when user returns from /match
  useEffect(() => {
    if (matchProfile) return;

    const handleFocus = () => {
      const profile = loadMatchProfile();
      if (profile) {
        setMatchProfile(profile);
      }
    };

    window.addEventListener('focus', handleFocus);
    // Also check periodically for same-tab navigation
    const interval = setInterval(() => {
      const profile = loadMatchProfile();
      if (profile) {
        setMatchProfile(profile);
        clearInterval(interval);
      }
    }, 2000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [matchProfile]);

  // Auto-advance when match profile is detected and stage is still 1
  useEffect(() => {
    if (matchProfile && passport.stage === 1) {
      // Fetch the top match from the API to populate passport
      const alignment = matchProfile.userAlignments;

      // Attempt to find the matched DRep info from the match API
      fetch('/api/governance/quick-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: matchProfile.answers }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const topMatch = data?.matches?.[0];
          onComplete({
            alignment,
            matchedDrepId: topMatch?.drepId,
            matchedDrepName: topMatch?.drepName ?? undefined,
            matchScore: topMatch?.matchScore,
          });
        })
        .catch(() => {
          // Even without the top match, advance with alignment data
          onComplete({ alignment });
        });
    }
  }, [matchProfile, passport.stage, onComplete]);

  if (!checked) return null;

  // Already completed this stage — show summary
  if (passport.stage !== 1 && passport.alignment) {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="space-y-6"
      >
        <motion.div variants={fadeInUp} className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
              <Check className="h-4 w-4 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold">Your Governance Values</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            You&apos;ve discovered what you believe in. Here&apos;s your governance identity.
          </p>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="border-emerald-500/20 bg-emerald-950/5">
            <CardContent className="p-6">
              <div className="flex items-center gap-6">
                <GovernanceRadar alignments={passport.alignment} size="medium" animate />
                <div className="space-y-2">
                  {passport.matchedDrepName && (
                    <div>
                      <p className="text-xs text-muted-foreground">Top match</p>
                      <p className="font-semibold">{passport.matchedDrepName}</p>
                      {passport.matchScore != null && (
                        <Badge variant="secondary" className="mt-1">
                          {passport.matchScore}% match
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    );
  }

  // Match profile found — show it with auto-advance
  if (matchProfile) {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="space-y-6"
      >
        <motion.div variants={fadeInUp} className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Match Found</h2>
          </div>
          <p className="text-sm text-muted-foreground">Loading your governance values...</p>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="flex items-center justify-center p-8">
              <GovernanceRadar alignments={matchProfile.userAlignments} size="medium" animate />
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    );
  }

  // No match results — prompt the user to take the quiz
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 text-center"
    >
      <motion.div variants={fadeInUp} className="space-y-3 max-w-md">
        <div className="flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Find out what you believe in</h1>
        <p className="text-muted-foreground">
          Answer 3 questions about what matters to you in Cardano governance. We&apos;ll match you
          with a representative who shares your values.
        </p>
      </motion.div>

      <motion.div variants={fadeInUp} className="space-y-3">
        <Button asChild size="lg" className="gap-2 text-base px-8">
          <Link href="/match">
            Take the Match Quiz
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <p className="text-xs text-muted-foreground">Takes about 60 seconds. No wallet required.</p>
      </motion.div>

      <motion.div
        variants={fadeInUp}
        className="flex flex-wrap justify-center gap-3 text-xs text-muted-foreground/60"
      >
        <span className="flex items-center gap-1">
          <Check className="h-3 w-3" /> 3 quick questions
        </span>
        <span className="flex items-center gap-1">
          <Check className="h-3 w-3" /> Instant results
        </span>
        <span className="flex items-center gap-1">
          <Check className="h-3 w-3" /> No signup needed
        </span>
      </motion.div>
    </motion.div>
  );
}
