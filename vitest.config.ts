import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

const sharedResolve = {
  alias: {
    '@': fileURLToPath(new URL('.', import.meta.url)),
  },
};

export default defineConfig({
  resolve: sharedResolve,
  test: {
    projects: [
      {
        resolve: sharedResolve,
        test: {
          name: 'unit',
          include: ['__tests__/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        resolve: sharedResolve,
        test: {
          name: 'component',
          include: ['__tests__/**/*.test.tsx'],
          environment: 'jsdom',
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: [
        'utils/scoring.ts',
        'lib/alignment.ts',
        'lib/koios.ts',
        'lib/syncPolicy.ts',
        'lib/supabaseAuth.ts',
        'lib/redis.ts',
        'lib/api/rateLimit.ts',
        'lib/api/handler.ts',
        'lib/api/withRouteHandler.ts',
        'lib/adminAudit.ts',
        'lib/navigation/civicIdentity.ts',
        'lib/navigation/proposalAction.ts',
        'lib/navigation/returnTo.ts',
        'lib/navigation/workspaceEntry.ts',
        'lib/sync-utils.ts',
        'lib/scoring/**/*.ts',
        'lib/alignment/**/*.ts',
        'lib/ghi/**/*.ts',
        'lib/matching/**/*.ts',
      ],
      reporter: ['text', 'lcov', 'json-summary'],
    },
  },
});
