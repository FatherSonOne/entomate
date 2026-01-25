import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

// Brand Theme System - 10 Distinct Brand Directions
export const BRAND_THEMES = {
  // Technical/Futuristic Category
  synapse: {
    name: 'Synapse',
    description: 'AI/Neuroscience-inspired with electric purple accents',
    category: 'Technical/Futuristic',
    personality: 'Technical, Cutting-Edge, Science-Forward',
    preview: {
      bg: '#0F0A1F',
      text: '#F8FAFC',
      accent: '#8B5CF6',
      secondary: '#06B6D4',
      tertiary: '#EC4899'
    },
    fonts: {
      display: 'Orbitron',
      heading: 'Exo 2',
      body: 'IBM Plex Sans',
      mono: 'IBM Plex Mono'
    },
    radius: '12px',
    visualElements: 'Neural network backgrounds, glow effects, hexagonal grid'
  },
  velocity: {
    name: 'Velocity',
    description: 'Speed/Performance-focused with racing red and motion design',
    category: 'Technical/Futuristic',
    personality: 'Dynamic, Fast, High-Performance',
    preview: {
      bg: '#0A0A0A',
      text: '#F5F5F5',
      accent: '#EF4444',
      secondary: '#FBBF24',
      tertiary: '#94A3B8'
    },
    fonts: {
      display: 'Bebas Neue',
      heading: 'Rajdhani',
      body: 'Rubik',
      mono: 'Roboto Mono'
    },
    radius: '8px',
    visualElements: 'Diagonal slashes, motion lines, directional shadows'
  },
  'neon-district': {
    name: 'Neon District',
    description: 'Cyberpunk/Edgy with neon magenta and electric cyan',
    category: 'Technical/Futuristic',
    personality: 'Bold, Disruptive, Counterculture',
    preview: {
      bg: '#0A0014',
      text: '#F0F0FF',
      accent: '#FF00FF',
      secondary: '#00FFFF',
      tertiary: '#00FF41'
    },
    fonts: {
      display: 'Black Ops One',
      heading: 'Teko',
      body: 'Saira',
      mono: 'Space Mono'
    },
    radius: '0px',
    visualElements: 'Glitch effects, neon glow, circuit board patterns'
  },

  // Professional/Enterprise Category
  blueprint: {
    name: 'Blueprint',
    description: 'Architectural/Engineering with blueprint blue precision',
    category: 'Professional/Enterprise',
    personality: 'Professional, Structured, Precision-Focused',
    preview: {
      bg: '#F8FAFC',
      text: '#1E293B',
      accent: '#1E40AF',
      secondary: '#64748B',
      tertiary: '#F97316'
    },
    fonts: {
      display: 'Chakra Petch',
      heading: 'Work Sans',
      body: 'Source Sans 3',
      mono: 'Source Code Pro'
    },
    radius: '4px',
    visualElements: 'Grid overlay, hard shadows, graph paper background'
  },
  'serif-scholar': {
    name: 'Serif Scholar',
    description: 'Traditional/Trustworthy with Oxford blue and serif typography',
    category: 'Professional/Enterprise',
    personality: 'Established, Credible, Wisdom-Driven',
    preview: {
      bg: '#FFFEF9',
      text: '#1E1B29',
      accent: '#1E3A8A',
      secondary: '#991B1B',
      tertiary: '#065F46'
    },
    fonts: {
      display: 'Playfair Display',
      heading: 'Merriweather',
      body: 'Lora',
      mono: 'Courier Prime'
    },
    radius: '6px',
    visualElements: 'Paper texture, decorative corners, damask watermark'
  },
  aurora: {
    name: 'Aurora',
    description: 'Premium/Luxury with royal purple and rose gold',
    category: 'Professional/Enterprise',
    personality: 'Sophisticated, High-End, Exclusive',
    preview: {
      bg: '#0F0A1A',
      text: '#F5F0FF',
      accent: '#6D28D9',
      secondary: '#F59E93',
      tertiary: '#D4AF37'
    },
    fonts: {
      display: 'Cormorant Garamond',
      heading: 'Cinzel',
      body: 'Crimson Pro',
      mono: 'Space Mono'
    },
    radius: '12px',
    visualElements: 'Metallic gradients, gold borders, art deco patterns'
  },
  monolith: {
    name: 'Monolith',
    description: 'Brutalist/Minimalist with pure black/white contrast',
    category: 'Professional/Enterprise',
    personality: 'No-Nonsense, Stripped-Down, Ultra-Focused',
    preview: {
      bg: '#000000',
      text: '#FFFFFF',
      accent: '#FF0000',
      secondary: '#808080',
      tertiary: '#FFFFFF'
    },
    fonts: {
      display: 'Space Mono',
      heading: 'Archivo Black',
      body: 'DM Sans',
      mono: 'Space Mono'
    },
    radius: '0px',
    visualElements: 'High contrast, hard shadows, instant transitions'
  },

  // Creative/Playful Category
  horizon: {
    name: 'Horizon',
    description: 'Aspirational/Progressive with sunrise gold and sky blue',
    category: 'Creative/Playful',
    personality: 'Optimistic, Growth-Oriented, Forward-Thinking',
    preview: {
      bg: '#FFFBF0',
      text: '#78350F',
      accent: '#F59E0B',
      secondary: '#0EA5E9',
      tertiary: '#FB7185'
    },
    fonts: {
      display: 'Sora',
      heading: 'Plus Jakarta Sans',
      body: 'Inter',
      mono: 'JetBrains Mono'
    },
    radius: '16px',
    visualElements: 'Gradient backgrounds, multi-layer shadows, horizontal bands'
  },
  'pastel-zen': {
    name: 'Pastel Zen',
    description: 'Calm/Wellness-focused with sage green and lavender',
    category: 'Creative/Playful',
    personality: 'Mindful, Balanced, Human-Centered',
    preview: {
      bg: '#FAFAF9',
      text: '#44403C',
      accent: '#A7C4A0',
      secondary: '#C4B5FD',
      tertiary: '#FDBA74'
    },
    fonts: {
      display: 'Comfortaa',
      heading: 'Nunito',
      body: 'Quicksand',
      mono: 'Inconsolata'
    },
    radius: '24px',
    visualElements: 'Soft gradients, subtle shadows, organic shapes'
  },
  playground: {
    name: 'Playground',
    description: 'Playful/Creative with bubblegum pink and lime green',
    category: 'Creative/Playful',
    personality: 'Fun, Innovative, Experimental',
    preview: {
      bg: '#FEFEFE',
      text: '#1E1B4B',
      accent: '#F472B6',
      secondary: '#84CC16',
      tertiary: '#3B82F6'
    },
    fonts: {
      display: 'Fredoka',
      heading: 'Poppins',
      body: 'Karla',
      mono: 'Fira Mono'
    },
    radius: '20px',
    visualElements: 'Bright colors, colorful shadows, bounce animations'
  }
};

