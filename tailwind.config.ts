import type { Config } from "tailwindcss";

// ── ReFx Glassy Design tokens ─────────────────────────────────────────────
// The identical visual language as the ReFx iOS app + control panel: dark
// blue-black glass, single brand blue, semantic status colors, tabular numerics.
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        refx: {
          // Dark bases
          900: "#070b12",
          800: "#0a111d",
          700: "#0f1828",
          600: "#101a2b",
          // Brand blue ramp
          blue: "#0072ff",
          blue2: "#58a7d3",
          blueText: "#7db7ff",
          blueHi: "#9dccff",
          // Text
          text: "#eef6ff",
          text2: "#f3f8ff",
          muted: "rgba(216,234,255,0.72)",
          meta: "rgba(188,216,255,0.56)",
          label: "rgba(140,196,255,0.70)",
        },
        // Semantic status (desaturated — never the brand)
        status: {
          live: "#3ad29a",
          stale: "#f5b14c",
          error: "#f87171",
        },
        // Flag vocabulary: DIVERGE = brand blue (the one true edge signal),
        // ARB = restrained amber/gold, WIDE = quiet slate.
        flagc: {
          diverge: "#0072ff",
          arb: "#d8a14a",
          wide: "#8aa0bf",
        },
        // Legacy aliases (kept so nothing renders unstyled during migration).
        panel: {
          bg: "#070b12",
          surface: "#0f1828",
          border: "rgba(255,255,255,0.08)",
          muted: "rgba(188,216,255,0.56)",
        },
        flag: { arb: "#d8a14a", wide: "#8aa0bf", diverge: "#0072ff" },
      },
      borderColor: {
        "refx-faint": "rgba(255,255,255,0.05)",
        "refx-soft": "rgba(255,255,255,0.08)",
        "refx-blue": "rgba(0,114,255,0.14)",
        "refx-blue-strong": "rgba(0,114,255,0.22)",
      },
      borderRadius: {
        refx: "12px",
        "refx-sm": "10px",
        "refx-lg": "14px",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Inter",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      backgroundImage: {
        "refx-shell":
          "linear-gradient(180deg, rgba(10,18,32,0.96), rgba(7,13,24,0.96))",
        "refx-card":
          "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
        "refx-card-strong":
          "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
        "refx-blue-glass":
          "linear-gradient(180deg, rgba(0,114,255,0.30), rgba(0,114,255,0.14))",
      },
      boxShadow: {
        refx: "0 10px 30px -12px rgba(2,8,20,0.8), 0 1px 0 0 rgba(255,255,255,0.03) inset",
        "refx-blue":
          "0 0 0 1px rgba(0,114,255,0.22), 0 8px 28px -10px rgba(0,114,255,0.35)",
        "refx-glow": "0 0 24px -6px rgba(0,114,255,0.45)",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        tick: {
          "0%": { backgroundColor: "rgba(0,114,255,0.18)" },
          "100%": { backgroundColor: "transparent" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(2px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        tick: "tick 900ms ease-out",
        "fade-in": "fade-in 160ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
