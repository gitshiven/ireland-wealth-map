/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        mono:    ['var(--font-mono)', 'monospace'],
        body:    ['var(--font-body)', 'sans-serif'],
      },
      colors: {
        ink:    '#0A0A0F',
        paper:  '#F5F2EC',
        gold:   '#C9A84C',
        emerald:'#1A6B3C',
        rust:   '#B94A2C',
        slate:  '#3D4852',
        fog:    '#E8E4DC',
      },
    },
  },
  plugins: [],
}
