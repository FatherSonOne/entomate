import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

// Dev Tool Inspired Theme Variants
export const DESIGN_THEMES = {
  cursor: {
    name: 'Cursor',
    description: 'Modern dev tool with clean blue accents',
    preview: { bg: '#ffffff', text: '#24292f', accent: '#007acc' }
  },
  supabase: {
    name: 'Supabase',
    description: 'Clean SaaS design with green accents',
    preview: { bg: '#ffffff', text: '#0f1419', accent: '#3ecf8e' }
  },
  vscode: {
    name: 'VS Code',
    description: 'Professional dark theme with syntax highlighting',
    preview: { bg: '#1e1e1e', text: '#cccccc', accent: '#007acc' }
  },
  github: {
    name: 'GitHub',
    description: 'Modern web app design',
    preview: { bg: '#ffffff', text: '#24292f', accent: '#0366d6' }
  },
  'dark-pro': {
    name: 'Dark Pro',
    description: 'Modern dark mode for extended coding sessions',
    preview: { bg: '#0f0f23', text: '#ffffff', accent: '#3182ce' }
  }
};

// Legacy accent color palette (for backwards compatibility)
export const HIGHLIGHT_COLORS = {
  green: {
    name: 'Electric Green',
    value: '#3ECF8E',
    rgb: '62, 207, 142'
  },
  blue: {
    name: 'Electric Blue',
    value: '#2563EB',
    rgb: '37, 99, 235'
  },
  purple: {
    name: 'Electric Purple',
    value: '#A855F7',
    rgb: '168, 85, 247'
  },
  cyan: {
    name: 'Cyan',
    value: '#06B6D4',
    rgb: '6, 182, 212'
  },
  pink: {
    name: 'Hot Pink',
    value: '#EC4899',
    rgb: '236, 72, 153'
  },
  orange: {
    name: 'Electric Orange',
    value: '#F97316',
    rgb: '249, 115, 22'
  }
};

export const THEME_MODES = {
  light: 'light',
  dark: 'dark',
  system: 'system'
};

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem('entomate-theme-mode');
    return saved || THEME_MODES.light; // Default to light for better contrast
  });

  const [designTheme, setDesignThemeState] = useState(() => {
    const saved = localStorage.getItem('entomate-design-theme');
    return saved || 'cursor'; // Default to Cursor theme
  });

  const [highlightColor, setHighlightColor] = useState(() => {
    const saved = localStorage.getItem('entomate-highlight-color');
    return saved || 'blue'; // Default to blue for Cursor theme
  });

  const [resolvedMode, setResolvedMode] = useState('light'); // Default to light

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

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;

    // Remove any existing theme data attributes
    Object.keys(DESIGN_THEMES).forEach(themeKey => {
      root.removeAttribute(`data-theme`);
    });

    // Apply design theme
    root.setAttribute('data-theme', designTheme);

    // Apply dark/light mode (legacy support)
    if (resolvedMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Apply highlight color as CSS variables (for legacy components)
    const color = HIGHLIGHT_COLORS[highlightColor] || HIGHLIGHT_COLORS.blue;
    root.style.setProperty('--highlight-color', color.value);
    root.style.setProperty('--highlight-color-rgb', color.rgb);

    // Save to localStorage
    localStorage.setItem('entomate-theme-mode', mode);
    localStorage.setItem('entomate-design-theme', designTheme);
    localStorage.setItem('entomate-highlight-color', highlightColor);
  }, [resolvedMode, highlightColor, mode, designTheme]);

  const setThemeMode = (newMode) => {
    if (Object.values(THEME_MODES).includes(newMode)) {
      setMode(newMode);
    }
  };

  const setAccentColor = (colorKey) => {
    if (HIGHLIGHT_COLORS[colorKey]) {
      setHighlightColor(colorKey);
    }
  };

  const setDesignTheme = (themeKey) => {
    if (DESIGN_THEMES[themeKey]) {
      setDesignThemeState(themeKey);
      // Auto-adjust highlight color based on theme
      const defaultColors = {
        cursor: 'blue',
        supabase: 'green',
        vscode: 'blue',
        github: 'blue',
        'dark-pro': 'blue'
      };
      setHighlightColor(defaultColors[themeKey] || 'blue');
    }
  };

  const toggleMode = () => {
    const newMode = resolvedMode === 'dark' ? 'light' : 'dark';
    setMode(newMode);
  };

  const value = {
    mode,
    resolvedMode,
    designTheme,
    highlightColor,
    highlightColorValue: HIGHLIGHT_COLORS[highlightColor]?.value || HIGHLIGHT_COLORS.blue.value,
    designThemes: DESIGN_THEMES,
    setThemeMode,
    setDesignTheme,
    setAccentColor,
    toggleMode,
    isDark: resolvedMode === 'dark',
    isLight: resolvedMode === 'light'
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
