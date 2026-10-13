const { defineConfig, globalIgnores } = require('eslint/config');
const expo = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier/flat');
const reactHooks = require('eslint-plugin-react-hooks');

module.exports = defineConfig([
  globalIgnores([
    'PROTO/**',
    '.claude/**',
    'dist/**',
    'coverage/**',
    'ios/**',
    'android/**',
    'src/data/generated/**',
    '.expo/**',
  ]),
  expo,
  reactHooks.configs.flat.recommended,
  {
    rules: {
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
          pathGroups: [{ pattern: '@/**', group: 'internal' }],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'e2e/**'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
  },
  {
    files: ['*.config.js'],
    languageOptions: { globals: { __dirname: 'readonly' } },
  },
  prettier,
]);
