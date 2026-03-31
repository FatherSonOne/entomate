import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

export const THEME_MODES = {
  light: 'light',
  dark: 'dark',
  system: 'system'
};

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    return localStorage.getItem('entomate-theme-mode') || THEME_MODES.dark;
  });

  const [resolvedMode, setResolvedMode] = useState('dark');
  const [dbLoaded, setDbLoaded] = useState(false);

  // On mount, try to load theme from DB (async, non-blocking).
  // If DB has a value, override localStorage. Otherwise keep localStorage value.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Dynamic import to avoid circular dependency with api.js
        const { settingsApi } = await import('../services/api');
        const res = await settingsApi.getUser();
        const dbMode = res?.settings?.theme_mode;
        if (!cancelled && dbMode && Object.values(THEME_MODES).includes(dbMode)) {
          setMode(dbMode);
          localStorage.setItem('entomate-theme-mode', dbMode);
        }
      } catch {
        // Settings API not available (not logged in, backend down) — use localStorage
      } finally {
        if (!cancelled) setDbLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Resolve system preference
  useEffect(() => {
    const updateResolvedMode = () => {
      if (mode === THEME_MODES.system) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setResolvedMode(prefersDark ? 'dark' : 'light');
      } else {
        setResolvedMode(mode);
      }
    };

    updateResolvedMode();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', updateResolvedMode);
    return () => mediaQuery.removeEventListener('change', updateResolvedMode);
  }, [mode]);

  // Apply mode to document
  useEffect(() => {
    const root = document.documentElement;
    root.removeAttribute('data-theme');
    root.setAttribute('data-brand', 'void-crimson');

    if (resolvedMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    localStorage.setItem('entomate-theme-mode', mode);
  }, [resolvedMode, mode]);

  const setThemeMode = useCallback((newMode) => {
    if (Object.values(THEME_MODES).includes(newMode)) {
      setMode(newMode);
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode(resolvedMode === 'dark' ? 'light' : 'dark');
  }, [resolvedMode]);

  const value = {
    mode,
    resolvedMode,
    isDark: resolvedMode === 'dark',
    isLight: resolvedMode === 'light',
    setThemeMode,
    toggleMode
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

export default ThemeContext;
