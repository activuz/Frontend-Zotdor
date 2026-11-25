/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Semantic tokens (docs/DESIGN.md §2). Components use these, never raw hex.
      colors: {
        ink: { DEFAULT: '#1e3a0f', muted: '#4a5e3a' },
        brand: { DEFAULT: '#3d6b2e', soft: '#dce8c8' },
        accent: '#a8d45e',
        page: '#eef2dc',
        surface: '#ffffff',
        line: '#c5d4a8',
        // Bid tiers (BR-25). Dark tones so text on white passes WCAG AA.
        bid: { 1: '#15803d', 2: '#b45309', 3: '#b91c1c' },
        danger: { DEFAULT: '#b91c1c', soft: '#fef2f2' },
        warning: { DEFAULT: '#92400e', soft: '#fffbeb' },
        success: { DEFAULT: '#166534', soft: '#f0fdf4' },
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      minHeight: { touch: '48px' },
      minWidth: { touch: '48px' },
    },
  },
  plugins: [],
};
