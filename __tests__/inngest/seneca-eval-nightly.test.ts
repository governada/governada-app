import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JudgeResult, SenecaIntent } from '@/lib/seneca/eval/judge';
import type {
  DriftLogInsert,
  RecentEvalRun,
  SenecaEvalSource,
} from '@/inngest/functions/seneca-eval-nightly';
import type { SenecaOutputRecord } from '@/lib/seneca/eval/sampling';

const captureServerEventMock = vi.fn();

vi.mock('@/lib/posthog-server', () => ({
  captureServerEvent: captureServerEventMock,
}));

describe('senecaEvalNightly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits seneca_eval_run and writes sample drift rows', async () => {
    const driftWrites: DriftLogInsert[][] = [];
    const source = makeSource({
      outputs: [
        makeOutput('observational', 'one'),
        makeOutput('interrogative', 'two'),
        makeOutput('mechanical', 'three'),
      ],
      driftWrites,
    });
    const judge = vi.fn(async (output: string, intent: SenecaIntent) =>
      output === 'two' && intent === 'interrogative' ? result(1) : result(3),
    );
    const capture = vi.fn();
    const alert = vi.fn();
    const { runSenecaEvalNightly } = await import('@/inngest/functions/seneca-eval-nightly');

    const run = await runSenecaEvalNightly({
      source,
      judge,
      capture,
      alert,
      sampleSize: 3,
      now: new Date('2026-05-07T03:00:00.000Z'),
    });

    expect(capture).toHaveBeenCalledWith(
      'seneca_eval_run',
      expect.objectContaining({
        sampleSize: 3,
        driftOutputCount: 1,
        scoreDistribution: { 0: 0, 1: 1, 2: 0, 3: 2 },
      }),
    );
    expect(driftWrites.flat()).toContainEqual(
      expect.objectContaining({
        output_text: 'two',
        score: 1,
        is_calibration_set: false,
      }),
    );
    expect(run.driftLogged).toBe(1);
  });

  it('sends a red Discord-style alert when calibration self-test fails', async () => {
    const driftWrites: DriftLogInsert[][] = [];
    const source = makeSource({ outputs: [], driftWrites });
    const alert = vi.fn();
    let failedCalibration = false;
    const judge = vi.fn(async (output: string) => {
      if (!failedCalibration && output.includes('Cardano has a government')) {
        failedCalibration = true;
        return result(2);
      }
      return result(3);
    });
    const { runSenecaEvalNightly } = await import('@/inngest/functions/seneca-eval-nightly');

    const run = await runSenecaEvalNightly({
      source,
      judge,
      alert,
      sampleSize: 0,
      now: new Date('2026-05-07T03:00:00.000Z'),
    });

    expect(run.calibrationPassed).toBe(false);
    expect(alert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Calibration self-test failed',
        color: 0xff0000,
      }),
    );
    expect(driftWrites.flat()).toContainEqual(
      expect.objectContaining({
        is_calibration_set: true,
        score: 2,
      }),
    );
  });

  it('sends an amber alert when the 7-run weighted aggregate falls below 90%', async () => {
    const source = makeSource({
      outputs: [],
      recentRuns: Array.from({ length: 6 }, () => ({
        sampleSize: 50,
        passRate: 0.84,
        driftOutputCount: 8,
      })),
    });
    const alert = vi.fn();
    const { runSenecaEvalNightly } = await import('@/inngest/functions/seneca-eval-nightly');

    await runSenecaEvalNightly({
      source,
      judge: async () => result(3),
      alert,
      sampleSize: 0,
      forceWeeklyCheck: true,
      now: new Date('2026-05-11T03:00:00.000Z'),
    });

    expect(alert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Weekly pass rate dropped below 90%',
        color: 0xff7f00,
      }),
    );
  });

  it('falls back to PostHog alert event when Discord webhook env is absent', async () => {
    const source = makeSource({ outputs: [] });
    let failedCalibration = false;
    const judge = vi.fn(async (output: string) => {
      if (!failedCalibration && output.includes('Cardano has a government')) {
        failedCalibration = true;
        return result(2);
      }
      return result(3);
    });
    const { runSenecaEvalNightly } = await import('@/inngest/functions/seneca-eval-nightly');

    await runSenecaEvalNightly({
      source,
      judge,
      sampleSize: 0,
      now: new Date('2026-05-07T03:00:00.000Z'),
    });

    expect(captureServerEventMock).toHaveBeenCalledWith(
      'seneca_drift_alert',
      expect.objectContaining({
        title: 'Calibration self-test failed',
        reason: 'missing_webhook',
      }),
    );
  });
});

function makeSource({
  outputs,
  driftWrites = [],
  recentRuns = [],
}: {
  outputs: SenecaOutputRecord[];
  driftWrites?: DriftLogInsert[][];
  recentRuns?: RecentEvalRun[];
}): SenecaEvalSource {
  return {
    readOutputsSince: vi.fn(async () => outputs),
    writeDriftLogs: vi.fn(async (entries) => {
      driftWrites.push(entries);
    }),
    readRecentEvalRuns: vi.fn(async () => recentRuns),
  };
}

function makeOutput(intent: SenecaIntent, outputText: string): SenecaOutputRecord {
  return {
    id: `output-${intent}-${outputText}`,
    createdAt: '2026-05-07T00:00:00.000Z',
    intent,
    outputText,
    source: 'test',
    cinematicState: null,
  };
}

function result(score: 0 | 1 | 2 | 3): JudgeResult {
  return {
    referencesData: score >= 1,
    literaryWordEarnsKeep: score >= 2,
    couldColumnistWrite: score >= 3,
    score,
    reasoning: score === 3 ? 'passes' : 'drift',
  };
}
