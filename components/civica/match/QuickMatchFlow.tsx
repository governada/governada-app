'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Shield,
  Rocket,
  Scale,
  Lock,
  Lightbulb,
  HelpCircle,
  Sparkles,
  Eye,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ChevronRight,
  Zap,
  RotateCcw,
  History,
  Server,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GovernanceRadar } from '@/components/GovernanceRadar';
import { RadarOverlay } from '@/components/matching/RadarOverlay';
import { cn } from '@/lib/utils';
import { usePostHog } from 'posthog-js/react';
import { DelegateButton } from '@/components/DelegateButton';
import type { AlignmentScores } from '@/lib/drepIdentity';
import { saveMatchProfile, loadMatchProfile, type StoredMatchProfile } from '@/lib/matchStore';

/* ─── Types ─────────────────────────────────────────────── */

interface MatchResult {
  drepId: string;
  drepName: string | null;
  drepScore: number;
  matchScore: number;
  identityColor: string;
  personalityLabel: string;
  alignments: AlignmentScores;
  agreeDimensions: string[];
  differDimensions: string[];
}

interface QuickMatchResponse {
  matches: MatchResult[];
  userAlignments: AlignmentScores;
  personalityLabel: string;
  identityColor: string;
}

/* ─── Question definitions ──────────────────────────────── */

interface QuestionOption {
  value: string;
  label: string;
  description: string;
  icon: typeof Shield;
}

interface Question {
  id: string;
  title: string;
  subtitle: string;
  options: QuestionOption[];
}

const QUESTIONS: Question[] = [
  {
    id: 'treasury',
    title: 'How should Cardano\u2019s treasury be managed?',
    subtitle: 'The treasury funds ecosystem growth \u2014 currently holding billions of ADA.',
    options: [
      {
        value: 'conservative',
        label: 'Conservative',
        description: 'Protect the treasury. Fund only proven, essential projects.',
        icon: Shield,
      },
      {
        value: 'growth',
        label: 'Growth',
        description: 'Invest boldly. Fund innovation and rapid ecosystem expansion.',
        icon: Rocket,
      },
      {
        value: 'balanced',
        label: 'Balanced',
        description: 'Evaluate each proposal on its merits. Balance caution with ambition.',
        icon: Scale,
      },
    ],
  },
  {
    id: 'protocol',
    title: 'How should protocol changes be approached?',
    subtitle: 'Protocol upgrades shape Cardano\u2019s technical direction and security.',
    options: [
      {
        value: 'caution',
        label: 'Caution First',
        description: 'Prioritize stability and security. Move carefully and deliberately.',
        icon: Lock,
      },
      {
        value: 'innovation',
        label: 'Innovation First',
        description: 'Embrace change. Cardano needs to evolve rapidly to compete.',
        icon: Lightbulb,
      },
      {
        value: 'case_by_case',
        label: 'Case by Case',
        description: 'Assess each change on its specific risks and benefits.',
        icon: HelpCircle,
      },
    ],
  },
  {
    id: 'transparency',
    title: 'How important is transparency in governance?',
    subtitle: 'Should representatives explain their voting decisions?',
    options: [
      {
        value: 'essential',
        label: 'Essential',
        description: 'Non-negotiable. DReps must explain every vote publicly.',
        icon: Sparkles,
      },
      {
        value: 'nice_to_have',
        label: 'Nice to Have',
        description: 'Helpful when possible, but not required for every decision.',
        icon: Eye,
      },
      {
        value: 'doesnt_matter',
        label: 'Results Over Process',
        description: 'Results matter more than explanations. Let votes speak.',
        icon: Zap,
      },
    ],
  },
];

/* ─── Component ─────────────────────────────────────────── */

type Step = 'intro' | 0 | 1 | 2 | 'loading' | 'results' | 'error';
type MatchType = 'drep' | 'spo';

