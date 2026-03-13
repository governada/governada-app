import { defineWorkspace } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

const sharedResolve = {
  alias: {
    '@': fileURLToPath(new URL('.', import.meta.url)),
  },
};

export default defineWorkspace([
  {
    test: {
      name: 'unit',
      include: ['__tests__/**/*.test.ts'],
      environment: 'node',
    },
    resolve: sharedResolve,
  },
  {
    test: {
      name: 'component',
      include: ['__tests__/**/*.test.tsx'],
      environment: 'jsdom',
    },
    resolve: sharedResolve,
  },
]);
