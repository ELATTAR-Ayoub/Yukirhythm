/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./sections/**/*.{js,ts,jsx,tsx}",
    "./styles/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    letterSpacing: {
      tightest: "-12px",
      tighter: "-6px",
      tight: "-.025em",
      normal: "0",
      wide: ".025em",
      wider: ".05em",
      widest: ".1em",
      widest: ".25em",
    },
    extend: {
      colors: {
        "primary-black": "#0D0D0D",
        "secondary-white": "#F0F0F0",
        "accent-color": "#536EFF",
      },
      transitionTimingFunction: {
        "out-flex": "cubic-bezier(0.05, 0.6, 0.4, 0.9)",
      },
      fontFamily: {
        PIXELADE: ["PIXELADE", "sans-serif"],
      },
    },
  },
};
