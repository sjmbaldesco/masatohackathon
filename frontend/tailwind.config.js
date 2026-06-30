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
          cream: "#EDF2F4",
          rust: "#EF233C",
          "rust-light": "rgba(239,35,60,0.1)",
          "red-deep": "#D90429",
          dark: "#2B2D42",
          warm: "#5A6478",
          muted: "#8D99AE",
          border: "rgba(141,153,174,0.3)",
          card: "rgba(255,255,255,0.95)",
          overlay: "rgba(237,242,244,0.9)",
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
