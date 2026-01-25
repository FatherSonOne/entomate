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
        // CSS Variable-based semantic colors (Multi-Brand Theme System)
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
        // Terminal Theme Colors
        terminal: {
          primary: '#00ff41',
          amber: '#ffb000',
          ai: '#a000ff',
          error: '#ff0040',
          info: '#00ccff',
          bg: {
            base: '#000000',
            surface: '#0a0a0a',
            elevated: '#111111',
          },
          text: {
            primary: '#00ff41',
            secondary: '#00cc33',
            tertiary: '#008822',
            muted: '#004411',
          }
        },
      },
      backgroundImage: {
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-ai': 'var(--gradient-ai)',
        'gradient-success': 'var(--gradient-success)',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      fontFamily: {
        // Brand-aware font utilities (automatically use theme fonts)
        display: ['var(--font-display)', 'Space Grotesk', 'Inter', 'sans-serif'],
        sans: ['var(--font-body)', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Consolas', 'monospace'],

        // Brand-specific aliases (for explicit brand font usage)
        'brand-display': ['var(--font-display)', 'Space Grotesk', 'Inter', 'sans-serif'],
        'brand-heading': ['var(--font-heading)', 'Inter', 'sans-serif'],
        'brand-body': ['var(--font-body)', 'Inter', 'sans-serif'],
        'brand-mono': ['var(--font-mono)', 'JetBrains Mono', 'monospace'],

        // Terminal theme fonts (legacy)
        terminal: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
        'terminal-display': ['Share Tech Mono', 'JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 2s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        // Terminal theme animations
        'page-enter': 'pageSlideIn 280ms cubic-bezier(0.25, 0, 0.75, 1)',
        'page-fade': 'pageFadeIn 280ms cubic-bezier(0.25, 0, 0.75, 1)',
        'list-enter': 'listItemEnter 250ms cubic-bezier(0.25, 0, 0.75, 1)',
        'list-exit': 'listItemExit 200ms ease-out',
        'shimmer': 'shimmer 1.8s linear infinite',
        'skeleton-pulse': 'skeletonPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glitch': 'glitch 400ms ease-in-out',
        'cursor-blink': 'cursorBlink 530ms step-end infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'toast-enter': 'toastSlideIn 250ms ease-out',
        'toast-exit': 'toastSlideOut 200ms ease-in',
        'toast-shake': 'toastShake 400ms ease-in-out',
        'modal-enter': 'modalEnter 280ms ease-out',
        'modal-exit': 'modalExit 220ms ease-in',
        'backdrop-fade': 'backdropFadeIn 200ms ease',
        'icon-rotate': 'iconRotate 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        'icon-bounce': 'iconBounce 400ms ease-in-out',
        'bar-grow': 'barGrow 600ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px var(--highlight-color), 0 0 10px var(--highlight-color)' },
          '100%': { boxShadow: '0 0 10px var(--highlight-color), 0 0 20px var(--highlight-color), 0 0 30px var(--highlight-color)' },
        },
        // Terminal theme keyframes (defined in animations.css, referenced here for Tailwind)
        pageSlideIn: {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        pageFadeIn: {
          from: { opacity: '0', transform: 'scale(0.98)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        listItemEnter: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-468px 0' },
          '100%': { backgroundPosition: '468px 0' },
        },
        pulseGlow: {
          '0%, 100%': { textShadow: '0 0 8px var(--terminal-primary-glow)', opacity: '1' },
          '50%': { textShadow: '0 0 20px var(--terminal-primary-glow)', opacity: '0.9' },
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
        // Terminal theme shadows
        'terminal-glow': '0 0 20px rgba(0, 255, 65, 0.4)',
        'terminal-glow-sm': '0 0 12px rgba(0, 255, 65, 0.4)',
        'terminal-glow-lg': '0 0 40px rgba(0, 255, 65, 0.3)',
      },
      transitionDuration: {
        'fast': '150ms',
        'normal': '250ms',
        'medium': '350ms',
        'slow': '500ms',
      },
      transitionTimingFunction: {
        'terminal': 'cubic-bezier(0.25, 0, 0.75, 1)',
      }
    },
  },
  plugins: [],
}
