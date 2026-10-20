import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F3F4F1",
        surface: "#FFFFFF",
        surface2: "#ECEDE9",
        ink: "#1E2230",
        muted: "#646877",
        line: "rgba(30, 34, 48, 0.10)",
        accent: "#3F51C7",
        accentSoft: "#E3E7FA",
        sage: { DEFAULT: "#DCE7DC", ink: "#46654A" },
        blush: { DEFAULT: "#F5DEE0", ink: "#9A4A5A" },
        sky: { DEFAULT: "#DCE8F5", ink: "#36628F" },
        butter: { DEFAULT: "#F4EBCB", ink: "#806524" },
        lilac: { DEFAULT: "#E7E1F4", ink: "#5E4E92" },
        success: "#46654A",
        danger: "#B3364A",
      },
      fontFamily: {
        sans: ['"Archivo"', "system-ui", "sans-serif"],
      },
      letterSpacing: {
        tightest: "-0.02em",
        tighter2: "-0.03em",
      },
      borderRadius: {
        xl2: "12px",
        xl3: "16px",
        xl4: "20px",
      },
      boxShadow: {
        soft: "none",
        glow: "none",
        glow2: "none",
        lifted: "0 16px 40px -16px rgba(30, 34, 48, 0.25)",
        ring: "0 0 0 3px rgba(63, 81, 199, 0.35)",
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
        glint: {
          "0%": { left: "-20%" },
          "100%": { left: "120%" },
        },
        glassShimmer: {
          "0%": { backgroundPosition: "-150% 0" },
          "100%": { backgroundPosition: "250% 0" },
        },
        swing: {
          "0%": { transform: "rotate(0deg)" },
          "30%": { transform: "rotate(-3deg)" },
          "60%": { transform: "rotate(2deg)" },
          "100%": { transform: "rotate(0deg)" },
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
        glint: "glint 0.8s cubic-bezier(.45,0,.55,1) forwards",
        "glass-shimmer": "glassShimmer 3.5s ease-in-out infinite",
        swing: "swing 0.8s ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
