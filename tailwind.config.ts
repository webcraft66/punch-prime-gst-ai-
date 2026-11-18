import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#eef3fb', 100: '#d9e4f5', 200: '#b3c8eb', 300: '#7fa1da', 400: '#4f7bc7', 500: '#2f5fae', 600: '#1f4a92', 700: '#183b76', 800: '#122d5a', 900: '#0b1f44', 950: '#071530' },
        gold: { 50: '#fff9e6', 100: '#feefbd', 200: '#fde18a', 300: '#fbd058', 400: '#f5c542', 500: '#e0a915', 600: '#b8860b', 700: '#8a6410' },
      },
      fontFamily: { sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgba(16,24,40,.05), 0 1px 3px rgba(16,24,40,.06)', pop: '0 12px 32px rgba(11,31,68,.18)' },
    },
  },
  plugins: [],
};
export default config;
