/**
 * Settings › You › Appearance
 *
 * Extracted verbatim from pages/Settings.jsx when Settings became one page
 * (Ledger, 2026-11-22). Owned by the Appearance / logo-system pass: theme,
 * Reduce motion, design style (Bench Swiss up front, the rest behind
 * "+ More styles"), the Bench Swiss palette, and the logo system picker.
 *
 * Switching to or from Bench Swiss swaps the app shell, which remounts Settings.
 * chooseStyle() leaves STYLE_SCROLL_KEY in sessionStorage; Settings reads it on
 * mount and scrolls [data-style-picker] back into view.
 */
import React, { useState } from 'react'
import { useTheme, THEME_MODES, DEFAULT_DESIGN_STYLE } from '../../context/ThemeContext'
import LogoSystemPicker from './LogoSystemPicker'
import { Section, Switch, Toggle } from '../bench'

export const STYLE_SCROLL_KEY = 'entomate-settings-style-scroll'

export default function AppearanceSettings({ reduceMotion, onReduceMotion, onThemeChange }) {
  const { mode, designStyle, designStyles, setDesignStyle, palette, palettes, setPalette } = useTheme()
  const mainStyles = designStyles.filter((style) => style.id === DEFAULT_DESIGN_STYLE)
  const moreStyles = designStyles.filter((style) => style.id !== DEFAULT_DESIGN_STYLE)
  // Open when a secondary style is in use, so the selected card is never hidden.
  const [moreStylesOpen, setMoreStylesOpen] = useState(() => designStyle !== DEFAULT_DESIGN_STYLE)

  const chooseStyle = (id) => {
    if (id === designStyle) return
    try { sessionStorage.setItem(STYLE_SCROLL_KEY, '1') } catch { /* storage blocked */ }
    setDesignStyle(id, { animate: !reduceMotion })
  }

  const renderStyle = (style) => {
    const selected = designStyle === style.id
    return (
      <button
        key={style.id}
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={() => chooseStyle(style.id)}
        className={`design-style-option text-left p-3 rounded-lg border transition-colors ${selected ? 'border-accent-primary bg-accent-primary-dim' : 'border-line-subtle bg-surface-elevated hover:border-line'}`}
      >
        <span className={`design-style-swatch design-style-swatch--${style.id}`} aria-hidden="true" />
        <span className="flex items-center justify-between gap-2 mt-3">
          <span className="text-sm font-semibold text-content-primary">{style.label}</span>
          {selected && <span className="text-xs font-medium text-accent-primary">In use</span>}
        </span>
        <span className="text-xs block mt-1 text-content-tertiary">{style.blurb}</span>
      </button>
    )
  }

  return (
    <div className="bs-tokens ap">
      <Section level={3} title="Display" aside="This browser" />

      <div className="ap-row">
        <div>
          <div id="theme-mode-label" className="ap-row-title">Theme</div>
          <div className="ap-row-help">The toolbar switch flips light and dark; System follows your device.</div>
        </div>
        <Switch
          label="Theme"
          value={mode}
          onChange={onThemeChange}
          options={[
            { value: THEME_MODES.light, label: 'Light' },
            { value: THEME_MODES.dark, label: 'Dark' },
            { value: THEME_MODES.system, label: 'System' },
          ]}
        />
      </div>

      <div className="ap-row">
        <div>
          <div className="ap-row-title">Reduce motion</div>
          <div className="ap-row-help">Fewer animations for accessibility.</div>
        </div>
        <Toggle label="Reduce motion" checked={!!reduceMotion} onChange={onReduceMotion} />
      </div>

      {/* Design style picker (2026-11-21) */}
      <div data-style-picker className="ap-row ap-row--stack">
        <div>
          <div id="design-style-label" className="ap-row-title">Design style</div>
          <div className="ap-row-help">Changes the whole app's look in this browser. Light and dark mode still apply.</div>
        </div>
        <div role="radiogroup" aria-labelledby="design-style-label">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {mainStyles.map(renderStyle)}
          </div>
          {moreStyles.length > 0 && (
            <>
              <button
                type="button"
                aria-expanded={moreStylesOpen}
                aria-controls="more-design-styles"
                onClick={() => setMoreStylesOpen((open) => !open)}
                className="mt-3 text-sm font-medium text-content-secondary hover:text-content-primary transition-colors"
              >
                {moreStylesOpen ? '− Fewer styles' : `+ More styles (${moreStyles.length})`}
              </button>
              {/* Snaps open and shut (styles/design-style-picker.css); closed cards leave the tab order. */}
              <div
                id="more-design-styles"
                className={`more-styles-drawer ${moreStylesOpen ? 'is-open' : ''} ${reduceMotion ? 'is-still' : ''}`}
              >
                <div className="more-styles-drawer__inner">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3">
                    {moreStyles.map(renderStyle)}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bench Swiss palette (2026-11-22): Draft 1 Neutral now, Void Crimson kept as the alternative */}
      {designStyle === 'bench-swiss' && (
        <div className="ap-row">
          <div>
            <div className="ap-row-title">Palette</div>
            <div className="ap-row-help">Neutral is the current palette. Void Crimson brings back the brand tones and type.</div>
          </div>
          <Switch
            label="Bench Swiss palette"
            value={palette}
            onChange={setPalette}
            options={palettes.map((p) => ({ value: p.id, label: p.label }))}
          />
        </div>
      )}

      <div className="ap-gap" />
      {/* Collapsible: the in-use bar always shows; the 17 cards open under it */}
      <LogoSystemPicker />
    </div>
  )
}
