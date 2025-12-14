// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';
import esPlugin from 'eslint-plugin-es';
import importPlugin from 'eslint-plugin-import';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';
import forAiPlugin from 'eslint-for-ai';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      'dist/',
      'node_modules/',
      '**/*.d.ts',
      'coverage/',
      '*.js',
      'tests/fixtures/**/*',
      'scripts/',
    ],
  },

  // Base JavaScript configuration
  eslint.configs.recommended,

  // Prettier configuration - disables ESLint rules that conflict with Prettier
  prettierConfig,

  // JavaScript/MJS files - disable unused vars since TypeScript handles this
  {
    name: 'javascript-files',
    files: ['**/*.js', '**/*.mjs'],
    rules: {
      'no-unused-vars': 'off', // Use TypeScript compiler instead
    },
  },

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

  // TypeScript configuration for .ts files
  {
    name: 'typescript-files',
    files: ['**/*.ts'],
    extends: [
      tseslint.configs.recommended,
      tseslint.configs.strict,
      tseslint.configs.stylistic,
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
        Bun: 'readonly',
      },
    },
    plugins: {
      'import-x': importX,
      'unused-imports': unusedImports,
      'for-ai': forAiPlugin,
      es: esPlugin,
      import: importPlugin,
    },
    settings: {
      'import-x/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
        node: true,
      },
      'import-x/extensions': ['.ts', '.tsx', '.js', '.jsx', '.mjs'],
      'import-x/external-module-folders': [
        'node_modules',
        'node_modules/@types',
      ],
      'import-x/core-modules': ['bun', 'bun:test', 'bun:jsc'],
    },
    rules: {
      // eslint-for-ai recommended rules
      ...forAiPlugin.configs.recommended.rules,

      // TypeScript strict rules - BAN EXPLICIT ANY
      '@typescript-eslint/no-explicit-any': [
        'error',
        {
          fixToUnknown: false,
          ignoreRestArgs: false,
        },
      ],

      // Additional TypeScript rules for best practices
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-require-imports': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      // Disabled because nullish-coalescing is just bad
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unnecessary-condition': [
        'error',
        {
          checkTypePredicates: true,
          allowConstantLoopConditions: true,
        },
      ],
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        {
          assertionStyle: 'never',
        },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-useless-constructor': 'off',
      '@typescript-eslint/no-useless-constructor': 'error',
      'no-undef': 'off',

      // Ban interfaces - prefer types
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],

      // Disable base rule in favor of TypeScript version
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off', // Use typescript compiler instead

      // Import rules - ENFORCE TOP-LEVEL IMPORTS ONLY
      'import-x/first': 'error', // All imports must be at the top
      'import-x/no-dynamic-require': 'error', // Ban dynamic require()
      'import-x/no-commonjs': 'error', // Ban CommonJS module.exports/require
      'import-x/no-nodejs-modules': 'off', // Allow Node.js built-in modules since this is a CLI
      'import-x/no-unresolved': 'error',
      'import-x/no-duplicates': 'error',
      'import-x/newline-after-import': ['error', { count: 1 }],
      'import-x/order': 'off', // User preference - disabled
      'es/no-dynamic-import': 'error',
      'import/no-dynamic-require': 'error',

      // Additional best practices
      'no-console': 'error', // Force use of process.stdout/stderr.write for CLI output
      'prefer-const': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',

      // Allow empty interfaces and functions (useful for LSP protocol)
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },

  // Test files configuration
  {
    name: 'test-files',
    files: ['**/*.test.ts', '**/*.spec.ts', 'tests/**/*.ts', 'test-setup.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // Allow any in tests
      'no-console': 'off', // Allow console in tests
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // CLI entry point configuration - still enforce process.stdout/stderr.write
  {
    name: 'cli-files',
    files: ['src/cli.ts', 'src/index.ts'],
    rules: {
      // Keep no-console error to enforce proper CLI output methods
    },
  },

  /**
   * Ban left-side type annotations when there is an initializer,
   * encourage `... satisfies Type`, and catch trivial primitives.
   */
  {
    name: 'typescript-ban-left-annotation',
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Catch trivial cases like: const n: number = 1
      '@typescript-eslint/no-inferrable-types': 'error',

      // Default ban: only when the initializer is an object literal.
      // Hits:    const user: User = { id: 1 }
      // Does NOT hit: const id: UserId = makeId()
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "VariableDeclarator[init.type='ObjectExpression'] > Identifier[typeAnnotation]",
          message:
            "Don't annotate initialized variables. Prefer inference instead, typescript can understand the type from the declaration.",
        },

        // --- Stricter alternative ---
        // Uncomment this block to ban annotations on ANY initialized variable:
        // {
        //   selector: "VariableDeclarator[init] > Identifier[typeAnnotation]",
        //   message:
        //     "Don't annotate initialized variables; rely on inference or use `satisfies`.",
        // },
      ],
    },
  },

  {
    name: 'typescript-rule-exclusions',
    files: ['**/*.d.ts', '**/dist/**', '**/build/**'],
    rules: {
      'no-restricted-syntax': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
    },
  }
);
