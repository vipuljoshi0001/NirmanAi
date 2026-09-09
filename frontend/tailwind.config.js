/** @type {import('tailwindcss').Config} */
export default {
  // 1. Keeps your strict file targets and expands them to catch JS/JSX just in case
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  
  // 2. Activates the class-based dark mode toggle system properly
  darkMode: 'class',
  
  theme: {
    extend: {
      // 3. Preserves all your customized infrastructure project palette assets
      colors: {
        ink: {
          950: '#0b0e14',
          900: '#0f1420',
          800: '#151b2c',
          700: '#1b2338',
        },
        brand: {
          orange: '#F5A623',
          orangeDark: '#E08E0B',
        },
        signal: {
          green: '#1FAE7A',
          amber: '#E8A33D',
          red: '#E85D4E',
          cyan: '#3FC1D6',
          blue: '#3B82C4',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 20, 32, 0.04), 0 1px 0 rgba(15, 20, 32, 0.03)',
      },
    },
  },
  plugins: [],
}
