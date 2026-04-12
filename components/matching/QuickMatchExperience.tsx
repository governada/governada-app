'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Compass,
  ExternalLink,
  Layers3,
  Loader2,
  RotateCcw,
  Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { GovernanceRadar } from '@/components/GovernanceRadar';
import { MatchConfidenceCTA } from '@/components/matching/MatchConfidenceCTA';
import {
  getDominantDimension,
  getIdentityColor,
  getPersonalityLabel,
  type AlignmentScores,
} from '@/lib/drepIdentity';
import { ANSWER_VECTORS } from '@/lib/matching/answerVectors';
import { cn } from '@/lib/utils';
import { posthog } from '@/lib/posthog';
import { useQuickMatch, type MatchResult, type QuickMatchAnswers } from '@/hooks/useQuickMatch';

type MatchStage = 'intro' | number;

interface QuickMatchExperienceProps {
  analyticsSource?: string;
  onInspectMatch?: (match: MatchResult) => void;
}

interface MatchQuestion {
  id: keyof QuickMatchAnswers;
  eyebrow: string;
  prompt: string;
  helper: string;
  options: Array<{
    value: string;
    label: string;
    description: string;
  }>;
}

const QUESTIONS: MatchQuestion[] = [
  {
    id: 'treasury',
    eyebrow: 'Treasury judgment',
    prompt: 'How should Cardano deploy treasury capital right now?',
    helper: 'Pick the operating instinct you most want a representative to show.',
    options: [
      {
        value: 'conservative',
        label: 'Protect downside',
        description: 'Fund only proven work and guard the treasury carefully.',
      },
      {
        value: 'growth',
        label: 'Push expansion',
        description: 'Use treasury aggressively to accelerate ecosystem growth.',
      },
      {
        value: 'balanced',
        label: 'Judge case by case',
        description: 'Back strong proposals regardless of size or category.',
      },
    ],
  },
  {
    id: 'protocol',
    eyebrow: 'Protocol tempo',
    prompt: 'When governance weighs protocol changes, what should dominate?',
    helper: 'This sets your baseline for risk, experimentation, and network stability.',
    options: [
      {
        value: 'caution',
        label: 'Stability first',
        description: 'Move carefully and optimize for reliability over speed.',
      },
      {
        value: 'innovation',
        label: 'Innovation first',
        description: 'Take calculated risks to keep Cardano competitive.',
      },
      {
        value: 'case_by_case',
        label: 'Evidence first',
        description: 'Assess each change independently instead of defaulting either way.',
      },
    ],
  },
  {
    id: 'transparency',
    eyebrow: 'Representative accountability',
    prompt: "How visible should a DRep's reasoning be?",
    helper: 'This determines whether you prefer explicit accountability or outcome-driven trust.',
    options: [
      {
        value: 'essential',
        label: 'Explain every major vote',
        description: 'Public reasoning is part of the job, not a bonus.',
      },
      {
        value: 'nice_to_have',
        label: 'Explain the important ones',
        description: 'Reasoning matters, but only when the stakes justify it.',
      },
      {
        value: 'doesnt_matter',
        label: 'Outcomes matter most',
        description: 'A strong record counts more than a public narrative for every decision.',
      },
    ],
  },
  {
    id: 'decentralization',
    eyebrow: 'Power distribution',
    prompt: 'How should governance power be distributed across the network?',
    helper: 'This sharpens your posture on concentration, representation, and legitimacy.',
    options: [
      {
        value: 'spread_widely',
        label: 'Spread it widely',
        description: 'Representation should stay diffuse and hard to capture.',
      },
      {
        value: 'concentrated',
        label: 'Concentrate by merit',
        description: 'The most qualified actors should hold more influence.',
      },
      {
        value: 'current_fine',
        label: "Keep today's balance",
        description: 'The current distribution is workable enough for now.',
      },
    ],
  },
];

