import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        wazo: {
          green: "#075E54",
          "green-light": "#128C7E",
          "green-dark": "#054A42",
          orange: "#FF6F00",
          "orange-light": "#FF8F33",
          cream: "#F5F5F0",
          surface: "#FFFFFF",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-wazo)",
          "Plus Jakarta Sans",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        wazo: "0 4px 24px -4px rgba(7, 94, 84, 0.12)",
        "wazo-lg": "0 12px 40px -8px rgba(7, 94, 84, 0.18)",
        nav: "0 -4px 24px rgba(7, 94, 84, 0.1)",
      },
      borderRadius: {
        "2.5xl": "1.25rem",
        "3xl": "1.5rem",
      },
      animation: {
        "fade-in": "fadeIn 0.35s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
