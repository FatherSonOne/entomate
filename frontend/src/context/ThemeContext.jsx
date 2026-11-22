import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';

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
   <html data-style="...">. Bench Swiss is the default (approved
   2026-11-21) and is the only style with its own shell (see Layout).
   "classic" writes no attribute and shows the Held Light foundation on
   its own. The choice is per browser (localStorage), like the theme
   mode fallback.
     localStorage.setItem('entomate-style', 'folio');  // pick one
     localStorage.removeItem('entomate-style');       // back to default */
export const DESIGN_STYLES = [
  { id: 'bench-swiss', label: 'Bench Swiss', blurb: 'The main system. A ruled faceplate, keys, LEDs and a patch-panel rail.' },
  { id: 'orbital', label: 'Orbital', blurb: 'Dark instrument from the Relay Orbits mark. Teal and crimson, rounded panels.' },
  { id: 'folio', label: 'Folio', blurb: 'Warm editorial paper. Serif headings, quiet margins.' },
  { id: 'bench', label: 'Bench', blurb: 'Tactile hardware. Raised modules, keys and status lights.' },
  { id: 'minutes', label: 'Minutes', blurb: 'Swiss information design. Hairline rules and square corners.' },
  { id: 'classic', label: 'Classic', blurb: 'The previous Held Light look, with soft crimson panels.' },
];
export const DEFAULT_DESIGN_STYLE = 'bench-swiss';
const STYLE_KEY = 'entomate-style';
const STYLE_IDS = DESIGN_STYLES.map((s) => s.id);

/* ── Bench Swiss palette ──
   Draft 1 Neutral is current; Void Crimson is the alternative. Written
   as <html data-palette="void-crimson"> only when the alternative is on. */
export const BENCH_PALETTES = [
  { id: 'neutral', label: 'Neutral' },
  { id: 'void-crimson', label: 'Void Crimson' },
];
const PALETTE_KEY = 'entomate-palette';
const PALETTE_IDS = BENCH_PALETTES.map((p) => p.id);

function resolvePalette() {
  if (typeof localStorage === 'undefined') return 'neutral';
  const saved = localStorage.getItem(PALETTE_KEY);
  return PALETTE_IDS.includes(saved) ? saved : 'neutral';
}

// Bumped when the default style changes, so a pick made while trying the
// earlier styles doesn't hide the new default. Rev 2 = Bench Swiss.
const STYLE_REV_KEY = 'entomate-style-rev';
const STYLE_REV = '2';

function resolveDesignStyle() {
  if (typeof localStorage === 'undefined') return DEFAULT_DESIGN_STYLE;
  if (localStorage.getItem(STYLE_REV_KEY) !== STYLE_REV) {
    localStorage.removeItem(STYLE_KEY);
    localStorage.setItem(STYLE_REV_KEY, STYLE_REV);
  }
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
  const [palette, setPaletteState] = useState(resolvePalette);

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

    if (palette === 'void-crimson') {
      root.setAttribute('data-palette', palette);
    } else {
      root.removeAttribute('data-palette');
    }

    localStorage.setItem('entomate-theme-mode', mode);
  }, [resolvedMode, mode, foundation, designStyle, palette]);

  const choosePalette = useCallback((id) => {
    if (!PALETTE_IDS.includes(id)) return;
    localStorage.setItem(PALETTE_KEY, id);
    setPaletteState(id);
  }, []);

  // Crossfades between styles with the View Transitions API where it exists.
  // Skipped for reduced motion (OS setting, or { animate: false } from the app setting).
  const chooseDesignStyle = useCallback((id, { animate = true } = {}) => {
    if (!STYLE_IDS.includes(id)) return;
    localStorage.setItem(STYLE_KEY, id);
    const reduced = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (animate && !reduced && typeof document !== 'undefined' && document.startViewTransition) {
      document.documentElement.classList.add('style-switching');
      const transition = document.startViewTransition(() => {
        flushSync(() => setDesignStyle(id));
      });
      transition.finished.finally(() => document.documentElement.classList.remove('style-switching'));
      return;
    }
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
    setDesignStyle: chooseDesignStyle,
    isBenchSwiss: designStyle === 'bench-swiss',
    palette,
    palettes: BENCH_PALETTES,
    setPalette: choosePalette
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
