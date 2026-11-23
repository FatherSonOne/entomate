import { useEffect, useState } from 'react'
import { COMMANDS } from '../services/searchEngine'

/** One registry supplies navigation, executable keys and the held-modifier peek. */
export function navigationShortcut(path?: string): string | undefined {
  return COMMANDS.find((c) => c.path === path && c.id.startsWith('go-'))?.shortcut
}

export function shortcutLabel(shortcut?: string): string {
  const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'
  return (shortcut || '').replace('mod+', mod)
}

export function useNavigationShortcuts(navigate: (path: string) => void, isAdmin: boolean, enabled = true): boolean {
  const [held, setHeld] = useState(false)
  useEffect(() => {
    const reset = () => setHeld(false)
    const key = (e: KeyboardEvent) => {
      const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? e.metaKey : e.ctrlKey
      setHeld(e.ctrlKey || e.metaKey)
      if (!enabled || e.defaultPrevented || e.type !== 'keydown' || !mod || e.shiftKey || e.altKey || e.repeat || e.isComposing) return
      const target = e.target instanceof Element ? e.target : null
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
      const command = COMMANDS.find((c) => c.shortcut === `mod+${e.key.toLowerCase()}` && c.id.startsWith('go-') && (!c.adminOnly || isAdmin))
      if (command) { e.preventDefault(); navigate(command.path) }
    }
    window.addEventListener('keydown', key)
    window.addEventListener('keyup', key)
    window.addEventListener('blur', reset)
    document.addEventListener('visibilitychange', reset)
    return () => {
      window.removeEventListener('keydown', key)
      window.removeEventListener('keyup', key)
      window.removeEventListener('blur', reset)
      document.removeEventListener('visibilitychange', reset)
    }
  }, [navigate, isAdmin, enabled])
  return held
}
