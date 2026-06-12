import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist/', 'dev-dist/', 'coverage/', 'playwright-report/', 'test-results/', 'android/', 'ios/'] },
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // exhaustive-deps has known intentional exceptions in this codebase
      'react-hooks/exhaustive-deps': 'warn',
      // React Compiler–era rules: aspirational for existing code, tracked as warnings
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      // `any` cleanup is tracked separately — surface without failing the build
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'sonner',
              importNames: ['toast'],
              message: "Import toast from '@/components/shared/ToastProvider' instead.",
            },
          ],
        },
      ],
    },
  },
  {
    // The wrapper itself is the one allowed sonner entry point
    files: ['src/components/shared/ToastProvider.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // CommonJS by design (preview server); vi.mock factories may require()
    files: ['**/*.cjs', '**/*.test.ts', '**/*.test.tsx'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
