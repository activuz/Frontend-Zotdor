import type { Config } from "tailwindcss";

// Same semantic tokens as frontend/ and panel/ (docs/DESIGN.md §2). Components never use raw hex.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#1e3a0f", muted: "#4a5e3a" },
        brand: { DEFAULT: "#3d6b2e", soft: "#dce8c8" },
        accent: "#a8d45e",
        page: "#eef2dc",
        surface: "#ffffff",
        line: "#c5d4a8",
        bid: { 1: "#15803d", 2: "#b45309", 3: "#b91c1c" },
        danger: { DEFAULT: "#b91c1c", soft: "#fef2f2" },
        warning: { DEFAULT: "#92400e", soft: "#fffbeb" },
        success: { DEFAULT: "#166534", soft: "#f0fdf4" },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      minHeight: { touch: "48px" },
      minWidth: { touch: "48px" },
    },
  },
  plugins: [],
};

export default config;
