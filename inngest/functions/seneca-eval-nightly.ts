import { inngest } from '@/lib/inngest';
import { captureServerEvent } from '@/lib/posthog-server';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  SENECA_CALIBRATION_RED,
  SENECA_DRIFT_AMBER,
  sendDiscordWebhookAlert,
  type DiscordAlertInput,
} from '@/lib/seneca/eval/discordWebhook';
import { runCalibrationSelfTest, type CalibrationJudgeResult } from '@/lib/seneca/eval/calibration';
import { judgeOutput, type JudgeResult, type SenecaIntent } from '@/lib/seneca/eval/judge';
import {
  sampleStratifiedOutputs,
  type IntentCounts,
  type SenecaOutputRecord,
} from '@/lib/seneca/eval/sampling';

export const SENECA_EVAL_SAMPLE_SIZE = 50;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKLY_PASS_RATE_TARGET = 0.9;

export interface ScoredSenecaOutput {
  output: SenecaOutputRecord;
  result: JudgeResult;
}

export interface IntentBreakdownEntry {
  count: number;
  passRate: number;
}

export type ScoreDistribution = Record<0 | 1 | 2 | 3, number>;

export interface EvalRunAggregate {
  sampleSize: number;
  passRate: number;
  scoreDistribution: ScoreDistribution;
  intentBreakdown: Record<SenecaIntent, IntentBreakdownEntry>;
  driftOutputCount: number;
}

export interface RecentEvalRun {
  sampleSize: number;
  passRate: number;
  driftOutputCount?: number;
}

export interface DriftLogInsert {
  output_id: string | null;
  intent: SenecaIntent;
  output_text: string;
  references_data: boolean;
  literary_word_earns_keep: boolean;
  could_columnist_write: boolean;
  score: number;
  reasoning: string;
  is_calibration_set: boolean;
}

export interface SenecaEvalSource {
  readOutputsSince: (since: Date, limit: number) => Promise<SenecaOutputRecord[]>;
  writeDriftLogs: (entries: DriftLogInsert[]) => Promise<void>;
  readRecentEvalRuns: (limit: number) => Promise<RecentEvalRun[]>;
}

export interface RunSenecaEvalNightlyOptions {
  now?: Date;
  sampleSize?: number;
  source?: SenecaEvalSource;
  judge?: (output: string, intent: SenecaIntent) => Promise<JudgeResult>;
  alert?: (input: DiscordAlertInput) => Promise<unknown>;
  capture?: (event: string, properties: Record<string, unknown>) => void;
  forceWeeklyCheck?: boolean;
}

export const senecaEvalNightly = inngest.createFunction(
  {
    id: 'seneca-eval-nightly',
    name: 'Seneca Eval Nightly',
    retries: 1,
    concurrency: { limit: 1, scope: 'env', key: '"seneca-eval-nightly"' },
    triggers: [{ cron: '0 3 * * *' }, { event: 'governada/seneca.eval' }],
  },
  async ({ step }) => step.run('run-seneca-eval-nightly', async () => runSenecaEvalNightly()),
);

export async function runSenecaEvalNightly({
  now = new Date(),
  sampleSize = getConfiguredSampleSize(),
  source = createSupabaseSenecaEvalSource(),
  judge = judgeOutput,
  alert = sendDiscordWebhookAlert,
  capture = captureServerEvent,
  forceWeeklyCheck = false,
}: RunSenecaEvalNightlyOptions = {}) {
  const since = new Date(now.getTime() - DAY_MS);
  const population = await source.readOutputsSince(since, Math.max(sampleSize * 20, sampleSize));
  const sample = sampleStratifiedOutputs(population, sampleSize);
  const scoredOutputs: ScoredSenecaOutput[] = [];

  for (const output of sample) {
    scoredOutputs.push({
      output,
      result: await judge(output.outputText, output.intent),
    });
  }

  const aggregate = buildEvalRunAggregate(scoredOutputs);
  capture('seneca_eval_run', { ...aggregate });

  const driftEntries = scoredOutputs
    .filter(({ result }) => result.score <= 1)
    .map(({ output, result }) => toDriftLogInsert(output, result, false));
  await source.writeDriftLogs(driftEntries);

  const calibrationResults = await runCalibrationSelfTest(judge);
  const calibrationFailures = calibrationResults.filter(({ result }) => result.score < 3);
  if (calibrationFailures.length > 0) {
    await source.writeDriftLogs(
      calibrationFailures.map((failure) => toCalibrationDriftLogInsert(failure)),
    );
    await alert(buildCalibrationFailureAlert(calibrationResults, calibrationFailures, now));
  }

  const recentRuns = await source.readRecentEvalRuns(6);
  const weeklyRuns = [aggregate, ...recentRuns].slice(0, 7);
  const weeklyAggregate = buildWeeklyAggregate(weeklyRuns);
  const shouldCheckWeekly = forceWeeklyCheck || isWeeklyAlertWindow(now);
  if (shouldCheckWeekly && weeklyAggregate && weeklyAggregate.passRate < WEEKLY_PASS_RATE_TARGET) {
    await alert(buildWeeklyDriftAlert(weeklyAggregate, now));
  }

  return {
    sampled: sample.length,
    population: population.length,
    aggregate,
    driftLogged: driftEntries.length,
    calibrationPassed: calibrationFailures.length === 0,
    calibrationScore: calibrationResults.length - calibrationFailures.length,
    calibrationTotal: calibrationResults.length,
    weeklyAggregate,
  };
}

