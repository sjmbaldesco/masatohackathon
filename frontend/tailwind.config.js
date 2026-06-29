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
      },
    },
  },
  plugins: [],
};
