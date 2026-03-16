import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Tired of Cancer / Untire Now brand palette
        // Warm cream background, white cards, amber primary, sage secondary
        brand: {
          // Primary — warm amber (buttons, active states, selections)
          purple: '#B8722A',
          'purple-light': '#C98035',
          'purple-pale': '#FAF4E8',
          // Secondary — sage green
          teal: '#6B9E8A',
          'teal-light': '#88B8A5',
          green: '#7DB88A',
          // Icon circle yellow (matches Untire Now app icon backgrounds)
          yellow: '#F5E4A0',
          'yellow-light': '#FAF0C8',
        },
        surface: {
          DEFAULT: '#F4EFE5',   // warm cream — main page background
          card: '#FFFFFF',
          muted: '#EDE8DC',
        },
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
