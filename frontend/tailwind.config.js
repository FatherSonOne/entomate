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
        // CMF Nothing inspired neutral palette
        nothing: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#0a0a0b',
        },
        // CSS Variable-based semantic colors (Nothing x Supabase)
        surface: {
          base: 'var(--bg-base)',
          DEFAULT: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
          muted: 'var(--bg-muted)',
          subtle: 'var(--bg-subtle)',
        },
        content: {
          DEFAULT: 'var(--text-primary)',
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          muted: 'var(--text-muted)',
        },
        line: {
          subtle: 'var(--border-subtle)',
          DEFAULT: 'var(--border-default)',
          strong: 'var(--border-strong)',
        },
        accent: {
          primary: 'var(--accent-primary)',
          'primary-light': 'var(--accent-primary-light)',
          'primary-dim': 'var(--accent-primary-dim)',
          secondary: 'var(--accent-secondary)',
          'secondary-light': 'var(--accent-secondary-light)',
          'secondary-dim': 'var(--accent-secondary-dim)',
          tertiary: 'var(--accent-tertiary)',
          'tertiary-light': 'var(--accent-tertiary-light)',
          'tertiary-dim': 'var(--accent-tertiary-dim)',
        },
        semantic: {
          success: 'var(--semantic-success)',
          'success-dim': 'var(--semantic-success-dim)',
          warning: 'var(--semantic-warning)',
          'warning-dim': 'var(--semantic-warning-dim)',
          error: 'var(--semantic-error)',
          'error-dim': 'var(--semantic-error-dim)',
          info: 'var(--semantic-info)',
          'info-dim': 'var(--semantic-info-dim)',
        },
        // Dynamic highlight color (set via CSS variable)
        highlight: {
          DEFAULT: 'var(--highlight-color)',
          light: 'rgba(var(--highlight-color-rgb), 0.1)',
          medium: 'rgba(var(--highlight-color-rgb), 0.3)',
        },
        // Data Visualization Colors (vibrant palette for charts/graphs)
        data: {
          cyan: 'var(--data-cyan)',
          pink: 'var(--data-pink)',
          orange: 'var(--data-orange)',
          purple: 'var(--data-purple)',
          green: 'var(--data-green)',
          yellow: 'var(--data-yellow)',
          blue: 'var(--data-blue)',
        },
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
      },
      backgroundImage: {
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-ai': 'var(--gradient-ai)',
        'gradient-success': 'var(--gradient-success)',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      fontFamily: {
        // CMF Nothing uses dot-matrix inspired fonts
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Consolas', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 2s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px var(--highlight-color), 0 0 10px var(--highlight-color)' },
          '100%': { boxShadow: '0 0 10px var(--highlight-color), 0 0 20px var(--highlight-color), 0 0 30px var(--highlight-color)' },
        }
      },
      boxShadow: {
        'highlight': '0 0 0 2px var(--highlight-color)',
        'highlight-glow': '0 0 15px var(--accent-primary-glow)',
        'glow': '0 0 20px var(--accent-primary-glow)',
        'glow-lg': '0 0 40px var(--accent-primary-glow)',
        'glow-ai': '0 0 30px var(--accent-tertiary-dim)',
        'elevated': '0 4px 24px rgba(0, 0, 0, 0.3)',
        'command': '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
      }
    },
  },
  plugins: [],
}
