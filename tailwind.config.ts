import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0a",
        surface: "#141414",
        elevated: "#1a1a1a",
        line: "#1f1f1f",
        muted: "#262626",
        lime: {
          DEFAULT: "#c5f02c",
          dim: "#a8d420",
          glow: "#d4ff3d",
        },
        ink: {
          DEFAULT: "#fafafa",
          soft: "#a1a1aa",
          dim: "#71717a",
        },
        positive: "#34d399",
        negative: "#f87171",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "16px",
        "2xl": "20px",
      },
    },
  },
  plugins: [],
};

export default config;
