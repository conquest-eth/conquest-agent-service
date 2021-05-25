/* eslint-disable no-unused-vars */
const {tailwindExtractor} = require('tailwindcss/lib/lib/purgeUnusedStyles');
const colors = require('tailwindcss/colors');

module.exports = {
  darkMode: false,
  mode: 'jit',
  purge: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        // 'light-blue': colors.lightBlue,
        cyan: colors.cyan,
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [require('tailwindcss-question-mark')],
};
