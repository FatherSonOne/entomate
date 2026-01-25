import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { X, Check, Eye, EyeOff, Sun, Moon, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

export default function BrandExplorer({ isOpen, onClose }) {
  const {
    brandThemes,
    activeTheme,
    setBrandTheme,
    enablePreview,
    confirmPreview,
    cancelPreview,
    isPreviewMode,
    previewTheme,
    resolvedMode,
    toggleMode
  } = useTheme();

  const [selectedBrand, setSelectedBrand] = useState(activeTheme);
  const [expandedBrand, setExpandedBrand] = useState(null);
  const [tryLiveCountdown, setTryLiveCountdown] = useState(null);

  // Group brands by category
  const brandsByCategory = Object.entries(brandThemes).reduce((acc, [key, brand]) => {
    const category = brand.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push({ key, ...brand });
    return acc;
  }, {});

  const categories = [
    'Technical/Futuristic',
    'Professional/Enterprise',
    'Creative/Playful'
  ];

  // Handle Try Live mode countdown
  useEffect(() => {
    if (isPreviewMode && tryLiveCountdown !== null) {
      if (tryLiveCountdown <= 0) {
        handleCancelPreview();
        return;
      }

      const timer = setTimeout(() => {
        setTryLiveCountdown(tryLiveCountdown - 1);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isPreviewMode, tryLiveCountdown]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setExpandedBrand(null);
      setTryLiveCountdown(null);
      if (isPreviewMode) {
        handleCancelPreview();
      }
    }
  }, [isOpen]);

  const handleBrandClick = (brandKey) => {
    setSelectedBrand(brandKey);
    setExpandedBrand(brandKey);
  };

  const handleApplyBrand = () => {
    if (isPreviewMode) {
      confirmPreview();
    } else {
      setBrandTheme(selectedBrand);
    }
    setTryLiveCountdown(null);
    onClose();
  };

  const handleTryLive = () => {
    console.log('[BrandExplorer] Try Live clicked for:', selectedBrand);
    enablePreview(selectedBrand, 60000); // 60 seconds
    setTryLiveCountdown(60);

    // Debug: Check what's actually applied
    setTimeout(() => {
      const root = document.documentElement;
      const brand = root.getAttribute('data-brand');
      const mode = root.classList.contains('dark') ? 'dark' : 'light';
      const bgBase = getComputedStyle(root).getPropertyValue('--bg-base');
      console.log('[BrandExplorer] After Try Live - data-brand:', brand, 'mode:', mode, '--bg-base:', bgBase);
    }, 100);
  };

  const handleCancelPreview = () => {
    cancelPreview();
    setTryLiveCountdown(null);
    setSelectedBrand(activeTheme);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (isPreviewMode) {
        handleCancelPreview();
      } else {
        onClose();
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isPreviewMode]);

  if (!isOpen) return null;

  const currentBrand = brandThemes[selectedBrand];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-backdrop-fade"
        onClick={isPreviewMode ? handleCancelPreview : onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-7xl h-[90vh] mx-4 bg-surface-elevated rounded-[var(--radius-xl,24px)] shadow-elevated overflow-hidden animate-modal-enter flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-line-default bg-surface-base">
          <div>
            <h2 className="text-2xl font-brand-display font-bold text-content-primary flex items-center gap-3">
              <Sparkles className="w-7 h-7 text-accent-primary" />
              Brand Explorer
            </h2>
            <p className="text-sm text-content-secondary mt-1">
              Choose your brand identity from 10 distinct design directions
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Try Live Mode Indicator */}
            {isPreviewMode && tryLiveCountdown !== null && (
              <div className="flex items-center gap-2 px-4 py-2 bg-accent-primary-dim rounded-[var(--radius-md,12px)] border border-accent-primary">
                <Eye className="w-4 h-4 text-accent-primary" />
                <span className="text-sm font-medium text-accent-primary">
                  Live Preview: {tryLiveCountdown}s
                </span>
              </div>
            )}

            {/* Light/Dark Toggle */}
            <button
              onClick={toggleMode}
              className="p-2 rounded-[var(--radius-md,12px)] bg-surface-muted hover:bg-surface-subtle transition-colors"
              title="Toggle light/dark mode"
            >
              {resolvedMode === 'dark' ? (
                <Sun className="w-5 h-5 text-content-secondary" />
              ) : (
                <Moon className="w-5 h-5 text-content-secondary" />
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={isPreviewMode ? handleCancelPreview : onClose}
              className="p-2 rounded-[var(--radius-md,12px)] bg-surface-muted hover:bg-surface-subtle transition-colors"
            >
              <X className="w-5 h-5 text-content-secondary" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Sidebar - Brand List */}
          <div className="w-80 border-r border-line-default bg-surface-base overflow-y-auto">
            {categories.map(category => (
              <div key={category} className="p-4">
                <h3 className="text-xs font-semibold text-content-tertiary uppercase tracking-wider mb-3">
                  {category}
                </h3>
                <div className="space-y-2">
                  {brandsByCategory[category]?.map(brand => (
                    <button
                      key={brand.key}
                      onClick={() => handleBrandClick(brand.key)}
                      className={`
                        w-full text-left p-4 rounded-[var(--radius-md,12px)] transition-all
                        ${selectedBrand === brand.key
                          ? 'bg-accent-primary-dim border border-accent-primary shadow-highlight'
                          : 'bg-surface-subtle hover:bg-surface-muted border border-line-subtle'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-bold font-brand-heading ${
                          selectedBrand === brand.key ? 'text-accent-primary' : 'text-content-primary'
                        }`}>
                          {brand.name}
                        </span>
                        {activeTheme === brand.key && (
                          <Check className="w-4 h-4 text-semantic-success" />
                        )}
                      </div>
                      <p className="text-xs text-content-secondary line-clamp-2">
                        {brand.description}
                      </p>

                      {/* Color Preview */}
                      <div className="flex gap-1 mt-3">
                        <div
                          className="w-6 h-6 rounded-full border border-line-subtle"
                          style={{ backgroundColor: brand.preview.accent }}
                        />
                        <div
                          className="w-6 h-6 rounded-full border border-line-subtle"
                          style={{ backgroundColor: brand.preview.secondary }}
                        />
                        <div
                          className="w-6 h-6 rounded-full border border-line-subtle"
                          style={{ backgroundColor: brand.preview.tertiary }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Right Panel - Preview & Details */}
          <div className="flex-1 overflow-y-auto bg-surface-base">
            {currentBrand && (
              <div className="p-8">
                {/* Brand Header */}
                <div className="mb-8">
                  <h3 className="text-4xl font-brand-display font-bold text-content-primary mb-2">
                    {currentBrand.name}
                  </h3>
                  <p className="text-lg text-content-secondary mb-4">
                    {currentBrand.description}
                  </p>
                  <div className="flex gap-3">
                    <span className="px-3 py-1 bg-accent-primary-dim text-accent-primary text-sm font-medium rounded-full">
                      {currentBrand.category}
                    </span>
                    <span className="px-3 py-1 bg-surface-muted text-content-secondary text-sm rounded-full">
                      {currentBrand.personality}
                    </span>
                  </div>
                </div>

                {/* Typography Preview */}
                <div className="mb-8 p-6 bg-surface-subtle rounded-[var(--radius-lg,20px)] border border-line-subtle">
                  <h4 className="text-sm font-semibold text-content-tertiary uppercase tracking-wider mb-4">
                    Typography System
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <span className="text-xs text-content-muted">Display Font</span>
                      <p style={{ fontFamily: currentBrand.fonts.display }} className="text-3xl font-bold text-content-primary">
                        {currentBrand.fonts.display}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-content-muted">Heading Font</span>
                      <p style={{ fontFamily: currentBrand.fonts.heading }} className="text-2xl font-semibold text-content-primary">
                        {currentBrand.fonts.heading}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-content-muted">Body Font</span>
                      <p style={{ fontFamily: currentBrand.fonts.body }} className="text-base text-content-primary">
                        {currentBrand.fonts.body} - The quick brown fox jumps over the lazy dog
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-content-muted">Monospace Font</span>
                      <p style={{ fontFamily: currentBrand.fonts.mono }} className="text-sm text-content-primary">
                        {currentBrand.fonts.mono} - const theme = "awesome";
                      </p>
                    </div>
                  </div>
                </div>

                {/* Color Palette */}
                <div className="mb-8 p-6 bg-surface-subtle rounded-[var(--radius-lg,20px)] border border-line-subtle">
                  <h4 className="text-sm font-semibold text-content-tertiary uppercase tracking-wider mb-4">
                    Color Palette
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    {Object.entries(currentBrand.preview).map(([name, color]) => (
                      <div key={name}>
                        <div
                          className="h-20 rounded-[var(--radius-md,12px)] border border-line-subtle mb-2"
                          style={{ backgroundColor: color }}
                        />
                        <p className="text-xs font-medium text-content-primary capitalize">{name}</p>
                        <p className="text-xs text-content-muted font-mono">{color}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Visual Elements */}
                <div className="mb-8 p-6 bg-surface-subtle rounded-[var(--radius-lg,20px)] border border-line-subtle">
                  <h4 className="text-sm font-semibold text-content-tertiary uppercase tracking-wider mb-4">
                    Visual Elements
                  </h4>
                  <p className="text-sm text-content-secondary">{currentBrand.visualElements}</p>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-content-muted">Border Radius</span>
                      <p className="text-sm font-medium text-content-primary">{currentBrand.radius}</p>
                    </div>
                  </div>
                </div>

                {/* Component Preview */}
                <div className="p-6 bg-surface-subtle rounded-[var(--radius-lg,20px)] border border-line-subtle">
                  <h4 className="text-sm font-semibold text-content-tertiary uppercase tracking-wider mb-4">
                    Component Preview
                  </h4>
                  <div className="space-y-4">
                    {/* Button Examples */}
                    <div className="flex gap-3 flex-wrap">
                      <button className="px-4 py-2 bg-accent-primary text-white rounded-[var(--radius-md,12px)] font-medium hover:opacity-90 transition-opacity">
                        Primary Button
                      </button>
                      <button className="px-4 py-2 bg-surface-elevated border border-line-default text-content-primary rounded-[var(--radius-md,12px)] font-medium hover:bg-surface-muted transition-colors">
                        Secondary Button
                      </button>
                      <button className="px-4 py-2 bg-semantic-success text-white rounded-[var(--radius-md,12px)] font-medium hover:opacity-90 transition-opacity">
                        Success Button
                      </button>
                    </div>

                    {/* Input Example */}
                    <input
                      type="text"
                      placeholder="Input field example..."
                      className="w-full px-4 py-2 bg-surface-elevated border border-line-default rounded-[var(--radius-md,12px)] text-content-primary placeholder-content-muted focus:border-accent-primary focus:ring-2 focus:ring-accent-primary-dim outline-none transition-all"
                    />

                    {/* Card Example */}
                    <div className="p-4 bg-surface-elevated rounded-[var(--radius-lg,20px)] border border-line-default">
                      <h5 className="font-brand-heading font-semibold text-content-primary mb-2">Card Component</h5>
                      <p className="text-sm text-content-secondary">
                        This is how a typical card component would look with the selected brand theme.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-8 py-6 border-t border-line-default bg-surface-base flex items-center justify-between">
          <div>
            {isPreviewMode ? (
              <p className="text-sm text-content-secondary">
                Preview active • Changes will revert in {tryLiveCountdown}s unless confirmed
              </p>
            ) : (
              <p className="text-sm text-content-secondary">
                {selectedBrand === activeTheme
                  ? 'Currently active theme'
                  : 'Preview this theme across your entire app'
                }
              </p>
            )}
          </div>

          <div className="flex gap-3">
            {isPreviewMode ? (
              <>
                <button
                  onClick={handleCancelPreview}
                  className="px-6 py-3 bg-surface-elevated border border-line-default text-content-primary rounded-[var(--radius-md,12px)] font-medium hover:bg-surface-muted transition-colors"
                >
                  Cancel Preview
                </button>
                <button
                  onClick={handleApplyBrand}
                  className="px-6 py-3 bg-accent-primary text-white rounded-[var(--radius-md,12px)] font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  Confirm & Apply
                </button>
              </>
            ) : (
              <>
                {selectedBrand !== activeTheme && (
                  <button
                    onClick={handleTryLive}
                    className="px-6 py-3 bg-surface-elevated border border-accent-primary text-accent-primary rounded-[var(--radius-md,12px)] font-medium hover:bg-accent-primary-dim transition-colors flex items-center gap-2"
                  >
                    <Eye className="w-5 h-5" />
                    Try Live (60s)
                  </button>
                )}
                <button
                  onClick={handleApplyBrand}
                  className="px-6 py-3 bg-accent-primary text-white rounded-[var(--radius-md,12px)] font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  {selectedBrand === activeTheme ? 'Close' : 'Apply Brand'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
