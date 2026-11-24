import type { Config } from 'tailwindcss';

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        line2: 'var(--line2)',
        accent: {
          DEFAULT: 'var(--accent)',
          ink: 'var(--accent-ink)',
          soft: 'var(--accent-soft)',
        },
        gold: {
          DEFAULT: 'var(--gold)',
          soft: 'var(--gold-soft)',
        },
        good: {
          DEFAULT: 'var(--good)',
          soft: 'var(--good-soft)',
        },
        warn: {
          DEFAULT: 'var(--warn)',
          soft: 'var(--warn-soft)',
        },
        bad: {
          DEFAULT: 'var(--bad)',
          soft: 'var(--bad-soft)',
        },
        info: {
          DEFAULT: 'var(--info)',
          soft: 'var(--info-soft)',
        },
        side: {
          bg: 'var(--side-bg)',
          ink: 'var(--side-ink)',
          muted: 'var(--side-muted)',
          hover: 'var(--side-hover)',
          active: 'var(--side-active)',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        card: 'var(--radius)',
      },
      boxShadow: {
        card: 'var(--shadow)',
      },
    },
  },
  plugins: [],
} satisfies Config;
