import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function read(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

describe('homepage telemetry inventory', () => {
  it('covers every Phase 8 event named by the spec prompt', () => {
    const sources = [
      'components/PageViewTracker.tsx',
      'components/globe/GlobeLayout.tsx',
      'components/GlobeConstellation.tsx',
      'components/governada/SenecaThread.tsx',
      'components/governada/panel/SenecaMatch.tsx',
      'lib/globe/cinematicDispatcher.ts',
      'lib/telemetry/perfMarks.ts',
    ]
      .map(read)
      .join('\n');

    for (const event of [
      'cinema_arrival_state',
      'cinema_state_interrupted',
      'cinema_state_completed',
      'time_to_interactive',
      'time_to_seneca_ready',
      'time_to_cinema_fire',
      'constellation_render_failed',
      'seneca_answer_failed',
      'match_no_candidates',
      'cluster_fetch_failed',
      'observation_surfaced',
      'guided_path_taken',
      'panel_dismissed',
      'mechanical_question_asked',
    ]) {
      expect(sources).toContain(event);
    }
  });

  it('keeps the homepage funnel chain gap-free in emitted event names', () => {
    const sources = [
      'components/PageViewTracker.tsx',
      'components/governada/SenecaThread.tsx',
      'components/governada/panel/SenecaMatch.tsx',
      'components/WalletConnectModal.tsx',
      'hooks/useQuickConnect.ts',
      'components/globe/GlobeLayout.tsx',
      'app/api/delegation/sandbox/route.ts',
      'app/api/delegation/mainnet/route.ts',
    ]
      .map(read)
      .join('\n');

    for (const event of [
      'first_visit',
      'seneca_interaction',
      'match_started',
      'match_completed',
      'entity_inspected',
      'wallet_connected',
      'delegated',
    ]) {
      expect(sources).toContain(event);
    }
  });
});
