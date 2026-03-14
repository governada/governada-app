import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// Build full config array from next presets
const configs = [...nextVitals, ...nextTs];

// Custom rule overrides — merge into config objects that own the relevant plugins
// Index 0 has: react, react-hooks, jsx-a11y, import, @next/next
// Index 1 has: @typescript-eslint
if (configs[0]) {
  configs[0].rules = {
    ...configs[0].rules,
    'react/no-unescaped-entities': 'warn',
    'react-hooks/error-boundaries': 'warn',
    'react-hooks/set-state-in-effect': 'warn',
    'react-hooks/purity': 'warn',
    'react-hooks/immutability': 'warn',
    'prefer-const': 'warn',
  };
}
if (configs[1]) {
  configs[1].rules = {
    ...configs[1].rules,
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
  };
}

export default [
  ...configs,
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'scripts/**',
      '__tests__/**',
      'tests/**',
      'analytics/**',
      '.claude/worktrees/**',
      '*.cjs',
    ],
  },
];
