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
        'glow-soft-orange': '0 0 15px rgba(255, 85, 0, 0.15)',
        'glow-green': '0 0 15px rgba(16, 185, 129, 0.25)',
        'glow-cyan': '0 0 14px rgba(6, 182, 212, 0.18)',
        'card': '0 12px 36px rgba(0, 0, 0, 0.75)'
      }
    },
  },
  corePlugins: {
    float: false,
    clear: false,
    container: false,
    touchAction: false,
    scrollSnapType: false,
    scrollSnapAlign: false,
    scrollSnapStop: false,
    columns: false,
  },
  plugins: [],
}
