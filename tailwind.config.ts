import type { Config } from 'tailwindcss';

// Pons-style, fully black. Green only for positive / Alive, red only for negative / Dead.
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#000000',
        card: '#0a0a0a',
        raised: '#111111',
        line: '#1a1a1a',
        line2: '#262626',
        ink: '#ffffff',
        mute: '#8a8a8a',
        up: '#22c55e',
        down: '#ef4444',
      },
      fontFamily: { sans: ['var(--font-inter)', 'system-ui', 'sans-serif'], mono: ['var(--font-mono)', 'ui-monospace', 'monospace'] },
      borderRadius: { xl: '14px', '2xl': '18px' },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
      },
      animation: { shimmer: 'shimmer 1.6s infinite', marquee: 'marquee 60s linear infinite' },
    },
  },
  plugins: [],
} satisfies Config;
