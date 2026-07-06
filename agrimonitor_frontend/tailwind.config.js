/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        field: {
          50: "#f4f8f1",
          100: "#e4efdb",
          700: "#3f6f2a",
          800: "#315820"
        },
        soil: {
          100: "#f1e7d6",
          700: "#76563a"
        }
      }
    },
  },
  plugins: [],
};

