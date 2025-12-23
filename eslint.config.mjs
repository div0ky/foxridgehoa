import stylistic from '@stylistic/eslint-plugin'
// @ts-check
import perfectionist from 'eslint-plugin-perfectionist'

import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  plugins: {
    '@stylistic': stylistic,
    perfectionist,
  },
  rules: {
    '@stylistic/indent': ['error', 2],
    '@stylistic/quotes': ['error', 'single'],
    '@stylistic/semi': ['error', 'never'],
    'perfectionist/sort-imports': [
      'error',
      {
        groups: [
          'type',
          ['builtin', 'external'],
          'internal',
          ['parent', 'sibling', 'index'],
          'unknown',
        ],
        internalPattern: ['^~/'],
        newlinesBetween: 1,
        type: 'natural',
      },
    ],
    'perfectionist/sort-jsx-props': [
      'error',
      {
        order: 'asc',
        type: 'natural',
      },
    ],
    'perfectionist/sort-objects': [
      'error',
      {
        order: 'asc',
        type: 'natural',
      },
    ],
  },
})
