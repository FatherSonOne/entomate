import React, { useState } from 'react';
import { Sun, Moon, Palette, Check, X, Sparkles } from 'lucide-react';
import { useTheme, DESIGN_THEMES } from '../context/ThemeContext';
import BrandExplorer from './settings/BrandExplorer';

export default function ThemeToggle({ compact = false }) {
  const { isDark, toggleMode, designTheme, brandTheme, currentBrand, setDesignTheme, designThemes } = useTheme();
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [showBrandExplorer, setShowBrandExplorer] = useState(false);

  if (compact) {
    return (
      <>
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
                    <h3 className="font-semibold text-content-primary text-sm">Quick Themes</h3>
                    <button
                      onClick={() => setShowThemeSelector(false)}
                      className="p-1 hover:bg-surface-muted rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="p-2">
                  {Object.entries(designThemes).slice(0, 5).map(([key, theme]) => (
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
                          <div className="text-content-tertiary text-xs line-clamp-1">{theme.description}</div>
                        </div>
                      </div>
                      {designTheme === key && (
                        <Check className="w-4 h-4 text-accent-primary" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="p-2 border-t border-line-default">
                  <button
                    onClick={() => {
                      setShowThemeSelector(false);
                      setShowBrandExplorer(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-accent-primary-dim text-accent-primary hover:bg-accent-primary hover:text-white transition-colors font-medium"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Explore All 10 Brands</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <BrandExplorer isOpen={showBrandExplorer} onClose={() => setShowBrandExplorer(false)} />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-4">
        {/* Brand Explorer Button */}
        <button
          onClick={() => setShowBrandExplorer(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-accent-primary-dim text-accent-primary hover:bg-accent-primary hover:text-white rounded-lg transition-colors font-medium"
          title="Explore all brand themes"
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:inline">{currentBrand?.name || 'Brand'}</span>
          <span className="sm:hidden">Theme</span>
        </button>

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

      <BrandExplorer isOpen={showBrandExplorer} onClose={() => setShowBrandExplorer(false)} />
    </>
  );
}
