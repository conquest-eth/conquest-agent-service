module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 2018, // Allows for the parsing of modern ECMAScript features
    sourceType: 'module', // Allows for the use of imports
  },
  env: {
    commonjs: true,
    browser: true,
    node: true,
    es6: true,
  },
  plugins: ['@typescript-eslint', 'svelte3'],
  extends: ['eslint:recommended', 'prettier'],
  overrides: [
    {
      files: ['**/*.svelte'],
      processor: 'svelte3/svelte3',
    },
    {
      files: ['**/*.ts', '**/*.svelte'],
      parser: '@typescript-eslint/parser',
      extends: ['plugin:@typescript-eslint/recommended', 'prettier/@typescript-eslint'],
    },
  ],
  settings: {
    'svelte3/typescript': require('typescript'),
  },
  rules: {
    'no-empty': 'off',
    'no-empty-function': 'off',
    '@typescript-eslint/no-empty-function': 'off',
  },
};