export function getConfiguredSampleSize(): number {
  const configured = Number(process.env.SENECA_EVAL_SAMPLE_SIZE);
  if (Number.isFinite(configured) && configured > 0) return Math.floor(configured);
  return SENECA_EVAL_SAMPLE_SIZE;
}

export function buildEvalRunAggregate(
  scoredOutputs: readonly ScoredSenecaOutput[],
): EvalRunAggregate {
  const scoreDistribution: ScoreDistribution = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const intentCounts: IntentCounts = { observational: 0, interrogative: 0, mechanical: 0 };
  const intentPasses: IntentCounts = { observational: 0, interrogative: 0, mechanical: 0 };

  for (const { output, result } of scoredOutputs) {
    scoreDistribution[result.score] += 1;
    intentCounts[output.intent] += 1;
    if (result.score >= 2) intentPasses[output.intent] += 1;
  }

  const passCount = scoredOutputs.filter(({ result }) => result.score >= 2).length;
  return {
    sampleSize: scoredOutputs.length,
    passRate: scoredOutputs.length === 0 ? 1 : roundRate(passCount / scoredOutputs.length),
    scoreDistribution,
    intentBreakdown: {
      observational: toIntentBreakdown(intentCounts.observational, intentPasses.observational),
      interrogative: toIntentBreakdown(intentCounts.interrogative, intentPasses.interrogative),
      mechanical: toIntentBreakdown(intentCounts.mechanical, intentPasses.mechanical),
    },
    driftOutputCount: scoreDistribution[0] + scoreDistribution[1],
  };
}

export function buildWeeklyAggregate(runs: readonly RecentEvalRun[]): RecentEvalRun | null {
  if (runs.length < 7) return null;

  const sampleSize = runs.reduce((sum, run) => sum + run.sampleSize, 0);
  if (sampleSize === 0) return { sampleSize: 0, passRate: 1, driftOutputCount: 0 };

  const weightedPasses = runs.reduce((sum, run) => sum + run.passRate * run.sampleSize, 0);
  const driftOutputCount = runs.reduce((sum, run) => sum + (run.driftOutputCount ?? 0), 0);
  return {
    sampleSize,
    passRate: roundRate(weightedPasses / sampleSize),
    driftOutputCount,
  };
}

export function isWeeklyAlertWindow(now: Date): boolean {
  return now.getUTCDay() === 1;
}

export function buildCalibrationFailureAlert(
  results: readonly CalibrationJudgeResult[],
  failures: readonly CalibrationJudgeResult[],
  now = new Date(),
): DiscordAlertInput {
  const failingExamples = failures
    .slice(0, 3)
    .map((failure) => `• ${failure.title}: ${truncate(failure.output, 200)}`)
    .join('\n');

  return {
    title: 'Calibration self-test failed',
    description: `${results.length - failures.length}/${results.length} calibration examples scored 3/3. The judge prompt needs review before launch.`,
    color: SENECA_CALIBRATION_RED,
    fields: [
      {
        name: 'Pass rate',
        value: formatPercent((results.length - failures.length) / results.length),
        inline: true,
      },
      { name: 'Sample size', value: String(results.length), inline: true },
      { name: 'Drift outputs', value: String(failures.length), inline: true },
      ...(failingExamples ? [{ name: 'Failing examples', value: failingExamples }] : []),
    ],
    timestamp: now.toISOString(),
  };
}

