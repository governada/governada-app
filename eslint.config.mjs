import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import jsxA11y from 'eslint-plugin-jsx-a11y';

// Extract just the rules from jsx-a11y recommended (plugin already registered by next/core-web-vitals)
const a11yRules = Object.fromEntries(
  Object.entries(jsxA11y.flatConfigs.recommended.rules ?? {}).map(([key, val]) => [key, val]),
);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Promote all jsx-a11y recommended rules (ensures error not warn)
      ...a11yRules,
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      'react/no-unescaped-entities': 'warn',
      'prefer-const': 'warn',
      'react-hooks/error-boundaries': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'scripts/**',
    '__tests__/**',
    'tests/**',
    'analytics/**',
  ]),
]);

export default eslintConfig;
