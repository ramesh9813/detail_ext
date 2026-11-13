import js from '@eslint/js';
import parser from '@typescript-eslint/parser';
export default [
  { ignores: ['dist/**', 'release/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'] },
  { ...js.configs.recommended, files: ['**/*.{js,mjs}'], languageOptions: { globals: { console: 'readonly', process: 'readonly', Buffer: 'readonly', URL: 'readonly' } } },
  { files: ['**/*.{ts,tsx}'], languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true } } }, rules: {
    'eqeqeq': 'error', 'no-eval': 'error', 'no-implied-eval': 'error', 'no-debugger': 'error',
    'no-duplicate-case': 'error', 'no-unsafe-finally': 'error', 'no-sparse-arrays': 'error',
    'no-unexpected-multiline': 'error', 'no-constant-condition': 'error', 'no-constant-binary-expression': 'error',
  } },
];
