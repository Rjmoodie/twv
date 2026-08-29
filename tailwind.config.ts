import type { Config } from "tailwindcss";

declare function require(module: string): unknown;

export default {
  darkMode: ["class"],
  // Everything lives under src/. The ./pages, ./components and ./app globs that
  // used to sit here were Next.js-era leftovers matching nothing.
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1320px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        display: ["Space Grotesk", "Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["JetBrains Mono", "SF Mono", "Monaco", "Cascadia Code", "Roboto Mono", "Courier New", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(var(--primary-hover))",
          muted: "hsl(var(--primary-muted))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
          hover: "hsl(var(--secondary-hover))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          hover: "hsl(var(--accent-hover))",
          muted: "hsl(var(--accent-muted))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--foreground))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
        gold: {
          DEFAULT: "hsl(var(--gold))",
          foreground: "hsl(var(--gold-foreground))",
          muted: "hsl(var(--gold-muted))",
        },
        coach: {
          DEFAULT: "hsl(var(--coach))",
          foreground: "hsl(var(--coach-foreground))",
          muted: "hsl(var(--coach-muted))",
        },
        brand: {
          50:  "hsl(221 100% 97%)",
          100: "hsl(221 95% 92%)",
          200: "hsl(221 90% 85%)",
          300: "hsl(221 87% 75%)",
          400: "hsl(221 87% 65%)",
          500: "hsl(221 83% 53%)",
          600: "hsl(221 83% 43%)",
          700: "hsl(221 80% 33%)",
          800: "hsl(221 72% 24%)",
          900: "hsl(221 65% 17%)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        surface: {
          raised: "hsl(var(--surface-raised))",
          subtle: "hsl(var(--surface-subtle))",
        },
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        "3xl": "2rem",
        "2xl": "1.5rem",
        xl: "1.25rem",
        lg: "0.875rem",
        md: "0.625rem",
        sm: "0.5rem",
      },
      boxShadow: {
        "elev-1": "0 1px 2px hsl(224 30% 12% / 0.05)",
        "elev-2": "0 12px 32px hsl(224 30% 12% / 0.08)",
        "elev-3": "0 22px 56px hsl(224 30% 12% / 0.14)",
        "ring-soft": "0 0 0 4px hsl(var(--ring) / 0.18)",
        "glow-primary": "0 18px 44px hsl(var(--primary) / 0.28)",
        "glow-gold":    "0 12px 36px hsl(var(--gold) / 0.32)",
        "glow-coach":   "0 12px 36px hsl(var(--coach) / 0.28)",
      },
      transitionTimingFunction: {
        apple: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      letterSpacing: {
        tight2: "-0.02em",
        wide8:  "0.08em",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%":   { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        riseIn: {
          "0%":   { opacity: "0", transform: "translateY(24px) scale(0.97)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        shimmer: {
          "0%":   { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        auraPulse: {
          "0%, 100%": { boxShadow: "0 0 0 0 hsl(262 80% 68% / 0)" },
          "50%":      { boxShadow: "0 0 0 8px hsl(262 80% 68% / 0.12)" },
        },
        subtleFloat: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "fade-in":      "fadeIn 240ms cubic-bezier(0.4, 0, 0.2, 1)",
        "scale-in":     "scaleIn 240ms cubic-bezier(0.4, 0, 0.2, 1)",
        "slide-up":     "slideUp 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        "rise-in":      "riseIn 360ms cubic-bezier(0.16, 1, 0.3, 1)",
        "shimmer":      "shimmer 1.8s ease-in-out infinite",
        "aura-pulse":   "auraPulse 3s ease-in-out infinite",
        "float-subtle": "subtleFloat 5.5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate") as any],
} satisfies Config;
