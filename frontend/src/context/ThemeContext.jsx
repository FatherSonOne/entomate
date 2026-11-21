import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

export const THEME_MODES = {
  light: 'light',
  dark: 'dark',
  system: 'system'
};

/* ── Held Light foundation flag ──
   The redesigned surface treatment ("held-light") lives behind an
   <html data-foundation> attribute so legacy and new CSS coexist and
   flip atomically. Default is ON as of the Phase 10 flip (2026-07-04).
   Force it off without touching this default via the console:
     localStorage.setItem('entomate-foundation', 'off');        // force off
     localStorage.setItem('entomate-foundation', 'held-light'); // force on
     localStorage.removeItem('entomate-foundation');            // use default
   `data-foundation` is deliberately separate from `theme_mode` — do
   not overload the DB theme setting with it. */
export const FOUNDATION = 'held-light';
const FOUNDATION_DEFAULT = FOUNDATION; // Phase 10: Held Light is now the default

function resolveFoundation() {
  const override = typeof localStorage !== 'undefined'
    ? localStorage.getItem('entomate-foundation')
    : null;
  if (override === 'off') return null;
  if (override === FOUNDATION) return FOUNDATION;
  return FOUNDATION_DEFAULT;
}

/* ── Design styles (2026-11-21) ──
   Each style is a CSS layer on top of the foundation, scoped under
   <html data-style="...">. Orbital is the default. "classic" writes no
   attribute and shows the Held Light foundation on its own. The choice
   is per browser (localStorage), like the theme mode fallback.
     localStorage.setItem('entomate-style', 'folio');  // pick one
     localStorage.removeItem('entomate-style');       // back to default */
export const DESIGN_STYLES = [
  { id: 'orbital', label: 'Orbital', blurb: 'Dark instrument from the Relay Orbits mark. Teal and crimson, rounded panels.' },
  { id: 'folio', label: 'Folio', blurb: 'Warm editorial paper. Serif headings, quiet margins.' },
  { id: 'bench', label: 'Bench', blurb: 'Tactile hardware. Raised modules, keys and status lights.' },
  { id: 'minutes', label: 'Minutes', blurb: 'Swiss information design. Hairline rules and square corners.' },
  { id: 'classic', label: 'Classic', blurb: 'The previous Held Light look, with soft crimson panels.' },
];
export const DEFAULT_DESIGN_STYLE = 'orbital';
const STYLE_KEY = 'entomate-style';
const STYLE_IDS = DESIGN_STYLES.map((s) => s.id);

function resolveDesignStyle() {
  if (typeof localStorage === 'undefined') return DEFAULT_DESIGN_STYLE;
  const saved = localStorage.getItem(STYLE_KEY);
  return STYLE_IDS.includes(saved) ? saved : DEFAULT_DESIGN_STYLE;
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    return localStorage.getItem('entomate-theme-mode') || THEME_MODES.dark;
  });

  const [resolvedMode, setResolvedMode] = useState('dark');
  const [dbLoaded, setDbLoaded] = useState(false);
  const [foundation, setFoundation] = useState(resolveFoundation);
  const [designStyle, setDesignStyle] = useState(resolveDesignStyle);

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

    // Held Light foundation flag (default OFF; see resolveFoundation)
    if (foundation) {
      root.setAttribute('data-foundation', foundation);
    } else {
      root.removeAttribute('data-foundation');
    }

    if (designStyle && designStyle !== 'classic') {
      root.setAttribute('data-style', designStyle);
    } else {
      root.removeAttribute('data-style');
    }

    localStorage.setItem('entomate-theme-mode', mode);
  }, [resolvedMode, mode, foundation, designStyle]);

  const chooseDesignStyle = useCallback((id) => {
    if (!STYLE_IDS.includes(id)) return;
    localStorage.setItem(STYLE_KEY, id);
    setDesignStyle(id);
  }, []);

  const toggleFoundation = useCallback(() => {
    setFoundation((prev) => {
      const next = prev ? null : FOUNDATION;
      localStorage.setItem('entomate-foundation', next || 'off');
      return next;
    });
  }, []);

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
    toggleMode,
    foundation,
    isHeldLight: foundation === FOUNDATION,
    toggleFoundation,
    designStyle,
    designStyles: DESIGN_STYLES,
    setDesignStyle: chooseDesignStyle
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
