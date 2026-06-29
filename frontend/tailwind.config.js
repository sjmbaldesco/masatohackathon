/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          red: "#D32F2F",
          orange: "#F57C00",
          green: "#388E3C",
          dark: "#1A1A2E",
        },
        pasada: {
          cream: "#FAF5EE",
          rust: "#C2652A",
          "rust-light": "rgba(194,101,42,0.1)",
          dark: "#3A302A",
          warm: "#605850",
          muted: "#9A9088",
          border: "rgba(216,208,200,0.6)",
          card: "rgba(255,255,255,0.95)",
          overlay: "rgba(250,245,238,0.9)",
        },
      },
      fontFamily: {
        garamond: ['"EB Garamond"', "Georgia", "serif"],
        manrope: ["Manrope", "sans-serif"],
      },
      backdropBlur: {
        xs: "4px",
        sm: "6px",
      },
    },
  },
  plugins: [],
};
