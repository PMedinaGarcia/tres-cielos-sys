/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1a2740",
        celeste: "#b9e4f4",
        sky: "#e8f6fc",
        ice: "#ffffff",
        teal: "#0f8a8a",
        "teal-dark": "#0c6e6e",
      },
      fontFamily: {
        display: ["var(--font-outfit)", "Segoe UI", "Helvetica Neue", "sans-serif"],
        body: ["var(--font-outfit)", "Segoe UI", "Helvetica Neue", "sans-serif"],
      },
      boxShadow: {
        glass: "0 8px 32px rgba(125, 211, 252, 0.22)",
        "glass-lg": "0 18px 50px rgba(125, 211, 252, 0.28)",
      },
      borderRadius: {
        glass: "1.25rem",
      },
    },
  },
  plugins: [],
};
