'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
import { getStoredSession } from '@/lib/supabaseAuth';
import type { AlignmentScores } from '@/lib/drepIdentity';
import { getDominantDimension, getIdentityColor, getPersonalityLabel } from '@/lib/drepIdentity';
import { buildAlignmentFromAnswers } from '@/lib/matching/answerVectors';
import type { ConfidenceBreakdown } from '@/lib/matching/confidence';
import { MatchConfidenceCTA } from '@/components/matching/MatchConfidenceCTA';
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
  confidenceBreakdown?: ConfidenceBreakdown;
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
  const [drepResults, setDrepResults] = useState<QuickMatchResponse | null>(null);
  const [spoResults, setSpoResults] = useState<QuickMatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storedProfile, setStoredProfile] = useState<StoredMatchProfile | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const posthog = usePostHog();

  const partialIdentityColor = useMemo(() => {
    if (Object.keys(answers).length === 0) return 'hsl(var(--primary))';
    const partial = buildAlignmentFromAnswers(answers);
    const dominant = getDominantDimension(partial);
    return getIdentityColor(dominant).hex;
  }, [answers]);

  // Load stored match profile on mount
  useEffect(() => {
    setStoredProfile(loadMatchProfile());
  }, []);

  const fetchBothMatches = useCallback(async (finalAnswers: Record<string, string>) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const fetchOne = async (type: MatchType) => {
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
      return res.json() as Promise<QuickMatchResponse>;
    };

    try {
      const [drepData, spoData] = await Promise.all([fetchOne('drep'), fetchOne('spo')]);
      setDrepResults(drepData);
      setSpoResults(spoData);
      setStep('results');

      // Mark quick match as completed for authenticated users
      const token = getStoredSession();
      if (token) {
        fetch('/api/governance/quick-match/mark-completed', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }

      // Persist match profile (use DRep data for user alignments — same for both)
      saveMatchProfile({
        userAlignments: drepData.userAlignments,
        personalityLabel: drepData.personalityLabel,
        identityColor: drepData.identityColor,
        matchType: 'drep',
        answers: finalAnswers,
        timestamp: Date.now(),
      });
      setStoredProfile(null);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStep('error');
    }
  }, []);

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
          // All questions answered — fetch both DRep and SPO matches
          setStep('loading');
          fetchBothMatches(newAnswers);
        }
      }, 350);
    },
    [answers, step, fetchBothMatches],
  );

  const restart = useCallback(() => {
    setStep('intro');
    setAnswers({});
    setSelected(null);
    setDrepResults(null);
    setSpoResults(null);
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
              <div
                className="flex-1 flex gap-2"
                role="progressbar"
                aria-valuenow={typeof step === 'number' ? step + 1 : 0}
                aria-valuemin={1}
                aria-valuemax={3}
                aria-label={`Question ${typeof step === 'number' ? step + 1 : 0} of 3`}
              >
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-1 flex-1 rounded-full overflow-hidden bg-muted">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        i < step ? 'w-full' : i === step ? 'w-1/2' : 'w-0',
                      )}
                      style={{ backgroundColor: partialIdentityColor }}
                    />
                  </div>
                ))}
              </div>
              <span className="text-xs text-muted-foreground tabular-nums" aria-hidden="true">
                {step + 1}/3
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        {step === 'intro' && (
          <IntroScreen
            onStart={() => {
              posthog?.capture('quick_match_started');
              setStep(0);
            }}
            storedProfile={storedProfile}
            onViewPrevious={() => {
              if (storedProfile) {
                setAnswers(storedProfile.answers);
                setStep('loading');
                fetchBothMatches(storedProfile.answers);
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
        {step === 'loading' && <LoadingScreen answers={answers} />}
        {step === 'results' && drepResults && spoResults && (
          <ResultsScreen drepResults={drepResults} spoResults={spoResults} onRestart={restart} />
        )}
        {step === 'error' && <ErrorScreen message={error} onRetry={restart} />}
      </div>
    </div>
  );
}

/* ─── Sub-screens ───────────────────────────────────────── */

function IntroScreen({
  onStart,
  storedProfile,
  onViewPrevious,
}: {
  onStart: () => void;
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
          Find Your Governance Match
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
          Answer 3 questions about your governance values and we&apos;ll match you with DReps and
          SPOs who share your vision. Under 60 seconds.
        </p>
        <p className="text-xs text-muted-foreground/80 max-w-md mx-auto">
          DReps vote on governance proposals on your behalf. SPOs secure the network and vote on
          protocol changes.{' '}
          <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
            <Shield className="h-3 w-3 inline shrink-0" />
            Your funds stay in your wallet.
          </span>
        </p>
      </div>

      <Button size="lg" className="text-base px-8 py-6 rounded-xl font-semibold" onClick={onStart}>
        Start Quick Match
        <ArrowRight className="ml-2 h-5 w-5" />
      </Button>

      {/* Previous results CTA */}
      {storedProfile && (
        <button
          onClick={onViewPrevious}
          className="flex items-center gap-2 mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
        >
          <History className="h-4 w-4" />
          View your previous match results
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
              aria-label={`${opt.label}: ${opt.description}`}
              aria-pressed={isSelected}
              className={cn(
                'w-full text-left rounded-xl border p-4 sm:p-5 transition-all duration-200',
                'hover:border-primary/50 hover:bg-primary/5',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
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
                  aria-hidden="true"
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

function LoadingScreen({ answers }: { answers: Record<string, string> }) {
  const { alignments, personalityLabel, identityColor } = useMemo(() => {
    const partial = buildAlignmentFromAnswers(answers);
    const dominant = getDominantDimension(partial);
    return {
      alignments: partial,
      personalityLabel: getPersonalityLabel(partial),
      identityColor: getIdentityColor(dominant),
    };
  }, [answers]);

  return (
    <div
      className="text-center space-y-6 animate-in fade-in duration-500"
      role="status"
      aria-live="polite"
    >
      <div className="flex justify-center">
        <GovernanceRadar alignments={alignments} size="medium" animate />
      </div>
      <div className="space-y-2">
        <p className="font-display text-lg font-semibold">
          Discovering your governance identity...
        </p>
        <Badge
          className="text-xs px-2.5 py-0.5 animate-in fade-in duration-700"
          style={{
            backgroundColor: identityColor.hex + '20',
            color: identityColor.hex,
            borderColor: identityColor.hex + '40',
          }}
        >
          {personalityLabel}
        </Badge>
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

/* ─── Narrative helpers ─────────────────────────────────── */

function getValuesNarrative(alignments: AlignmentScores): string {
  const parts: string[] = [];

  // Treasury stance
  if ((alignments.treasuryConservative ?? 50) > 70) {
    parts.push('protecting the treasury from reckless spending');
  } else if ((alignments.treasuryGrowth ?? 50) > 70) {
    parts.push('investing boldly to grow the ecosystem');
  } else {
    parts.push('evaluating treasury proposals on their individual merits');
  }

  // Protocol stance
  if ((alignments.security ?? 50) > 70) {
    parts.push('prioritizing stability and security over rapid change');
  } else if ((alignments.innovation ?? 50) > 70) {
    parts.push('embracing innovation to keep Cardano competitive');
  } else {
    parts.push('weighing each protocol change on its specific risks and benefits');
  }

  // Transparency stance
  if ((alignments.transparency ?? 50) > 70) {
    parts.push('demanding that representatives explain every vote');
  } else if ((alignments.transparency ?? 50) < 40) {
    parts.push('judging representatives by results, not explanations');
  } else {
    parts.push('appreciating transparency while valuing practical results');
  }

  return `You believe in ${parts[0]}, ${parts[1]}, and ${parts[2]}.`;
}

function getPersonalityDescription(label: string): string {
  const descriptions: Record<string, string> = {
    'The Guardian': 'You protect what matters — treasury discipline and institutional stability.',
    'The Fiscal Hawk': 'You hold every ADA accountable. The treasury exists to be guarded.',
    'The Prudent Steward': 'You balance caution with responsibility. Thoughtful governance.',
    'The Builder': 'You invest in growth. The ecosystem thrives when we fund boldly.',
    'The Growth Champion': 'You push for expansion. Nothing ventured, nothing gained.',
    'The Catalyst': 'You spark change. Strategic investment fuels the future.',
    'The Federalist': 'You champion distributed governance. Power to the community.',
    'The Power Distributor': 'You distribute power. No single entity should dominate.',
    'The Decentralizer': 'You keep decisions close to the people they affect.',
    'The Sentinel': 'You guard the protocol. Security and stability come first.',
    'The Cautious Architect': 'You stand watch over system integrity. Careful, deliberate.',
    'The Shield': 'You smooth out volatility. Steady progress over disruption.',
    'The Pioneer': 'You explore the frontier. Innovation is non-negotiable.',
    'The Changemaker': "You push boundaries. Cardano leads by building what's next.",
    'The Innovator': "You think in decades. Today's experiments are tomorrow's standards.",
    'The Beacon': 'You demand accountability. Every vote explained, every decision justified.',
    'The Transparent Champion': 'You make governance visible. Sunlight is the best disinfectant.',
    'The Open Book': "You hold feet to fire. Transparency isn't optional.",
  };
  return descriptions[label] || "Your unique governance values shape how you see Cardano's future.";
}

function getMatchNarrative(match: MatchResult): string {
  const { agreeDimensions, differDimensions, matchScore } = match;
  const strength = matchScore >= 80 ? 'Strong' : matchScore >= 60 ? 'Good' : 'Moderate';

  if (agreeDimensions.length > 0 && differDimensions.length > 0) {
    return `${strength} alignment on ${agreeDimensions.slice(0, 2).join(' and ')} — you differ on ${differDimensions[0]}.`;
  }
  if (agreeDimensions.length > 0) {
    return `${strength} alignment on ${agreeDimensions.slice(0, 2).join(' and ')}.`;
  }
  if (differDimensions.length > 0) {
    return `${strength} overall match — you differ on ${differDimensions.slice(0, 2).join(' and ')}.`;
  }
  return `${strength} alignment across your governance values.`;
}

function ResultsScreen({
  drepResults,
  spoResults,
  onRestart,
}: {
  drepResults: QuickMatchResponse;
  spoResults: QuickMatchResponse;
  onRestart: () => void;
}) {
  const [activeTab, setActiveTab] = useState<MatchType>('drep');
  const activeResults = activeTab === 'drep' ? drepResults : spoResults;
  const hasMatches = activeResults.matches.length > 0;

  return (
    <div className="w-full max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
      {/* User identity */}
      <div className="text-center space-y-4">
        <h2 className="font-display text-2xl sm:text-3xl font-bold">Your Governance Profile</h2>

        <div className="flex justify-center">
          <GovernanceRadar alignments={drepResults.userAlignments} size="full" />
        </div>

        <div className="space-y-2">
          <Badge
            className="text-sm px-3 py-1"
            style={{
              backgroundColor: drepResults.identityColor + '20',
              color: drepResults.identityColor,
              borderColor: drepResults.identityColor + '40',
            }}
          >
            {drepResults.personalityLabel}
          </Badge>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {getPersonalityDescription(drepResults.personalityLabel)}
          </p>
        </div>

        {/* Values narrative */}
        <div className="text-center max-w-md mx-auto">
          <p className="text-sm text-foreground/90 leading-relaxed">
            {getValuesNarrative(drepResults.userAlignments)}
          </p>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="flex justify-center">
        <div
          className="inline-flex rounded-lg border border-border p-0.5 bg-muted/30"
          role="tablist"
          aria-label="Match results"
        >
          <button
            onClick={() => setActiveTab('drep')}
            role="tab"
            aria-selected={activeTab === 'drep'}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              activeTab === 'drep'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Users className="h-3.5 w-3.5 inline mr-1.5" aria-hidden="true" />
            DReps
            {drepResults.matches.length > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({drepResults.matches.length})
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('spo')}
            role="tab"
            aria-selected={activeTab === 'spo'}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              activeTab === 'spo'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Server className="h-3.5 w-3.5 inline mr-1.5" aria-hidden="true" />
            SPOs
            {spoResults.matches.length > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({spoResults.matches.length})
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Matches */}
      <div
        className="space-y-4"
        role="tabpanel"
        aria-label={`${activeTab === 'drep' ? 'DRep' : 'SPO'} matches`}
      >
        <p className="text-xs text-muted-foreground text-center max-w-md mx-auto">
          {hasMatches
            ? `Match score shows how aligned this ${activeTab === 'spo' ? 'SPO' : 'DRep'}'s voting record is with your preferences. Higher is better.`
            : null}
        </p>

        {hasMatches ? (
          <div className="space-y-4">
            {/* Hero: #1 match */}
            {(() => {
              const heroMatch = activeResults.matches[0];
              const heroName = heroMatch.drepName || heroMatch.drepId.slice(0, 16) + '...';
              const heroIsSPO = activeTab === 'spo';
              const heroProfilePath = heroIsSPO
                ? `/pool/${encodeURIComponent(heroMatch.drepId)}`
                : `/drep/${encodeURIComponent(heroMatch.drepId)}`;
              return (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-primary text-center tracking-wide uppercase">
                    Your Top Match
                  </p>
                  <Card className="overflow-hidden border-primary/20 bg-primary/[0.02]">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex justify-center" aria-hidden="true">
                        <RadarOverlay
                          userAlignments={drepResults.userAlignments}
                          drepAlignments={heroMatch.alignments}
                          size={180}
                        />
                      </div>
                      <div className="text-center space-y-2">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={heroProfilePath}
                            className="font-semibold text-lg hover:text-primary transition-colors"
                          >
                            {heroName}
                          </Link>
                          <Badge
                            variant="outline"
                            className="text-base font-bold text-green-600 border-green-600/30 bg-green-500/5"
                          >
                            {heroMatch.matchScore}%
                          </Badge>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {heroMatch.personalityLabel}
                        </Badge>
                        <p className="text-sm text-muted-foreground">
                          {getMatchNarrative(heroMatch)}
                        </p>
                        <div className="flex gap-2 justify-center pt-1">
                          {!heroIsSPO && (
                            <DelegateButton drepId={heroMatch.drepId} drepName={heroName} />
                          )}
                          <Link href={heroProfilePath}>
                            <Button variant="outline" size="sm" className="gap-1">
                              View Profile <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })()}

            {/* Remaining matches with stagger */}
            {activeResults.matches.slice(1).map((match, i) => (
              <div
                key={match.drepId}
                className="animate-in fade-in slide-in-from-bottom-3"
                style={{ animationDelay: `${(i + 1) * 150}ms`, animationFillMode: 'backwards' }}
              >
                <QuickMatchResultCard
                  rank={i + 2}
                  match={match}
                  userAlignments={drepResults.userAlignments}
                  matchType={activeTab}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              {activeTab === 'spo' ? (
                <Server className="h-6 w-6 text-muted-foreground" />
              ) : (
                <Users className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <p className="font-medium text-sm">
              No {activeTab === 'spo' ? 'SPO' : 'DRep'} matches found
            </p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Not enough {activeTab === 'spo' ? 'SPOs' : 'DReps'} have governance alignment data
              yet. Browse all {activeTab === 'spo' ? 'SPOs' : 'DReps'} to find one manually, or
              check back as more participate in governance.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href={activeTab === 'spo' ? '/discover?tab=spos' : '/discover'}>
                Browse All {activeTab === 'spo' ? 'SPOs' : 'DReps'}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Confidence breakdown + improvement CTAs */}
      {drepResults.confidenceBreakdown && (
        <MatchConfidenceCTA breakdown={drepResults.confidenceBreakdown} variant="full" />
      )}

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2 pb-8">
        <Button asChild size="lg">
          <Link href={activeTab === 'spo' ? '/discover?tab=spos' : '/discover?sort=match'}>
            Browse All {activeTab === 'spo' ? 'SPOs' : 'DReps'}
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
    <Card
      className="overflow-hidden hover:border-primary/30 transition-colors"
      aria-label={`Rank ${rank}: ${displayName}, ${match.matchScore}% match`}
    >
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Radar overlay (desktop) */}
          <div className="hidden sm:block shrink-0" aria-hidden="true">
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
                    {isSPO ? 'Gov Score' : 'Governada Score'}: {match.drepScore}
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

            {/* Match narrative */}
            {(match.agreeDimensions.length > 0 || match.differDimensions.length > 0) && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {getMatchNarrative(match)}
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
