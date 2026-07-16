const {
  default: flattenColorPalette,
} = require("tailwindcss/lib/util/flattenColorPalette");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./sections/**/*.{js,ts,jsx,tsx}",
    "./styles/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ["class", "class"],
  theme: {
    letterSpacing: {
      tightest: "-12px",
      tighter: "-6px",
      tight: "-.025em",
      normal: "0",
      wide: ".025em",
      wider: ".05em",
      widest: ".25em",
    },
    extend: {
      colors: {
        popover: "#262626",
        "dark-shade-85": "#D9D9D9",
        // Studio palette — brand anchors + full scales (see /design-system/colors)
        paper: "#F7F6F3",
        ink: {
          DEFAULT: "#191919",
          50: "hsl(45 20% 96%)",
          100: "hsl(45 14% 91%)",
          200: "hsl(45 10% 84%)",
          300: "hsl(45 8% 74%)",
          400: "hsl(45 5% 60%)",
          500: "hsl(45 3% 46%)",
          600: "hsl(45 2% 36%)",
          700: "hsl(0 0% 28%)",
          800: "hsl(0 0% 20%)",
          900: "hsl(0 0% 14%)",
          950: "hsl(0 0% 10%)",
        },
        cobalt: {
          DEFAULT: "#1450F0",
          50: "hsl(224 100% 97%)",
          100: "hsl(224 96% 93%)",
          200: "hsl(224 93% 87%)",
          300: "hsl(224 91% 78%)",
          400: "hsl(224 89% 66%)",
          500: "hsl(224 88% 57%)",
          600: "hsl(224 88% 51%)",
          700: "hsl(226 84% 42%)",
          800: "hsl(227 78% 34%)",
          900: "hsl(228 72% 27%)",
          950: "hsl(230 68% 17%)",
        },
        mint: {
          DEFAULT: "#7DF08A",
          50: "hsl(127 65% 96%)",
          100: "hsl(127 68% 90%)",
          200: "hsl(127 72% 83%)",
          300: "hsl(127 76% 78%)",
          400: "hsl(127 79% 72%)",
          500: "hsl(127 62% 56%)",
          600: "hsl(128 56% 44%)",
          700: "hsl(129 52% 35%)",
          800: "hsl(130 47% 28%)",
          900: "hsl(131 44% 22%)",
          950: "hsl(133 45% 12%)",
        },
        signal: {
          DEFAULT: "hsl(0 84% 60%)",
          50: "hsl(0 86% 97%)",
          100: "hsl(0 90% 94%)",
          200: "hsl(0 92% 88%)",
          300: "hsl(0 90% 80%)",
          400: "hsl(0 87% 70%)",
          500: "hsl(0 84% 60%)",
          600: "hsl(0 76% 50%)",
          700: "hsl(0 74% 41%)",
          800: "hsl(0 70% 34%)",
          900: "hsl(0 64% 28%)",
          950: "hsl(0 72% 15%)",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },
      animation: {
        aurora: "aurora 60s linear infinite",
      },
      keyframes: {
        aurora: {
          from: {
            backgroundPosition: "50% 50%, 50% 50%",
          },
          to: {
            backgroundPosition: "350% 50%, 350% 50%",
          },
        },
      },
      transitionTimingFunction: {
        "out-flex": "cubic-bezier(0.05, 0.6, 0.4, 0.9)",
      },
      fontFamily: {
        PIXELADE: ["PIXELADE", "sans-serif"],
        // Studio type roles — Satoshi (display/ui) + OffBit (pixel/data)
        display: ["var(--font-sans)", "var(--font-jp)", "sans-serif"],
        ui: ["var(--font-sans)", "var(--font-jp)", "sans-serif"],
        label: ["var(--font-sans)", "var(--font-jp)", "sans-serif"],
        data: ["var(--font-pixel-dot)", "var(--font-pixel)", "monospace"],
        pixel: ["var(--font-pixel)", "monospace"],
      },
      boxShadow: {
        e1: "var(--shadow-e1)",
        e2: "var(--shadow-e2)",
        e3: "var(--shadow-e3)",
        e4: "var(--shadow-e4)",
      },
      transitionDuration: {
        fast: "150ms",
        base: "250ms",
        slow: "400ms",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), addVariablesForColors],
};

// This plugin adds each Tailwind color as a global CSS variable, e.g. var(--gray-200).
function addVariablesForColors({ addBase, theme }) {
  let allColors = flattenColorPalette(theme("colors"));
  let newVars = Object.fromEntries(
    Object.entries(allColors).map(([key, val]) => [`--${key}`, val])
  );

  addBase({
    ":root": newVars,
  });
}
