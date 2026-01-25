/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f7ff',
          100: '#ebf0ff',
          200: '#d6e0ff',
          300: '#b8ccff',
          400: '#8aa8ff',
          500: '#667eea',
          600: '#5568d3',
          700: '#4451b8',
          800: '#3a3f9e',
          900: '#2e3280',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['Courier New', 'Courier', 'monospace'],
      },
      letterSpacing: {
        'extra-wide': '0.5em',
      },
    },
  },
  plugins: [],
}
