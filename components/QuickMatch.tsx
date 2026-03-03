'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Loader2, Sparkles, ChevronRight } from 'lucide-react';
import { GovernanceRadar } from '@/components/GovernanceRadar';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { AlignmentScores } from '@/lib/drepIdentity';

interface QuickMatchResult {
  matches: {
    drepId: string;
    drepName: string | null;
    drepScore: number;
    matchScore: number;
    identityColor: string;
    personalityLabel: string;
  }[];
  userAlignments: AlignmentScores;
  personalityLabel: string;
  identityColor: string;
}

interface QuickMatchPoolResult {
  matches: {
    poolId: string;
    poolName: string | null;
    governanceScore: number;
    matchScore: number;
    voteCount: number;
  }[];
}

interface Question {
  id: 'treasury' | 'protocol' | 'transparency';
  title: string;
  subtitle: string;
  options: { value: string; label: string; description: string }[];
}

const QUESTIONS: Question[] = [
  {
    id: 'treasury',
    title: 'Treasury spending',
    subtitle: 'When it comes to Cardano treasury funds, I prefer...',
    options: [
      {
        value: 'conservative',
        label: 'Conservative',
        description: 'Protect the treasury. Only fund proven, essential projects.',
      },
      {
        value: 'growth',
        label: 'Growth',
        description: 'Invest aggressively. Fund innovation to grow the ecosystem.',
      },
      {
        value: 'balanced',
        label: 'Balanced',
        description: 'Case-by-case. Fund high-quality proposals regardless of size.',
      },
    ],
  },
  {
    id: 'protocol',
    title: 'Protocol changes',
    subtitle: 'On protocol upgrades and parameter changes, I lean toward...',
    options: [
      {
        value: 'caution',
        label: 'Security first',
        description: 'Move slowly. Stability and security are paramount.',
      },
      {
        value: 'innovation',
        label: 'Innovation first',
        description: 'Move fast. Progress requires calculated risk-taking.',
      },
      {
        value: 'case_by_case',
        label: 'It depends',
        description: 'Evaluate each change on its own merits.',
      },
    ],
  },
  {
    id: 'transparency',
    title: 'DRep transparency',
    subtitle: 'How important is transparency from your DRep?',
    options: [
      {
        value: 'essential',
        label: 'Essential',
        description: 'DReps must explain every vote publicly. Transparency is governance.',
      },
      {
        value: 'nice_to_have',
        label: 'Nice to have',
        description: "I appreciate transparency but don't require it for every decision.",
      },
      {
        value: 'doesnt_matter',
        label: "Doesn't matter",
        description: 'Results matter more than process. Just vote well.',
      },
    ],
  },
];

const DEFAULT_ALIGNMENTS: AlignmentScores = {
  treasuryConservative: 50,
  treasuryGrowth: 50,
  decentralization: 50,
  security: 50,
  innovation: 50,
  transparency: 50,
};

const PARTIAL_VECTORS: Record<string, Record<string, Partial<AlignmentScores>>> = {
  treasury: {
    conservative: { treasuryConservative: 85, treasuryGrowth: 20 },
    growth: { treasuryConservative: 20, treasuryGrowth: 85 },
    balanced: { treasuryConservative: 55, treasuryGrowth: 55 },
  },
  protocol: {
    caution: { security: 85, innovation: 25 },
    innovation: { security: 25, innovation: 85 },
    case_by_case: { security: 55, innovation: 55 },
  },
  transparency: {
    essential: { transparency: 90, decentralization: 70 },
    nice_to_have: { transparency: 55, decentralization: 50 },
    doesnt_matter: { transparency: 20, decentralization: 35 },
  },
};

