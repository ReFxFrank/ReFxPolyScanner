import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        panel: {
          bg: "#0b0f14",
          surface: "#121821",
          border: "#1f2937",
          muted: "#8b98a9",
        },
        flag: {
          arb: "#22c55e",
          wide: "#f59e0b",
          diverge: "#a855f7",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