export function QuickMatchFlow() {
  const [step, setStep] = useState<Step>('intro');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [results, setResults] = useState<QuickMatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matchType, setMatchType] = useState<MatchType>('drep');
  const [storedProfile, setStoredProfile] = useState<StoredMatchProfile | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const posthog = usePostHog();

  // Load stored match profile on mount
  useEffect(() => {
    setStoredProfile(loadMatchProfile());
  }, []);

  const fetchMatches = useCallback(
    async (finalAnswers: Record<string, string>, type: MatchType) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch('/api/governance/quick-match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            treasury: finalAnswers.treasury,
            protocol: finalAnswers.protocol,
            transparency: finalAnswers.transparency,
            match_type: type,
          }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const data: QuickMatchResponse = await res.json();
        setResults(data);
        setStep('results');

        // Persist match profile
        saveMatchProfile({
          userAlignments: data.userAlignments,
          personalityLabel: data.personalityLabel,
          identityColor: data.identityColor,
          matchType: type,
          answers: finalAnswers,
          timestamp: Date.now(),
        });
        setStoredProfile(null); // Clear "previous match" since we just did a new one
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Something went wrong');
        setStep('error');
      }
    },
    [],
  );

  const handleAnswer = useCallback(
    (questionId: string, value: string) => {
      setSelected(value);
      const newAnswers = { ...answers, [questionId]: value };
      setAnswers(newAnswers);

      // Auto-advance after brief feedback
      setTimeout(() => {
        setSelected(null);
        const currentQ = typeof step === 'number' ? step : -1;
        if (currentQ < 2) {
          setStep((currentQ + 1) as 0 | 1 | 2);
        } else {
          // All questions answered — fetch matches
          setStep('loading');
          fetchMatches(newAnswers, matchType);
        }
      }, 350);
    },
    [answers, step, fetchMatches, matchType],
  );

  const restart = useCallback(() => {
    setStep('intro');
    setAnswers({});
    setSelected(null);
    setResults(null);
    setError(null);
  }, []);

  const goBack = useCallback(() => {
    if (typeof step === 'number' && step > 0) {
      setStep((step - 1) as 0 | 1 | 2);
    } else if (step === 0) {
      setStep('intro');
    }
  }, [step]);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Progress bar */}
      {typeof step === 'number' && (
        <div className="sticky top-14 z-10 bg-background/80 backdrop-blur-sm border-b border-border/30">
          <div className="mx-auto max-w-2xl px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={goBack}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                aria-label="Go back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex-1 flex gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-1 flex-1 rounded-full overflow-hidden bg-muted">
                    <div
                      className={cn(
                        'h-full rounded-full bg-primary transition-all duration-300',
                        i < step ? 'w-full' : i === step ? 'w-1/2' : 'w-0',
                      )}
                    />
                  </div>
                ))}
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{step + 1}/3</span>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        {step === 'intro' && (
          <IntroScreen
            onStart={() => {
              posthog?.capture('quick_match_started', { match_type: matchType });
              setStep(0);
            }}
            matchType={matchType}
            onMatchTypeChange={setMatchType}
            storedProfile={storedProfile}
            onViewPrevious={() => {
              if (storedProfile) {
                setMatchType(storedProfile.matchType);
                setAnswers(storedProfile.answers);
                setStep('loading');
                fetchMatches(storedProfile.answers, storedProfile.matchType);
              }
            }}
          />
        )}
        {typeof step === 'number' && (
          <QuestionScreen
            question={QUESTIONS[step]}
            selected={selected}
            onSelect={(value) => handleAnswer(QUESTIONS[step].id, value)}
          />
        )}
        {step === 'loading' && <LoadingScreen />}
        {step === 'results' && results && (
          <ResultsScreen results={results} onRestart={restart} matchType={matchType} />
        )}
        {step === 'error' && <ErrorScreen message={error} onRetry={restart} />}
      </div>
    </div>
  );
}

/* ─── Sub-screens ───────────────────────────────────────── */

