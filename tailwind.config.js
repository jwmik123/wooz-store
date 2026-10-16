/** @type {import('tailwindcss').Config} */

// All Wooz UI tokens live as CSS variables in app/globals.css (:root).
// Tailwind only *maps* them so classes like `bg-paper/70`, `rounded-wz-lg`,
// `shadow-wz-lg`, `ease-wz-out` stay in sync. See docs/UI-TOKENS.md.
const rgb = (name) => `rgb(var(--wz-${name}) / <alpha-value>)`;

module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        black: "#000",
        primary: rgb("green"),
        white: "#FAF9F6",
        navy: "#001f3f",
        "light-grey": "#f5f5f5",
        brown: "#5a2d0c",
        // Wooz tokens
        ink: rgb("ink"),
        "ink-soft": rgb("ink-soft"),
        leaf: rgb("leaf"),
        paper: rgb("paper"),
        cloud: rgb("cloud"),
        sky: rgb("sky"),
        mint: rgb("mint"),
        blush: rgb("blush"),
        butter: rgb("butter"),
        lilac: rgb("lilac"),
        danger: rgb("danger"),
      },
      fontFamily: {
        sans: ["var(--wz-font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--wz-font-display)", "ui-serif", "Georgia", "serif"],
        libre: ["var(--wz-font-libre)", "Libre Baskerville", "serif"],
        inter: ["var(--wz-font-sans)", "sans-serif"],
      },
      fontSize: {
        eyebrow: ["var(--wz-text-eyebrow)", { lineHeight: "1", letterSpacing: "0.14em" }],
        "wz-sm": ["var(--wz-text-sm)", { lineHeight: "1.5" }],
        "wz-base": ["var(--wz-text-base)", { lineHeight: "1.6" }],
        "wz-lg": ["var(--wz-text-lg)", { lineHeight: "1.35" }],
        "wz-xl": ["var(--wz-text-xl)", { lineHeight: "1.2" }],
        "wz-display": ["var(--wz-text-display)", { lineHeight: "1.02", letterSpacing: "-0.02em" }],
      },
      borderRadius: {
        "wz-xs": "var(--wz-radius-xs)",
        "wz-sm": "var(--wz-radius-sm)",
        "wz-md": "var(--wz-radius-md)",
        "wz-lg": "var(--wz-radius-lg)",
        "wz-xl": "var(--wz-radius-xl)",
      },
      boxShadow: {
        "wz-sm": "var(--wz-shadow-sm)",
        "wz-md": "var(--wz-shadow-md)",
        "wz-lg": "var(--wz-shadow-lg)",
        "wz-inner": "var(--wz-shadow-inner)",
        "wz-focus": "var(--wz-focus-ring)",
      },
      backdropBlur: {
        wz: "var(--wz-blur)",
      },
      transitionTimingFunction: {
        "wz-out": "var(--wz-ease-out)",
        "wz-in-out": "var(--wz-ease-in-out)",
        "wz-spring": "var(--wz-ease-spring)",
      },
      transitionDuration: {
        "wz-fast": "var(--wz-dur-fast)",
        "wz-base": "var(--wz-dur-base)",
        "wz-slow": "var(--wz-dur-slow)",
      },
      zIndex: {
        "wz-overlay": "var(--wz-z-overlay)",
        "wz-panel": "var(--wz-z-panel)",
        "wz-chrome": "var(--wz-z-chrome)",
      },
    },
  },
  plugins: [require("tailwind-scrollbar")],
};
