/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        zotdor: {
          dark: "#1e3a0f",
          green: {
            DEFAULT: "#1e3a0f",
            mid: "#3d6b2e",
            light: "#dce8c8",
            pale: "#f5f8eb",
            accent: "#a8d45e"
          },
          bg: "#eef2dc",
          card: "#ffffff",
          sand: "#f7f4ee",
          border: "#c5d4a8",
          text: {
            main: "#1e3a0f",
            muted: "#4a5e3a",
            light: "#6b8f4e"
          }
        }
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
      },
      minHeight: {
        touch: '48px'
      },
      minWidth: {
        touch: '48px'
      }
    },
  },
  plugins: [],
}
