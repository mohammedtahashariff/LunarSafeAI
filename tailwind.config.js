/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./frontend/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aerospace: {
          950: '#030712',
          900: '#0b0f19',
          800: '#111827',
          700: '#1f2937',
          600: '#374151',
          500: '#6b7280',
          400: '#9ca3af',
          300: '#d1d5db',
          200: '#e5e7eb',
          100: '#f3f4f6',
          50: '#f9fafb',
          accent: '#06b6d4', // Cyan accent
        },
        hazard: {
          safe: '#10b981',      // Green
          low: '#84cc16',       // Light Green
          moderate: '#eab308',  // Yellow
          high: '#f97316',      // Orange
          extreme: '#ef4444',   // Red
          unknown: '#6b7280',   // Gray
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
      }
    },
  },
  plugins: [],
}
