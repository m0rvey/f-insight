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
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      boxShadow: {
        'glow-orange': '0 0 20px rgba(255, 85, 0, 0.35)',
        'glow-green': '0 0 15px rgba(16, 185, 129, 0.25)',
        'card': '0 12px 36px rgba(0, 0, 0, 0.75)'
      }
    },
  },
  plugins: [],
}
