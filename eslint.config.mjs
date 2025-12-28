// @ts-check
import tseslint from 'typescript-eslint';
import globals from 'globals';
import forAi from 'eslint-for-ai';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      'dist/',
      'node_modules/',
      'coverage/',
      '*.js',
      'tests/fixtures/**/*',
      'scripts/',
      '**/dist/**',
      '**/build/**',
    ],
  },

  // eslint-for-ai recommended (includes tseslint recommended + strict + stylistic + prettier)
  ...forAi.configs.recommended,

  // Script files - add Node.js globals
  {
    name: 'script-files',
    files: ['script/**/*.mjs', 'script/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // TypeScript project-specific settings
  {
    name: 'typescript-files',
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
        Bun: 'readonly',
      },
    },
  },

  // Test files
  {
    name: 'test-files',
    files: ['**/*.test.ts', '**/*.spec.ts', 'tests/**/*.ts', 'test-setup.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  }
);
