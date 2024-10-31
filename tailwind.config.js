/** @type {import('tailwindcss').Config} */
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
        navy: "#001f3f",
        "light-grey": "#f5f5f5",
        brown: "#5a2d0c",
      },
      fontFamily: {
        libre: ["Libre Baskerville", "serif"],
        inter: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [require("tailwind-scrollbar")],
};
