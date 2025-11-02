/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { primary: '#0A3F01' },
      fontFamily: { sans: ['Montserrat','ui-sans-serif','system-ui'] },
    },
  },
  plugins: [],
}

