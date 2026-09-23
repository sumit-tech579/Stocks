/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981', // emerald-500
          600: '#059669', // emerald-600 Groww-like primary
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        tradeGreen: {
          light: '#00D09C',
          DEFAULT: '#00B386',
          dark: '#00956E',
          bg: '#E8FBF4',
          bgDark: 'rgba(0, 208, 156, 0.12)',
        },
        tradeRed: {
          light: '#FF5C5C',
          DEFAULT: '#EB5B5B',
          dark: '#D94848',
          bg: '#FDF2F2',
          bgDark: 'rgba(235, 91, 91, 0.12)',
        },
        surface: {
          light: '#FFFFFF',
          lightSubtle: '#F8FAFC',
          dark: '#0F172A',
          darkSubtle: '#1E293B',
          darkCard: '#1E293B',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        'elevation': '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
      },
      animation: {
        'pulse-subtle': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
