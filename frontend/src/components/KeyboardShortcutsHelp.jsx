import React from 'react'
import { X, Command, Search, Mic, HelpCircle, Sparkles } from 'lucide-react'
import { useKeyboardShortcuts, getModKey } from '../hooks/useKeyboardShortcuts'

// Only keys that are registered somewhere (Layout, Tasks, Search, the palette).
// Keep in step with SHORTCUTS in components/UsersGuide/guideData.js.
const shortcutGroups = [
  {
    title: 'General',
    shortcuts: [
      { keys: ['mod', 'K'], description: 'Open the palette: search, ask, go to a page', icon: Command },
      { keys: ['mod', '/'], description: 'Ask Entomate', icon: Sparkles },
      { keys: ['mod', '?'], description: 'Show keyboard shortcuts', icon: HelpCircle },
      { keys: ['mod', 'M'], description: 'New meeting', icon: Mic },
      { keys: ['mod', ','], description: 'Settings' },
      { keys: ['Esc'], description: 'Close a drawer or dialog' },
    ]
  },
  {
    title: 'On a page',
    shortcuts: [
      { keys: ['/'], description: 'Search on Tasks, Search and the User Guide', icon: Search },
      { keys: ['N'], description: 'New task, on Tasks' },
    ]
  },
  {
    title: 'In the palette',
    shortcuts: [
      { keys: ['Tab'], description: 'Ask about what you typed' },
      { keys: ['mod', 'S'], description: 'Keep a result in Notes' },
      { keys: ['mod', 'Enter'], description: 'Open the query in Search' },
    ]
  }
]

function KeyDisplay({ keys }) {
  const modKey = getModKey()

  return (
    <div className="flex items-center gap-1">
      {keys.map((key, idx) => {
        if (key === 'then') {
          return <span key={idx} className="text-content-tertiary text-xs mx-0.5">then</span>
        }

        const displayKey = key === 'mod' ? modKey : key

        return (
          <kbd
            key={idx}
            className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-medium bg-surface-muted text-content-secondary border border-line-strong rounded shadow-sm"
          >
            {displayKey}
          </kbd>
        )
      })}
    </div>
  )
}

export default function KeyboardShortcutsHelp({ isOpen, onClose }) {
  // Close on Escape
  useKeyboardShortcuts({
    'escape': { callback: onClose, allowInInput: true }
  }, isOpen)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl transform rounded-xl bg-surface shadow-2xl ring-1 ring-black/5">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-line-default">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <Command className="w-5 h-5 text-accent-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-content-primary">Keyboard Shortcuts</h2>
                <p className="text-sm text-content-tertiary">Navigate faster with these shortcuts</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-content-tertiary hover:text-content-secondary hover:bg-surface-muted"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            <div className="grid md:grid-cols-2 gap-6">
              {shortcutGroups.map((group) => (
                <div key={group.title}>
                  <h3 className="text-sm font-medium text-content-primary mb-3">{group.title}</h3>
                  <div className="space-y-2">
                    {group.shortcuts.map((shortcut, idx) => {
                      const Icon = shortcut.icon
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-muted"
                        >
                          <div className="flex items-center gap-2">
                            {Icon && <Icon className="w-4 h-4 text-content-tertiary" />}
                            <span className="text-sm text-content-secondary">{shortcut.description}</span>
                          </div>
                          <KeyDisplay keys={shortcut.keys} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-line-default bg-surface-muted rounded-b-xl">
            <div className="flex items-center justify-between">
              <p className="text-sm text-content-tertiary">
                Press <kbd className="px-1.5 py-0.5 bg-surface border border-line-strong rounded text-xs">Esc</kbd> to close
              </p>
              <p className="text-sm text-content-tertiary">
                {getModKey()} = {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? 'Command' : 'Control'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
