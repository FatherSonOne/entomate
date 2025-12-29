import { useEffect, useCallback } from 'react'

/**
 * Custom hook for handling keyboard shortcuts
 * @param {Object} shortcuts - Object mapping shortcut keys to callbacks
 * @param {boolean} enabled - Whether shortcuts are enabled
 */
export function useKeyboardShortcuts(shortcuts, enabled = true) {
  const handleKeyDown = useCallback((event) => {
    if (!enabled) return

    // Don't trigger shortcuts when typing in inputs (unless specified)
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)
    const isContentEditable = event.target.isContentEditable

    // Build the key combination string
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const modKey = isMac ? event.metaKey : event.ctrlKey
    const key = event.key.toLowerCase()

    // Check for each shortcut
    for (const [shortcut, config] of Object.entries(shortcuts)) {
      const { callback, allowInInput = false, requireMod = true } =
        typeof config === 'function' ? { callback: config } : config

      // Skip if in input and not allowed
      if ((isInput || isContentEditable) && !allowInInput) continue

      // Parse the shortcut string (e.g., "mod+k", "mod+shift+p", "escape")
      const parts = shortcut.toLowerCase().split('+')
      const shortcutKey = parts[parts.length - 1]
      const needsMod = parts.includes('mod')
      const needsShift = parts.includes('shift')
      const needsAlt = parts.includes('alt')

      // Check if this shortcut matches
      const modMatches = !needsMod || modKey
      const shiftMatches = !needsShift || event.shiftKey
      const altMatches = !needsAlt || event.altKey
      const keyMatches = key === shortcutKey ||
        (shortcutKey === '?' && event.shiftKey && key === '/') ||
        (shortcutKey === 'escape' && key === 'escape')

      if (modMatches && shiftMatches && altMatches && keyMatches) {
        event.preventDefault()
        callback(event)
        return
      }
    }
  }, [shortcuts, enabled])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

/**
 * Get the modifier key label based on platform
 */
export function getModKey() {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  return isMac ? '⌘' : 'Ctrl'
}

/**
 * Format a shortcut for display
 */
export function formatShortcut(shortcut) {
  const modKey = getModKey()
  return shortcut
    .replace(/mod/i, modKey)
    .replace(/\+/g, ' + ')
    .replace(/shift/i, '⇧')
    .replace(/alt/i, '⌥')
    .replace(/escape/i, 'Esc')
    .toUpperCase()
}

export default useKeyboardShortcuts
