import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dtel: {
          // Dark mode (dominante escuro)
          dark:    '#021408',
          deeper:  '#031a0b',
          bg2:     '#052e15',
          card:    '#073d1e',
          // Green palette
          green:   '#006734',
          mid:     '#0a7a3e',
          light:   '#1a9e52',
          bright:  '#22c55e',
          // Yellow / accent
          yellow:  '#FFDE00',
          gold:    '#FEBF11',
          // Light mode surfaces
          bgLight: '#f0faf4',
          border:  '#d4e8dc',
          hover:   '#e4f5ec',
          // Text
          text:    '#0d2517',
          secondary: '#3a6347',
          muted:   '#6b8f74',
        },
        status: {
          todo:         '#94A3B8',
          project:      '#3B82F6',
          projectDone:  '#06B6D4',
          launch:       '#F59E0B',
          launchDone:   '#F97316',
          fusion:       '#8B5CF6',
          fusionDone:   '#10B981',
          finished:     '#006734',
        }
      },
      fontFamily: {
        sans: ['Heebo', 'system-ui', 'sans-serif'],
        heading: ['Cooper Hewitt', 'Heebo', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
      boxShadow: {
        card: '0 1px 6px rgba(0,0,0,0.08)',
        'card-md': '0 4px 20px rgba(0,0,0,0.10)',
        'card-lg': '0 8px 40px rgba(0,0,0,0.14)',
      },
      animation: {
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

export default config