function IntroScreen({
  onStart,
  matchType,
  onMatchTypeChange,
  storedProfile,
  onViewPrevious,
}: {
  onStart: () => void;
  matchType: MatchType;
  onMatchTypeChange: (type: MatchType) => void;
  storedProfile: StoredMatchProfile | null;
  onViewPrevious: () => void;
}) {
  return (
    <div className="text-center max-w-lg space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Zap className="h-8 w-8 text-primary" />
      </div>
      <div className="space-y-2">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
          {matchType === 'spo' ? 'Find Your SPO' : 'Find Your DRep'}
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
          Answer 3 questions about your governance values. We&apos;ll match you to{' '}
          {matchType === 'spo' ? 'stake pool operators' : 'DReps'} who think like you.
        </p>
      </div>

      {/* Match type toggle */}
      <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30">
        <button
          onClick={() => onMatchTypeChange('drep')}
          className={cn(
            'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
            matchType === 'drep'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Users className="h-3.5 w-3.5 inline mr-1.5" />
          DReps
        </button>
        <button
          onClick={() => onMatchTypeChange('spo')}
          className={cn(
            'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
            matchType === 'spo'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Server className="h-3.5 w-3.5 inline mr-1.5" />
          SPOs
        </button>
      </div>

      <Button size="lg" className="text-base px-8 py-6 rounded-xl font-semibold" onClick={onStart}>
        Start Quick Match
        <ArrowRight className="ml-2 h-5 w-5" />
      </Button>

      {/* Previous results CTA */}
      {storedProfile && (
        <button
          onClick={onViewPrevious}
          className="flex items-center gap-2 mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <History className="h-4 w-4" />
          View your previous {storedProfile.matchType === 'spo' ? 'SPO' : 'DRep'} match results
        </button>
      )}

      <p className="text-xs text-muted-foreground">
        No wallet required &middot; Takes under 60 seconds
      </p>
    </div>
  );
}

function QuestionScreen({
  question,
  selected,
  onSelect,
}: {
  question: Question;
  selected: string | null;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="w-full max-w-2xl space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
      <div className="text-center space-y-2">
        <h2 className="font-display text-xl sm:text-2xl font-bold">{question.title}</h2>
        <p className="text-sm text-muted-foreground">{question.subtitle}</p>
      </div>

      <div className="grid gap-3">
        {question.options.map((opt) => {
          const Icon = opt.icon;
          const isSelected = selected === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => !selected && onSelect(opt.value)}
              disabled={!!selected}
              className={cn(
                'w-full text-left rounded-xl border p-4 sm:p-5 transition-all duration-200',
                'hover:border-primary/50 hover:bg-primary/5',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                isSelected
                  ? 'border-primary bg-primary/10 scale-[0.98]'
                  : selected
                    ? 'opacity-50'
                    : 'border-border bg-card',
              )}
            >
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm sm:text-base">{opt.label}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{opt.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="text-center space-y-6 animate-in fade-in duration-300">
      <div className="relative mx-auto w-24 h-24">
        <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
        <div className="absolute inset-2 rounded-full border-2 border-primary/40 animate-pulse" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      </div>
      <div className="space-y-1">
        <p className="font-display text-lg font-semibold">Analyzing your governance values...</p>
        <p className="text-sm text-muted-foreground">Matching against {'>'}400 active DReps</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className="text-center max-w-md space-y-4 animate-in fade-in duration-300">
      <p className="text-lg font-semibold">Something went wrong</p>
      <p className="text-sm text-muted-foreground">{message || 'Please try again.'}</p>
      <Button onClick={onRetry} variant="outline">
        <RotateCcw className="mr-2 h-4 w-4" />
        Try Again
      </Button>
    </div>
  );
}

function ResultsScreen({
  results,
  onRestart,
  matchType,
}: {
  results: QuickMatchResponse;
  onRestart: () => void;
  matchType: MatchType;
}) {
  const isSPO = matchType === 'spo';

  return (
    <div className="w-full max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
      {/* User identity */}
      <div className="text-center space-y-4">
        <h2 className="font-display text-2xl sm:text-3xl font-bold">Your Governance Profile</h2>

        <div className="flex justify-center">
          <GovernanceRadar alignments={results.userAlignments} size="full" />
        </div>

        <div className="space-y-1">
          <Badge
            className="text-sm px-3 py-1"
            style={{
              backgroundColor: results.identityColor + '20',
              color: results.identityColor,
              borderColor: results.identityColor + '40',
            }}
          >
            {results.personalityLabel}
          </Badge>
          <p className="text-sm text-muted-foreground">Based on your governance values</p>
        </div>
      </div>

      {/* Matches */}
      <div className="space-y-4">
        <h3 className="font-display text-lg font-semibold text-center">
          Your Top {isSPO ? 'SPO' : 'DRep'} Matches
        </h3>

        <div className="grid gap-3">
          {results.matches.map((match, i) => (
            <QuickMatchResultCard
              key={match.drepId}
              rank={i + 1}
              match={match}
              userAlignments={results.userAlignments}
              matchType={matchType}
            />
          ))}
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2 pb-8">
        <Button asChild size="lg">
          <Link href={isSPO ? '/discover?tab=spos' : '/discover?sort=match'}>
            Browse All {isSPO ? 'SPOs' : 'DReps'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button variant="outline" size="lg" onClick={onRestart}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Retake Quiz
        </Button>
      </div>
    </div>
  );
}

/* ─── Result card ───────────────────────────────────────── */

function QuickMatchResultCard({
  rank,
  match,
  userAlignments,
  matchType = 'drep',
}: {
  rank: number;
  match: MatchResult;
  userAlignments: AlignmentScores;
  matchType?: MatchType;
}) {
  const displayName = match.drepName || match.drepId.slice(0, 16) + '...';
  const isSPO = matchType === 'spo';
  const profilePath = isSPO
    ? `/pool/${encodeURIComponent(match.drepId)}`
    : `/drep/${encodeURIComponent(match.drepId)}`;

  return (
    <Card className="overflow-hidden hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Radar overlay (desktop) */}
          <div className="hidden sm:block shrink-0">
            <RadarOverlay
              userAlignments={userAlignments}
              drepAlignments={match.alignments}
              size={120}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: match.identityColor || 'hsl(var(--primary))' }}
                >
                  {rank}
                </span>
                <div className="min-w-0">
                  <Link
                    href={profilePath}
                    className="font-semibold text-sm hover:text-primary transition-colors truncate block"
                  >
                    {displayName}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {isSPO ? 'Gov Score' : 'Civica Score'}: {match.drepScore}
                  </span>
                </div>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'shrink-0 tabular-nums text-sm font-bold',
                  match.matchScore >= 70
                    ? 'text-green-600 border-green-600/30 bg-green-500/5'
                    : match.matchScore >= 50
                      ? 'text-amber-600 border-amber-600/30 bg-amber-500/5'
                      : 'text-muted-foreground',
                )}
              >
                {match.matchScore}%
              </Badge>
            </div>

            {/* Personality */}
            <Badge variant="secondary" className="text-[10px]">
              {match.personalityLabel}
            </Badge>

            {/* Dimension agreement */}
            {(match.agreeDimensions.length > 0 || match.differDimensions.length > 0) && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {match.agreeDimensions.length > 0 && (
                  <>
                    <span className="text-green-600 dark:text-green-400">Agree on: </span>
                    {match.agreeDimensions.join(', ')}
                  </>
                )}
                {match.agreeDimensions.length > 0 && match.differDimensions.length > 0 && '. '}
                {match.differDimensions.length > 0 && (
                  <>
                    <span className="text-amber-600 dark:text-amber-400">Differ on: </span>
                    {match.differDimensions.join(', ')}
                  </>
                )}
              </p>
            )}

            <div className="flex gap-2 mt-1">
              {!isSPO && (
                <DelegateButton
                  drepId={match.drepId}
                  drepName={displayName}
                  size="sm"
                  className="text-xs h-7"
                />
              )}
              <Link href={profilePath}>
                <Button variant="outline" size="sm" className="text-xs gap-1 h-7">
                  View Profile <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
