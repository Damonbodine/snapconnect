/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          purple: '#7C3AED',
          pink: '#EC4899',
        },
        secondary: {
          pink: '#F472B6',
          yellow: '#FBBF24',
        },
        dark: {
          bg: '#0F0F0F',
          surface: 'rgba(255, 255, 255, 0.1)',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#9CA3AF',
        }
      },
      fontFamily: {
        sans: ['System', 'sans-serif'],
      },
    },
  },
  plugins: [],
}