// Legacy theme mapping for backward compatibility
export const DESIGN_THEMES = {
  cursor: BRAND_THEMES.blueprint,
  supabase: BRAND_THEMES.horizon,
  vscode: BRAND_THEMES.monolith,
  github: BRAND_THEMES['serif-scholar'],
  'dark-pro': BRAND_THEMES.velocity
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

  // Brand theme state (migrated from designTheme)
  const [brandTheme, setBrandThemeState] = useState(() => {
    const saved = localStorage.getItem('entomate-brand-theme');
    // Migrate old design themes to new brand themes
    if (!saved) {
      const oldDesignTheme = localStorage.getItem('entomate-design-theme');
      if (oldDesignTheme && DESIGN_THEMES[oldDesignTheme]) {
        return Object.keys(BRAND_THEMES).find(
          key => BRAND_THEMES[key] === DESIGN_THEMES[oldDesignTheme]
        ) || 'synapse';
      }
    }
    return saved || 'synapse'; // Default to Synapse theme
  });

  // Preview state management
  const [previewTheme, setPreviewTheme] = useState(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewTimeout, setPreviewTimeout] = useState(null);

  const [highlightColor, setHighlightColor] = useState(() => {
    const saved = localStorage.getItem('entomate-highlight-color');
    return saved || 'blue'; // Default to blue for legacy support
  });

  const [resolvedMode, setResolvedMode] = useState('light'); // Default to light

  // Active theme (either preview or permanent)
  const activeTheme = isPreviewMode && previewTheme ? previewTheme : brandTheme;

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

    // Remove old data-theme attribute (legacy)
    root.removeAttribute('data-theme');

    // Apply brand theme
    root.setAttribute('data-brand', activeTheme);
    console.log('[ThemeContext] Applied brand:', activeTheme, 'isPreviewMode:', isPreviewMode);

    // Apply dark/light mode
    if (resolvedMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    console.log('[ThemeContext] Mode:', resolvedMode);

    // Apply highlight color as CSS variables (for legacy components)
    const color = HIGHLIGHT_COLORS[highlightColor] || HIGHLIGHT_COLORS.blue;
    root.style.setProperty('--highlight-color', color.value);
    root.style.setProperty('--highlight-color-rgb', color.rgb);

    // Load fonts for active theme (lazy loading for performance)
    if (BRAND_THEMES[activeTheme]) {
      const fonts = BRAND_THEMES[activeTheme].fonts;
      document.fonts.load(`12px "${fonts.display}"`);
      document.fonts.load(`12px "${fonts.heading}"`);
      document.fonts.load(`12px "${fonts.body}"`);
      document.fonts.load(`12px "${fonts.mono}"`);
    }

    // Save to localStorage (only if not in preview mode)
    if (!isPreviewMode) {
      localStorage.setItem('entomate-theme-mode', mode);
      localStorage.setItem('entomate-brand-theme', brandTheme);
      localStorage.setItem('entomate-highlight-color', highlightColor);
    }
  }, [resolvedMode, highlightColor, mode, brandTheme, activeTheme, isPreviewMode]);

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

  const setBrandTheme = (themeKey) => {
    console.log('[ThemeContext] setBrandTheme called:', themeKey);
    if (BRAND_THEMES[themeKey]) {
      setBrandThemeState(themeKey);
      console.log('[ThemeContext] Brand theme set to:', themeKey);
      // Exit preview mode when permanently setting theme
      cancelPreview();
    } else {
      console.error('[ThemeContext] Invalid theme key:', themeKey);
    }
  };

  // Legacy support for old designTheme setter
  const setDesignTheme = (themeKey) => {
    // Map old theme keys to new brand themes
    if (DESIGN_THEMES[themeKey]) {
      const mappedTheme = Object.keys(BRAND_THEMES).find(
        key => BRAND_THEMES[key] === DESIGN_THEMES[themeKey]
      );
      if (mappedTheme) {
        setBrandTheme(mappedTheme);
      }
    } else if (BRAND_THEMES[themeKey]) {
      setBrandTheme(themeKey);
    }
  };

  const toggleMode = () => {
    const newMode = resolvedMode === 'dark' ? 'light' : 'dark';
    setMode(newMode);
  };

  // Preview management functions
  const enablePreview = (themeKey, duration = 60000) => { // 60 second default
    console.log('[ThemeContext] enablePreview called:', themeKey);
    if (BRAND_THEMES[themeKey]) {
      // Clear any existing timeout
      if (previewTimeout) {
        clearTimeout(previewTimeout);
      }

      setPreviewTheme(themeKey);
      setIsPreviewMode(true);
      console.log('[ThemeContext] Preview enabled for:', themeKey);

      // Auto-cancel preview after duration
      const timeout = setTimeout(() => {
        console.log('[ThemeContext] Preview timeout - canceling');
        cancelPreview();
      }, duration);
      setPreviewTimeout(timeout);
    } else {
      console.error('[ThemeContext] Invalid theme key:', themeKey);
    }
  };

  const confirmPreview = () => {
    if (isPreviewMode && previewTheme) {
      setBrandThemeState(previewTheme);
      setIsPreviewMode(false);
      setPreviewTheme(null);
      if (previewTimeout) {
        clearTimeout(previewTimeout);
        setPreviewTimeout(null);
      }
    }
  };

  const cancelPreview = () => {
    setIsPreviewMode(false);
    setPreviewTheme(null);
    if (previewTimeout) {
      clearTimeout(previewTimeout);
      setPreviewTimeout(null);
    }
  };

  const value = {
    // Mode state
    mode,
    resolvedMode,
    isDark: resolvedMode === 'dark',
    isLight: resolvedMode === 'light',

    // Brand theme state
    brandTheme,
    activeTheme,
    currentBrand: BRAND_THEMES[activeTheme],
    brandThemes: BRAND_THEMES,

    // Preview state
    isPreviewMode,
    previewTheme,

    // Legacy support
    designTheme: brandTheme,
    designThemes: DESIGN_THEMES,
    highlightColor,
    highlightColorValue: HIGHLIGHT_COLORS[highlightColor]?.value || HIGHLIGHT_COLORS.blue.value,

    // Theme setters
    setThemeMode,
    setBrandTheme,
    setDesignTheme, // Legacy support
    setAccentColor,
    toggleMode,

    // Preview management
    enablePreview,
    confirmPreview,
    cancelPreview
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
