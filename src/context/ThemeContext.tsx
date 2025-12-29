import React, { createContext, useContext, useEffect, useState } from 'react';

// Blue-focused color palette for dashboard
export const HIGHLIGHT_COLORS = {
  blue: { name: 'Blue', value: '#2563EB', rgb: '37, 99, 235' },
  sky: { name: 'Sky Blue', value: '#0EA5E9', rgb: '14, 165, 233' },
  indigo: { name: 'Indigo', value: '#4F46E5', rgb: '79, 70, 229' },
  navy: { name: 'Navy', value: '#1E40AF', rgb: '30, 64, 175' },
  cyan: { name: 'Cyan', value: '#06B6D4', rgb: '6, 182, 212' },
  slate: { name: 'Slate Blue', value: '#6366F1', rgb: '99, 102, 241' },
};

export type ThemeMode = 'light' | 'dark' | 'system';
export type HighlightColorKey = keyof typeof HIGHLIGHT_COLORS;

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean;
  toggleMode: () => void;
  highlightColor: HighlightColorKey;
  setHighlightColor: (color: HighlightColorKey) => void;
  currentHighlight: typeof HIGHLIGHT_COLORS[HighlightColorKey];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_STORAGE_KEY = 'entomate-theme-mode';
const HIGHLIGHT_STORAGE_KEY = 'entomate-highlight-color';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    }
    return 'system';
  });

  const [highlightColor, setHighlightColorState] = useState<HighlightColorKey>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(HIGHLIGHT_STORAGE_KEY);
      if (stored && stored in HIGHLIGHT_COLORS) {
        return stored as HighlightColorKey;
      }
    }
    return 'blue'; // Default to blue (primary accent)
  });

  const isDark = mode === 'dark' || (mode === 'system' && getSystemTheme() === 'dark');

  // Apply theme to DOM
  useEffect(() => {
    const root = document.documentElement;

    if (isDark) {
      root.classList.add('dark');
      root.dataset.theme = 'dark';
    } else {
      root.classList.remove('dark');
      root.dataset.theme = 'light';
    }
  }, [isDark]);

  // Apply highlight color to DOM
  useEffect(() => {
    const root = document.documentElement;
    const color = HIGHLIGHT_COLORS[highlightColor];

    root.style.setProperty('--color-accent', color.value);
    root.style.setProperty('--color-accent-rgb', color.rgb);
    root.style.setProperty('--color-accent-hover', adjustBrightness(color.value, -15));
  }, [highlightColor]);

  // Listen for system theme changes
  useEffect(() => {
    if (mode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const root = document.documentElement;
      if (mediaQuery.matches) {
        root.classList.add('dark');
        root.dataset.theme = 'dark';
      } else {
        root.classList.remove('dark');
        root.dataset.theme = 'light';
      }
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [mode]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(THEME_STORAGE_KEY, newMode);
  };

  const toggleMode = () => {
    const newMode = isDark ? 'light' : 'dark';
    setMode(newMode);
  };

  const setHighlightColor = (color: HighlightColorKey) => {
    setHighlightColorState(color);
    localStorage.setItem(HIGHLIGHT_STORAGE_KEY, color);
  };

  const value: ThemeContextValue = {
    mode,
    setMode,
    isDark,
    toggleMode,
    highlightColor,
    setHighlightColor,
    currentHighlight: HIGHLIGHT_COLORS[highlightColor],
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Helper to adjust color brightness
function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(Math.min((num >> 16) + amt, 255), 0);
  const G = Math.max(Math.min(((num >> 8) & 0x00ff) + amt, 255), 0);
  const B = Math.max(Math.min((num & 0x0000ff) + amt, 255), 0);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}
