import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/components/**/*.{js,vue,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/plugins/**/*.{js,ts}',
    './app/app.vue',
    './app/error.vue',
  ],
  darkMode: 'class',
  plugins: [],
  theme: {
    extend: {
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.6s ease-out forwards',
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        'glow': '0 0 40px -10px rgb(var(--color-primary) / 0.3)',
        'glow-lg': '0 0 60px -15px rgb(var(--color-primary) / 0.4)',
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'soft-lg': '0 10px 40px -10px rgba(0, 0, 0, 0.1), 0 2px 10px -2px rgba(0, 0, 0, 0.04)',
      },
      colors: {
        // M3 Expressive: Fox orange primary palette
        primary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          dim: 'rgb(var(--surface-dim) / <alpha-value>)',
          elevated: 'rgb(var(--surface-elevated) / <alpha-value>)',
          overlay: 'rgb(var(--surface-overlay) / <alpha-value>)',
        },
      },
      fontFamily: {
        display: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'body-lg': ['1.125rem', { lineHeight: '1.875rem' }],
        'body-md': ['1rem', { lineHeight: '1.75rem' }],
        'display-lg': ['3.5rem', { fontWeight: '700', letterSpacing: '-0.02em', lineHeight: '1.1' }],
        'display-md': ['2.75rem', { fontWeight: '700', letterSpacing: '-0.02em', lineHeight: '1.15' }],
        'display-sm': ['2rem', { fontWeight: '600', letterSpacing: '-0.01em', lineHeight: '1.25' }],
        'label-lg': ['0.875rem', { fontWeight: '600', letterSpacing: '0.05em', lineHeight: '1.25rem' }],
        'label-md': ['0.75rem', { fontWeight: '500', letterSpacing: '0.03em', lineHeight: '1rem' }],
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      transitionDuration: {
        '300': '300ms',
      },
    },
  },
} satisfies Config

