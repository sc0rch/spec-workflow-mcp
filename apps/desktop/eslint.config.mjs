import js from '@eslint/js';
import globals from 'globals';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'release/**',
      'playwright-report/**',
      'test-results/**'
    ]
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
      'curly': ['error', 'all'],
      'eqeqeq': ['error', 'always'],
      'no-console': ['error', { allow: ['error', 'warn'] }]
    }
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2023,
        sourceType: 'module',
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        afterEach: 'readonly',
        beforeEach: 'readonly',
        describe: 'readonly',
        expect: 'readonly',
        it: 'readonly',
        test: 'readonly',
        vi: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'curly': ['error', 'all'],
      'eqeqeq': ['error', 'always'],
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-console': ['error', { allow: ['error', 'warn'] }]
    }
  }
];