export function buildWeeklyDriftAlert(
  weeklyAggregate: RecentEvalRun,
  now = new Date(),
): DiscordAlertInput {
  return {
    title: 'Weekly pass rate dropped below 90%',
    description: `${formatPercent(weeklyAggregate.passRate)} pass rate over the last 7 nightly runs (target >=90%).`,
    color: SENECA_DRIFT_AMBER,
    fields: [
      { name: 'Pass rate', value: formatPercent(weeklyAggregate.passRate), inline: true },
      { name: 'Sample size', value: String(weeklyAggregate.sampleSize), inline: true },
      { name: 'Drift outputs', value: String(weeklyAggregate.driftOutputCount ?? 0), inline: true },
    ],
    timestamp: now.toISOString(),
  };
}

function createSupabaseSenecaEvalSource(): SenecaEvalSource {
  return {
    async readOutputsSince(since, limit) {
      const { data, error } = await getSupabaseAdmin()
        .from('seneca_outputs')
        .select('id, created_at, intent, output_text, source, cinematic_state')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw new Error(`Failed to read Seneca outputs: ${error.message}`);
      return ((data ?? []) as SenecaOutputDbRow[]).flatMap((row) => {
        if (!isSenecaIntent(row.intent)) return [];
        return [
          {
            id: row.id,
            createdAt: row.created_at,
            intent: row.intent,
            outputText: row.output_text,
            source: row.source,
            cinematicState: row.cinematic_state,
          },
        ];
      });
    },
    async writeDriftLogs(entries) {
      if (entries.length === 0) return;
      const { error } = await getSupabaseAdmin().from('seneca_drift_log').insert(entries);
      if (error) throw new Error(`Failed to write Seneca drift log: ${error.message}`);
    },
    readRecentEvalRuns,
  };
}

async function readRecentEvalRuns(limit: number): Promise<RecentEvalRun[]> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.posthog.com')
    .replace('https://us.i.posthog.com', 'https://us.posthog.com')
    .replace(/\/+$/u, '');

  if (!apiKey || !projectId) return [];

  try {
    const response = await fetch(`${host}/api/projects/${projectId}/query/`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        query: {
          kind: 'HogQLQuery',
          query: `
            SELECT
              properties.sampleSize,
              properties.passRate,
              properties.driftOutputCount
            FROM events
            WHERE event = 'seneca_eval_run'
            ORDER BY timestamp DESC
            LIMIT ${Math.max(0, Math.min(limit, 7))}
          `,
        },
      }),
    });

    if (!response.ok) return [];
    const body = (await response.json()) as { results?: unknown[][] };
    return (body.results ?? []).map(toRecentEvalRun).filter((run): run is RecentEvalRun => !!run);
  } catch {
    return [];
  }
}

function toRecentEvalRun(row: unknown[]): RecentEvalRun | null {
  const [sampleSize, passRate, driftOutputCount] = row;
  const parsedSampleSize = Number(sampleSize);
  const parsedPassRate = Number(passRate);
  const parsedDriftOutputCount = Number(driftOutputCount);
  if (!Number.isFinite(parsedSampleSize) || !Number.isFinite(parsedPassRate)) return null;
  return {
    sampleSize: parsedSampleSize,
    passRate: parsedPassRate,
    driftOutputCount: Number.isFinite(parsedDriftOutputCount) ? parsedDriftOutputCount : 0,
  };
}

function toDriftLogInsert(
  output: SenecaOutputRecord,
  result: JudgeResult,
  isCalibrationSet: boolean,
): DriftLogInsert {
  return {
    output_id: output.id,
    intent: output.intent,
    output_text: output.outputText,
    references_data: result.referencesData,
    literary_word_earns_keep: result.literaryWordEarnsKeep,
    could_columnist_write: result.couldColumnistWrite,
    score: result.score,
    reasoning: result.reasoning,
    is_calibration_set: isCalibrationSet,
  };
}

function toCalibrationDriftLogInsert(failure: CalibrationJudgeResult): DriftLogInsert {
  return {
    output_id: null,
    intent: failure.intent,
    output_text: failure.output,
    references_data: failure.result.referencesData,
    literary_word_earns_keep: failure.result.literaryWordEarnsKeep,
    could_columnist_write: failure.result.couldColumnistWrite,
    score: failure.result.score,
    reasoning: failure.result.reasoning,
    is_calibration_set: true,
  };
}

function toIntentBreakdown(count: number, passes: number): IntentBreakdownEntry {
  return {
    count,
    passRate: count === 0 ? 1 : roundRate(passes / count),
  };
}

function roundRate(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function isSenecaIntent(value: unknown): value is SenecaIntent {
  return value === 'observational' || value === 'interrogative' || value === 'mechanical';
}

interface SenecaOutputDbRow {
  id: string;
  created_at: string;
  intent: string;
  output_text: string;
  source: string;
  cinematic_state: string | null;
}
