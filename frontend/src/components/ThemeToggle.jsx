import React, { useState } from 'react';
import { Sun, Moon, Palette, Check, X } from 'lucide-react';
import { useTheme, DESIGN_THEMES } from '../context/ThemeContext';

export default function ThemeToggle({ compact = false }) {
  const { isDark, toggleMode, designTheme, setDesignTheme, designThemes } = useTheme();
  const [showThemeSelector, setShowThemeSelector] = useState(false);

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowThemeSelector(!showThemeSelector)}
          className="btn btn-ghost btn-icon"
          aria-label="Theme selector"
          title="Choose theme"
        >
          <Palette className="w-5 h-5 text-content-secondary" />
        </button>

        {showThemeSelector && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowThemeSelector(false)}
            />
            <div className="absolute right-0 top-full mt-2 w-64 bg-surface border border-line-default rounded-lg shadow-lg z-50">
              <div className="p-3 border-b border-line-default">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-content-primary text-sm">Choose Theme</h3>
                  <button
                    onClick={() => setShowThemeSelector(false)}
                    className="p-1 hover:bg-surface-muted rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-2">
                {Object.entries(designThemes).map(([key, theme]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setDesignTheme(key);
                      setShowThemeSelector(false);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-muted transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <div
                        className="w-4 h-4 rounded-full border-2 border-line-default"
                        style={{
                          backgroundColor: theme.preview.bg,
                          borderColor: theme.preview.accent
                        }}
                      />
                      <div className="text-left">
                        <div className="font-medium text-content-primary text-sm">{theme.name}</div>
                        <div className="text-content-tertiary text-xs">{theme.description}</div>
                      </div>
                    </div>
                    {designTheme === key && (
                      <Check className="w-4 h-4 text-accent-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {/* Theme Selector */}
      <div className="relative">
        <button
          onClick={() => setShowThemeSelector(!showThemeSelector)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-content-secondary bg-surface-muted hover:bg-surface-muted/80 rounded-lg transition-colors"
          title="Choose theme"
        >
          <Palette className="w-4 h-4" />
          <span className="hidden sm:inline">{designThemes[designTheme]?.name || 'Theme'}</span>
        </button>

        {showThemeSelector && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowThemeSelector(false)}
            />
            <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-line-default rounded-lg shadow-lg z-50">
              <div className="p-4 border-b border-line-default">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-content-primary">Choose Theme</h3>
                  <button
                    onClick={() => setShowThemeSelector(false)}
                    className="p-1 hover:bg-surface-muted rounded"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-content-tertiary text-sm mt-1">Select a design inspired by popular developer tools</p>
              </div>
              <div className="p-3 grid grid-cols-1 gap-2">
                {Object.entries(designThemes).map(([key, theme]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setDesignTheme(key);
                      setShowThemeSelector(false);
                    }}
                    className={`flex items-center gap-4 p-3 rounded-lg border transition-all ${
                      designTheme === key
                        ? 'border-accent-primary bg-accent-primary-dim'
                        : 'border-line-default hover:border-line-strong hover:bg-surface-muted'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className="w-5 h-5 rounded-full border-2"
                        style={{
                          backgroundColor: theme.preview.bg,
                          borderColor: theme.preview.accent
                        }}
                      />
                      <div className="text-left">
                        <div className="font-medium text-content-primary">{theme.name}</div>
                        <div className="text-content-tertiary text-sm">{theme.description}</div>
                      </div>
                    </div>
                    {designTheme === key && (
                      <Check className="w-5 h-5 text-accent-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Light/Dark Toggle */}
      <div className="flex items-center gap-3">
        <Sun className={`w-4 h-4 ${!isDark ? 'text-accent-primary' : 'text-content-tertiary'}`} />
        <button
          onClick={toggleMode}
          className={`theme-toggle ${isDark ? 'dark' : 'light'}`}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className="theme-toggle-knob">
            {isDark ? (
              <Moon className="w-3.5 h-3.5 text-content-secondary" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-yellow-500" />
            )}
          </span>
        </button>
        <Moon className={`w-4 h-4 ${isDark ? 'text-accent-primary' : 'text-content-tertiary'}`} />
      </div>
    </div>
  );
}
