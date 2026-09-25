// FILE: tailwind.config.js — Tailwind theme for the "New Worlds" / PIID Summit art direction.
// Depends on: tailwindcss. Consumed by postcss.config.js at build time.
// Palette source of truth: Build Spec Section 2 (Art Direction, Color Palette & Styling).

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // ===== SECTION: PIID PRIMARY ACCENTS =====
        piid: {
          blue: '#3b82f6',    // Vibrant Sky Blue  — primary action / focus
          orange: '#f97316',  // Energetic Orange  — secondary accent
          emerald: '#10b981', // Deep Emerald      — success / valid scan
          magenta: '#a855f7', // Rich Magenta      — accent / gradient stop
        },
        // ===== SECTION: BACKGROUNDS & SURFACES =====
        canvas: '#f4f4f5',    // Clean light neutral canvas
      },
      borderRadius: {
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 20px 45px -20px rgba(15, 23, 42, 0.35)',
      },
      keyframes: {
        'pop-in': {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'pop-in': 'pop-in 300ms ease-in-out',
      },
    },
  },
  plugins: [],
};