const EMPTY_ALIGNMENTS: AlignmentScores = {
  treasuryConservative: 50,
  treasuryGrowth: 50,
  decentralization: 50,
  security: 50,
  innovation: 50,
  transparency: 50,
};

function buildPreviewAlignments(answers: QuickMatchAnswers): AlignmentScores {
  const next = { ...EMPTY_ALIGNMENTS };

  for (const question of QUESTIONS) {
    const answer = answers[question.id];
    if (!answer) continue;

    const vector = ANSWER_VECTORS[question.id]?.[answer];
    if (!vector) continue;

    for (const [dimension, value] of Object.entries(vector)) {
      next[dimension as keyof AlignmentScores] = value;
    }
  }

  return next;
}

function confidenceBand(confidence: number | undefined): string {
  if (confidence == null) return 'Values-only baseline';
  if (confidence >= 70) return 'Strong working signal';
  if (confidence >= 40) return 'Directional signal';
  return 'Values-only baseline';
}

function questionStatusLabel(answeredCount: number): string {
  if (answeredCount === 0) return 'Unstarted';
  if (answeredCount === QUESTIONS.length) return 'Ready to score';
  return `${answeredCount}/${QUESTIONS.length} answered`;
}

export function QuickMatchExperience({
  analyticsSource = 'homepage_match',
  onInspectMatch,
}: QuickMatchExperienceProps) {
  const [stage, setStage] = useState<MatchStage>('intro');
  const { state, setAnswer, submit, reset } = useQuickMatch();

  const answeredCount = useMemo(
    () => QUESTIONS.filter((question) => Boolean(state.answers[question.id])).length,
    [state.answers],
  );
  const previewAlignments = useMemo(() => buildPreviewAlignments(state.answers), [state.answers]);
  const previewDominant = useMemo(
    () => getDominantDimension(previewAlignments),
    [previewAlignments],
  );
  const previewIdentity = useMemo(() => getIdentityColor(previewDominant), [previewDominant]);
  const previewLabel = useMemo(
    () =>
      answeredCount > 0
        ? getPersonalityLabel(previewAlignments)
        : 'Your governance identity will appear here',
    [answeredCount, previewAlignments],
  );

  const currentQuestion =
    typeof stage === 'number' && stage >= 0 && stage < QUESTIONS.length ? QUESTIONS[stage] : null;
  const currentStep = typeof stage === 'number' ? stage : 0;
  const progress = currentQuestion ? ((currentStep + 1) / QUESTIONS.length) * 100 : 0;

  const handleStart = useCallback(() => {
    posthog.capture('quick_match_started', { source: analyticsSource });
    setStage(0);
  }, [analyticsSource]);

  const handleBack = useCallback(() => {
    if (typeof stage !== 'number') return;
    if (stage === 0) {
      setStage('intro');
      return;
    }
    setStage(stage - 1);
  }, [stage]);

  const handleRestart = useCallback(() => {
    posthog.capture('quick_match_restarted', { source: analyticsSource });
    reset();
    setStage('intro');
  }, [analyticsSource, reset]);

  const handleAnswer = useCallback(
    (question: MatchQuestion, value: string) => {
      const nextAnswers = { ...state.answers, [question.id]: value } as QuickMatchAnswers;
      setAnswer(question.id, value);
      posthog.capture('quick_match_answer_selected', {
        source: analyticsSource,
        question: question.id,
        answer: value,
      });

      if (stage === QUESTIONS.length - 1) {
        void submit(nextAnswers);
        return;
      }

      if (typeof stage === 'number') {
        setStage(stage + 1);
      }
    },
    [analyticsSource, setAnswer, stage, state.answers, submit],
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_360px] xl:grid-cols-[minmax(0,1.2fr)_400px]">
      <div className="space-y-8">
        {stage === 'intro' && !state.drepResult && (
          <section className="space-y-6">
            <Card className="overflow-hidden border-slate-800/80 bg-slate-950/70 shadow-[0_40px_120px_-40px_rgba(15,23,42,0.95)] backdrop-blur">
              <CardContent className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-5">
                  <div className="space-y-3">
                    <p className="text-sm font-medium uppercase tracking-[0.28em] text-sky-200/70">
                      What you get
                    </p>
                    <h2 className="text-2xl font-semibold text-white sm:text-3xl">
                      A clean starting point for representative discovery.
                    </h2>
                    <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                      Quick Match is the fast posture read, not the final word. It tells you which
                      representatives currently align with your values, and it keeps the
                      low-confidence nature of a quiz-only profile explicit.
                    </p>
                  </div>
                  <div className="grid gap-3">
                    <LaunchRow
                      title="Top DRep matches"
                      body="See who best fits your governance posture right now."
                    />
                    <LaunchRow
                      title="Aligned pool shortlist"
                      body="Review stake pools that exhibit similar governance patterns."
                    />
                    <LaunchRow
                      title="Next confidence step"
                      body="Get a direct recommendation for how to strengthen the signal next."
                    />
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      size="lg"
                      onClick={handleStart}
                      className="min-h-[52px] gap-2 bg-sky-400 text-slate-950 hover:bg-sky-300"
                      data-testid="match-start-button"
                    >
                      Start Quick Match
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      size="lg"
                      className="min-h-[52px] border-slate-700 bg-slate-900/60 text-slate-100 hover:bg-slate-800"
                    >
                      <Link href="/match/vote">
                        Strengthen with real votes
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
                  <p className="text-sm font-medium text-slate-100">How to read this</p>
                  <ul className="mt-4 space-y-4 text-sm leading-6 text-slate-300">
                    <li className="flex gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                      <span>
                        The shortlist stays inside discovery instead of pretending to be a separate
                        product.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                      <span>
                        The live shortlist only appears after the quick-match API responds.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                      <span>Results stay visibly provisional until stronger evidence exists.</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {currentQuestion && !state.isSubmitting && !state.drepResult && (
          <section
            className="space-y-5"
            data-testid={`match-question-${currentQuestion.id}`}
            data-match-question={currentQuestion.id}
          >
            <Card className="overflow-hidden border-slate-800/80 bg-slate-950/70 backdrop-blur">
              <CardContent className="space-y-6 p-6 sm:p-8">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button
                      variant="ghost"
                      onClick={handleBack}
                      className="h-auto px-0 text-slate-300 hover:bg-transparent hover:text-white"
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Back
                    </Button>
                    <span className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                      Question {currentStep + 1} of {QUESTIONS.length}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-sky-400 transition-all duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium uppercase tracking-[0.24em] text-sky-200/70">
                    {currentQuestion.eyebrow}
                  </p>
                  <h2 className="max-w-3xl text-2xl font-semibold text-white sm:text-3xl">
                    {currentQuestion.prompt}
                  </h2>
                  <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                    {currentQuestion.helper}
                  </p>
                </div>

                <div className="grid gap-3">
                  {currentQuestion.options.map((option) => {
                    const selected = state.answers[currentQuestion.id] === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={cn(
                          'group rounded-2xl border p-5 text-left transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-0',
                          selected
                            ? 'border-sky-300 bg-sky-400/10'
                            : 'border-slate-800 bg-slate-900/70 hover:border-slate-600 hover:bg-slate-900',
                        )}
                        data-testid={`match-answer-${currentQuestion.id}-${option.value}`}
                        onClick={() => handleAnswer(currentQuestion, option.value)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="text-base font-medium text-white">{option.label}</div>
                            <p className="max-w-2xl text-sm leading-6 text-slate-300">
                              {option.description}
                            </p>
                          </div>
                          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-slate-200" />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {state.error && (
                  <div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                    {state.error}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {state.isSubmitting && !state.drepResult && (
          <section className="space-y-5" data-testid="match-loading">
            <Card className="border-slate-800/80 bg-slate-950/70 backdrop-blur">
              <CardContent className="flex flex-col items-center gap-5 p-10 text-center sm:p-14">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-400/12 text-sky-200">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium uppercase tracking-[0.24em] text-sky-200/70">
                    Scoring live matches
                  </p>
                  <h2 className="text-2xl font-semibold text-white">
                    Comparing your posture against active representatives.
                  </h2>
                  <p className="mx-auto max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                    This is the only loading state in the workspace. Once the response lands, the
                    results surface replaces it directly.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {state.drepResult ? (
          <ResultsSection
            drepResult={state.drepResult}
            spoResult={state.spoResult}
            isSecondaryLoading={state.isSecondaryLoading}
            onRestart={handleRestart}
            onInspectMatch={onInspectMatch}
          />
        ) : null}
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <PreviewRail
          answeredCount={answeredCount}
          previewAlignments={previewAlignments}
          previewColor={previewIdentity.hex}
          previewLabel={previewLabel}
          hasResult={Boolean(state.drepResult)}
          answers={state.answers}
          overallConfidence={state.drepResult?.confidenceBreakdown?.overall}
        />
      </aside>
    </div>
  );
}

function LaunchRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4">
      <Target className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-300">{body}</p>
      </div>
    </div>
  );
}

function PreviewRail({
  answeredCount,
  previewAlignments,
  previewColor,
  previewLabel,
  hasResult,
  answers,
  overallConfidence,
}: {
  answeredCount: number;
  previewAlignments: AlignmentScores;
  previewColor: string;
  previewLabel: string;
  hasResult: boolean;
  answers: QuickMatchAnswers;
  overallConfidence?: number;
}) {
  return (
    <div className="space-y-4">
      <Card className="border-slate-800/80 bg-slate-950/80 shadow-[0_30px_90px_-45px_rgba(8,47,73,0.95)] backdrop-blur">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                Profile preview
              </p>
              <p className="mt-1 text-sm text-slate-300">{questionStatusLabel(answeredCount)}</p>
            </div>
            <Badge variant="outline" className="border-slate-700 bg-slate-900/80 text-slate-200">
              {confidenceBand(overallConfidence)}
            </Badge>
          </div>
          <div className="flex justify-center">
            <GovernanceRadar
              alignments={previewAlignments}
              centerScore={overallConfidence ?? null}
            />
          </div>
          <div className="space-y-2 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
              Current identity
            </p>
            <p className="text-lg font-semibold text-white" style={{ color: previewColor }}>
              {previewLabel}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-800/80 bg-slate-950/70 backdrop-blur">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2 text-slate-100">
            <Layers3 className="h-4 w-4 text-sky-300" />
            <p className="text-sm font-medium">Answer trail</p>
          </div>
          <div className="space-y-3">
            {QUESTIONS.map((question) => {
              const answer = answers[question.id];
              return (
                <div
                  key={question.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {question.eyebrow}
                  </p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {answer
                      ? (question.options.find((option) => option.value === answer)?.label ??
                        answer)
                      : 'Not answered yet'}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-800/80 bg-slate-950/70 backdrop-blur">
        <CardContent className="space-y-3 p-6">
          <div className="flex items-center gap-2 text-slate-100">
            <Compass className="h-4 w-4 text-sky-300" />
            <p className="text-sm font-medium">Reading guide</p>
          </div>
          <div className="space-y-3 text-sm leading-6 text-slate-300">
            <p>
              This workspace is a fast discovery layer on top of the homepage, not a final identity
              claim.
            </p>
            <p>The result surface does not appear until the live quick-match API responds.</p>
            <p>Confidence is shown as baseline signal until stronger evidence exists.</p>
          </div>
          {hasResult ? (
            <Button
              asChild
              variant="outline"
              className="w-full border-slate-700 bg-slate-900/80 text-slate-100 hover:bg-slate-800"
            >
              <Link href="/match/vote">
                Strengthen the signal
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ResultsSection({
  drepResult,
  spoResult,
  isSecondaryLoading,
  onRestart,
  onInspectMatch,
}: {
  drepResult: NonNullable<ReturnType<typeof useQuickMatch>['state']['drepResult']>;
  spoResult: ReturnType<typeof useQuickMatch>['state']['spoResult'];
  isSecondaryLoading: boolean;
  onRestart: () => void;
  onInspectMatch?: (match: MatchResult) => void;
}) {
  return (
    <section className="space-y-6" data-testid="match-results">
      <ResultsHero
        topMatch={drepResult.matches[0] ?? null}
        alignments={drepResult.userAlignments}
        personalityLabel={drepResult.personalityLabel}
        confidence={drepResult.confidenceBreakdown?.overall}
        onInspectMatch={onInspectMatch}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white sm:text-2xl">
                Your top DRep matches
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                This workspace keeps the shortlist visible so you can move directly into deeper
                research.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={onRestart}
              className="border-slate-700 bg-slate-900/70 text-slate-100 hover:bg-slate-800"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Start over
            </Button>
          </div>

          <div className="space-y-3">
            {drepResult.matches.slice(0, 3).map((match, index) => (
              <ResultCard
                key={match.drepId}
                match={match}
                rank={index + 1}
                dataTestId={index === 0 ? 'match-top-result' : undefined}
              />
            ))}
          </div>

          {isSecondaryLoading ? (
            <Card
              className="border-slate-800/80 bg-slate-950/70 backdrop-blur"
              data-testid="match-secondary-loading"
            >
              <CardContent className="space-y-2 p-6">
                <p className="text-sm font-medium text-white">Loading aligned pool shortlist</p>
                <p className="text-sm leading-7 text-slate-300">
                  The DRep result is resolved. Related pool fits are still loading in the
                  background.
                </p>
              </CardContent>
            </Card>
          ) : spoResult?.matches.length ? (
            <Card className="border-slate-800/80 bg-slate-950/70 backdrop-blur">
              <CardContent className="space-y-4 p-6">
                <div>
                  <h3 className="text-lg font-semibold text-white">Aligned stake pools</h3>
                  <p className="mt-1 text-sm text-slate-300">
                    These pools exhibit governance behavior that fits the same value profile.
                  </p>
                </div>
                <div className="grid gap-3">
                  {spoResult.matches.slice(0, 2).map((pool, index) => (
                    <Link
                      key={pool.drepId}
                      href={`/pool/${encodeURIComponent(pool.drepId)}`}
                      className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-4 transition-colors hover:border-slate-600 hover:bg-slate-900"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/20 text-xs font-semibold text-violet-100">
                            {index + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-white">
                              {pool.drepName || pool.drepId.slice(0, 14)}
                            </p>
                            <p className="text-xs text-slate-400">
                              Governance score {pool.drepScore}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-semibold text-white">{pool.matchScore}%</p>
                          <p className="text-xs text-slate-400">pool fit</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          {drepResult.confidenceBreakdown ? (
            <MatchConfidenceCTA breakdown={drepResult.confidenceBreakdown} />
          ) : null}

          <Card className="border-slate-800/80 bg-slate-950/70 backdrop-blur">
            <CardContent className="space-y-4 p-6">
              <div className="space-y-2">
                <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-400">
                  Next move
                </p>
                <h3 className="text-lg font-semibold text-white">
                  Turn this from a baseline into a stronger profile.
                </h3>
                <p className="text-sm leading-7 text-slate-300">
                  Values are a clean start. Real proposal voting is what makes the system trust your
                  alignment over time.
                </p>
              </div>
              <Button
                asChild
                className="w-full min-h-[48px] gap-2 bg-sky-400 text-slate-950 hover:bg-sky-300"
              >
                <Link href="/match/vote">
                  Vote on real proposals
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

function ResultsHero({
  topMatch,
  alignments,
  personalityLabel,
  confidence,
  onInspectMatch,
}: {
  topMatch: MatchResult | null;
  alignments: AlignmentScores;
  personalityLabel: string;
  confidence?: number;
  onInspectMatch?: (match: MatchResult) => void;
}) {
  const dominantColor = getIdentityColor(getDominantDimension(alignments)).hex;

  if (!topMatch) {
    return (
      <Card
        className="border-slate-800/80 bg-slate-950/70 backdrop-blur"
        data-testid="match-empty-state"
      >
        <CardContent className="space-y-4 p-6">
          <h2 className="text-xl font-semibold text-white">No strong match yet</h2>
          <p className="text-sm leading-7 text-slate-300">
            The API did not return a shortlist above the minimum quality threshold. Try different
            answers or strengthen the profile later with real proposal voting.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-slate-800/80 bg-slate-950/70 backdrop-blur">
      <CardContent className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="flex justify-center">
          <GovernanceRadar alignments={alignments} centerScore={confidence ?? null} />
        </div>
        <div className="space-y-5">
          <div className="space-y-3">
            <Badge
              variant="outline"
              className="border-slate-700 bg-slate-900/80 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-100"
            >
              Match resolved
            </Badge>
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
                Your governance identity
              </p>
              <h2
                className="mt-1 text-3xl font-semibold text-white"
                style={{ color: dominantColor }}
              >
                {personalityLabel}
              </h2>
            </div>
            <p className="max-w-2xl text-base leading-7 text-slate-300">
              Your top fit is{' '}
              <span className="font-semibold text-white">
                {topMatch.drepName || topMatch.drepId.slice(0, 14)}
              </span>
              . This is a values-alignment read, not a behavioral certainty. Governada keeps that
              distinction visible instead of overclaiming certainty.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricChip label="Top match" value={`${topMatch.matchScore}%`} />
            <MetricChip label="DRep score" value={String(topMatch.drepScore)} />
            <MetricChip label="Confidence" value={`${confidence ?? 0}%`} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            {onInspectMatch ? (
              <Button
                onClick={() => onInspectMatch(topMatch)}
                className="min-h-[48px] gap-2 bg-sky-400 text-slate-950 hover:bg-sky-300"
              >
                Inspect in discovery
                <Compass className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                asChild
                className="min-h-[48px] gap-2 bg-sky-400 text-slate-950 hover:bg-sky-300"
              >
                <Link href={`/drep/${encodeURIComponent(topMatch.drepId)}`}>
                  Open top DRep
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            )}
            <Button
              asChild
              variant="outline"
              className="min-h-[48px] border-slate-700 bg-slate-900/80 text-slate-100 hover:bg-slate-800"
            >
              <Link href="/match/vote">
                Strengthen with proposal voting
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function ResultCard({
  match,
  rank,
  dataTestId,
}: {
  match: MatchResult;
  rank: number;
  dataTestId?: string;
}) {
  return (
    <Link
      href={`/drep/${encodeURIComponent(match.drepId)}`}
      className="block rounded-2xl border border-slate-800 bg-slate-950/70 p-5 transition-colors hover:border-slate-600 hover:bg-slate-950"
      data-testid={dataTestId}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-400/15 text-sm font-semibold text-sky-100">
              {rank}
            </span>
            <div>
              <p className="text-base font-semibold text-white">
                {match.drepName || match.drepId.slice(0, 16)}
              </p>
              <p className="text-sm text-slate-400">{match.tier || 'Representative shortlist'}</p>
            </div>
          </div>
          {match.signatureInsight ? (
            <p className="text-sm leading-7 text-slate-300">{match.signatureInsight}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {match.agreeDimensions.slice(0, 2).map((dimension) => (
              <span
                key={dimension}
                className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs text-emerald-200"
              >
                Aligns on {dimension}
              </span>
            ))}
            {match.differDimensions.slice(0, 1).map((dimension) => (
              <span
                key={dimension}
                className="rounded-full bg-amber-500/12 px-2.5 py-1 text-xs text-amber-200"
              >
                Diverges on {dimension}
              </span>
            ))}
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-white">{match.matchScore}%</p>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">match</p>
        </div>
      </div>
    </Link>
  );
}
