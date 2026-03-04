import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'utils/scoring.ts',
        'lib/alignment.ts',
        'lib/koios.ts',
        'lib/supabaseAuth.ts',
        'lib/redis.ts',
        'lib/api/rateLimit.ts',
        'lib/api/handler.ts',
        'lib/api/withRouteHandler.ts',
        'lib/adminAudit.ts',
        'lib/sync-utils.ts',
      ],
      reporter: ['text', 'lcov', 'json-summary'],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
