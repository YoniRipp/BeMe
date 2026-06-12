import tseslint from 'typescript-eslint';

export default tseslint.config(
  // mcp-server is a standalone plain-JS process with its own conventions
  { ignores: ['dist/', 'coverage/', 'mcp-server/', 'migrations/', 'scripts/'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      // `any` cleanup is tracked separately — surface without failing the build
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // CommonJS by design (node-pg-migrate config); vi.mock factories may require()
    files: ['**/*.cjs', '**/*.test.ts'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
