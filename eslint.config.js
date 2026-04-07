import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.netlify']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Allow `any` — too pervasive to fix at once; tighten later
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow unused vars prefixed with _ and unused catch binding errors
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_|^error$|^e$',
      }],
      // Security utils intentionally use control chars in regex
      'no-control-regex': 'off',
      // Allow escape sequences that are valid but technically unnecessary
      'no-useless-escape': 'warn',
      // Allow empty catch blocks (common error-swallowing pattern)
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
])
