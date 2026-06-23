import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#FBF7F0",
        surface: "#FFFFFF",
        surface2: "#F5EFE6",
        ink: "#2A2522",
        muted: "#8C8279",
        line: "rgba(42, 37, 34, 0.08)",
        coral: "#FF6B5E",
        coralSoft: "#FFF0EE",
        teal: "#3DB6A8",
        tealSoft: "#E8F7F5",
        peach: "#FFD4C2",
        lavender: "#E8DFF5",
        sunny: "#FFE7A0",
        success: "#34C77B",
        danger: "#EF4444",

        // Keep old names as aliases during migration
        accent: "#FF6B5E",
        accentSoft: "#FFF0EE",
      },
      fontFamily: {
        sans: ['"Nunito"', '"Geist"', "system-ui", "sans-serif"],
        mono: ['"Geist Mono"', "ui-monospace", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.03em",
        tighter2: "-0.04em",
      },
      borderRadius: {
        xl2: "1.25rem",
        xl3: "1.5rem",
        xl4: "2rem",
      },
      boxShadow: {
        soft: "0 2px 8px rgba(42, 37, 34, 0.06), 0 0 1px rgba(42, 37, 34, 0.08)",
        glow: "0 4px 20px rgba(255, 107, 94, 0.12)",
        glow2: "0 4px 24px rgba(255, 107, 94, 0.18)",
        lifted: "0 8px 32px rgba(42, 37, 34, 0.10)",
        ring: "0 0 0 4px rgba(255, 107, 94, 0.18)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fade: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(100%)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulse2: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
        },
        shimmerBg: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        bounce2: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        shuffleSpin: {
          "0%": { opacity: "1", transform: "scale(1) rotate(0deg)" },
          "50%": { opacity: "0.5", transform: "scale(0.92) rotate(3deg)" },
          "100%": { opacity: "1", transform: "scale(1) rotate(0deg)" },
        },
      },
      animation: {
        rise: "rise 0.5s cubic-bezier(.22, 1, .36, 1) both",
        fade: "fade 0.4s ease-out both",
        "slide-up": "slideUp 0.4s cubic-bezier(.22, 1, .36, 1) both",
        pulse2: "pulse2 2s ease-in-out infinite",
        shimmer: "shimmerBg 1.4s linear infinite",
        bounce2: "bounce2 0.5s cubic-bezier(.22, 1, .36, 1)",
        shuffleSpin: "shuffleSpin 0.4s cubic-bezier(.22, 1, .36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
