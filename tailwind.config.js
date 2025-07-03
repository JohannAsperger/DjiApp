/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./templates/**/*.html", "./static/**/*.js"],
  safelist: [
    'bg-card-dark', 'bg-card-light',
    'bg-background-dark', 'bg-background-light',
    'text-text-dark', 'text-text-light',
    'bg-brand', 'bg-brand-dark', 'bg-brand-light',
    'text-brand', 'text-brand-dark', 'text-brand-light',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#3b82f6',
          dark: '#2563eb',
          light: '#93c5fd',
        },
        background: {
          dark: '#0f172a',
          light: '#f8fafc',
        },
        card: {
          dark: '#1e293b',
          light: '#ffffff',
        },
        text: {
          dark: '#f1f5f9',
          light: '#1e293b',
        },
      },
    },
  },
  plugins: [],
};



