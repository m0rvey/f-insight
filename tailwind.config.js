/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,html}",
    "./popup.html"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        faceit: {
          orange: '#FF5500',
          'orange-hover': '#FF6B1A',
          dark: '#121214',
          card: '#1B1B1E',
          'card-hover': '#242429',
          border: '#2C2C32',
          muted: '#8A8A93'
        },
        risk: {
          low: '#10B981',    // green
          medium: '#F59E0B', // yellow
          high: '#EF4444',   // red
          critical: '#DC2626'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      boxShadow: {
        'glow-orange': '0 0 15px rgba(255, 85, 0, 0.25)',
        'glow-green': '0 0 15px rgba(16, 185, 129, 0.25)',
        'glow-red': '0 0 15px rgba(239, 68, 68, 0.25)',
        'card': '0 8px 30px rgba(0, 0, 0, 0.6)'
      }
    },
  },
  plugins: [],
}
