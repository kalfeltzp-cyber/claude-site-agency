import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    container: { center: true, padding: { DEFAULT: "1rem", sm: "1.5rem" }, screens: { "2xl": "1200px" } },
    extend: {
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        "surface-2": v("surface-2"),
        line: v("line"),
        ink: v("ink"),
        muted: v("muted"),
        faint: v("faint"),
        accent: v("accent"),
        "accent-ink": v("accent-ink"),
        violet: v("violet"),
        good: v("good"),
        bad: v("bad"),
        warn: v("warn"),
        series: v("series"),
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: { xl: "14px", "2xl": "20px" },
      boxShadow: {
        card: "0 1px 0 rgb(var(--line) / 0.6), 0 12px 32px -18px rgb(0 0 0 / 0.45)",
        glow: "0 0 0 1px rgb(var(--accent) / 0.35), 0 8px 30px -10px rgb(var(--accent) / 0.45)",
      },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: { "fade-up": "fade-up 280ms cubic-bezier(.2,.7,.2,1) both" },
    },
  },
  plugins: [],
} satisfies Config;