export function QuickMatch() {
  const [matchType, setMatchType] = useState<'drep' | 'pool'>('drep');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuickMatchResult | null>(null);
  const [poolResult, setPoolResult] = useState<QuickMatchPoolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [liveAlignments, setLiveAlignments] = useState<AlignmentScores>(DEFAULT_ALIGNMENTS);

  const handleAnswer = useCallback(
    async (questionId: string, value: string) => {
      const newAnswers = { ...answers, [questionId]: value };
      setAnswers(newAnswers);

      const updated = { ...DEFAULT_ALIGNMENTS };
      for (const [qId, ans] of Object.entries(newAnswers)) {
        const vec = PARTIAL_VECTORS[qId]?.[ans];
        if (vec) {
          for (const [dim, val] of Object.entries(vec)) {
            (updated as Record<string, number>)[dim] = val as number;
          }
        }
      }
      setLiveAlignments(updated);

      if (step < QUESTIONS.length - 1) {
        setTimeout(() => setStep(step + 1), 300);
      } else {
        setLoading(true);
        try {
          const endpoint =
            matchType === 'pool'
              ? '/api/governance/quick-match-pool'
              : '/api/governance/quick-match';
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newAnswers),
          });
          if (res.ok) {
            const data = await res.json();
            if (matchType === 'pool') {
              setPoolResult(data);
              setResult(null);
            } else {
              setResult(data);
              setPoolResult(null);
            }
          }
        } catch (err) {
          console.error('Quick match failed:', err);
        }
        setLoading(false);
      }
    },
    [answers, step, matchType],
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">
          {matchType === 'pool' ? 'Finding your pool matches...' : 'Finding your DRep matches...'}
        </p>
      </div>
    );
  }

  if (poolResult) {
    return <QuickMatchPoolResults result={poolResult} />;
  }

  if (result) {
    return <QuickMatchResults result={result} />;
  }

  const question = QUESTIONS[step];

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-1 p-1 rounded-full bg-muted">
          <button
            type="button"
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
              matchType === 'drep'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setMatchType('drep')}
          >
            Find a DRep
          </button>
          <button
            type="button"
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
              matchType === 'pool'
                ? 'bg-cyan-500 text-white'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setMatchType('pool')}
          >
            Find a Pool
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {QUESTIONS.map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              i <= step ? 'bg-primary' : 'bg-muted',
            )}
          />
        ))}
      </div>

      <div className="grid md:grid-cols-[1fr,200px] gap-8 items-start">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Question {step + 1} of {QUESTIONS.length}
              </p>
              <h2 className="text-xl font-semibold">{question.subtitle}</h2>
            </div>

            <div className="space-y-3">
              {question.options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleAnswer(question.id, opt.value)}
                  className={cn(
                    'w-full text-left p-4 rounded-lg border transition-all hover:border-primary/50 hover:bg-primary/5',
                    answers[question.id] === opt.value && 'border-primary bg-primary/10',
                  )}
                >
                  <p className="font-medium text-sm">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="hidden md:flex flex-col items-center gap-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Your profile</p>
          <GovernanceRadar alignments={liveAlignments} size="medium" animate />
        </div>
      </div>
    </div>
  );
}

function QuickMatchResults({ result }: { result: QuickMatchResult }) {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center text-center gap-4"
      >
        <GovernanceRadar alignments={result.userAlignments} size="full" animate />
        <div>
          <Badge
            variant="outline"
            className="text-sm px-3 py-1"
            style={{ borderColor: result.identityColor, color: result.identityColor }}
          >
            {result.personalityLabel}
          </Badge>
          <p className="text-sm text-muted-foreground mt-2">Your governance values profile</p>
        </div>
      </motion.div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Your Top Matches</h3>
        {result.matches.slice(0, 3).map((match, i) => (
          <motion.div
            key={match.drepId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * (i + 1) }}
          >
            <Link href={`/drep/${encodeURIComponent(match.drepId)}`}>
              <Card className="hover:border-primary/30 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: match.identityColor }}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-medium text-sm">
                        {match.drepName || match.drepId.slice(0, 12) + '...'}
                      </p>
                      <p className="text-xs text-muted-foreground">{match.personalityLabel}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        'tabular-nums',
                        match.matchScore >= 70
                          ? 'text-green-600 border-green-600/30'
                          : match.matchScore >= 50
                            ? 'text-amber-600 border-amber-600/30'
                            : 'text-muted-foreground',
                      )}
                    >
                      {match.matchScore}% match
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-6 text-center space-y-3">
          <Sparkles className="h-6 w-6 text-primary mx-auto" />
          <h4 className="font-semibold">Want better accuracy?</h4>
          <p className="text-sm text-muted-foreground">
            These matches are based on your values. The DNA Quiz votes on real proposals for higher
            accuracy.
          </p>
          <Link href="/discover">
            <Button className="gap-2">
              Take the DNA Quiz <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function QuickMatchPoolResults({ result }: { result: QuickMatchPoolResult }) {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Your Top Pool Matches</h3>
        {result.matches.map((match, i) => (
          <motion.div
            key={match.poolId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * (i + 1) }}
          >
            <Link href={`/pool/${encodeURIComponent(match.poolId)}`}>
              <Card className="hover:border-cyan-500/40 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white bg-cyan-500">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-medium text-sm">
                        {match.poolName || match.poolId.slice(0, 12) + '…'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge
                          variant="outline"
                          className="text-cyan-500 border-cyan-500/40 text-xs"
                        >
                          Score {match.governanceScore}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {match.voteCount} votes
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        'tabular-nums',
                        match.matchScore >= 70
                          ? 'text-green-600 border-green-600/30'
                          : match.matchScore >= 50
                            ? 'text-amber-600 border-amber-600/30'
                            : 'text-muted-foreground',
                      )}
                    >
                      {match.matchScore}% match
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent">
        <CardContent className="p-6 text-center space-y-3">
          <Sparkles className="h-6 w-6 text-cyan-500 mx-auto" />
          <h4 className="font-semibold">Explore more pools</h4>
          <p className="text-sm text-muted-foreground">
            Browse governance-active stake pools and compare their voting records.
          </p>
          <Link href="/discover?tab=pools">
            <Button
              variant="outline"
              className="gap-2 border-cyan-500/40 text-cyan-600 hover:bg-cyan-500/10"
            >
              Discover Pools <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
