import React from 'react'
import { X, Command, Search, Mic, FolderKanban, CheckSquare, HelpCircle } from 'lucide-react'
import { useKeyboardShortcuts, getModKey } from '../hooks/useKeyboardShortcuts'

const shortcutGroups = [
  {
    title: 'General',
    shortcuts: [
      { keys: ['mod', 'K'], description: 'Open command palette', icon: Command },
      { keys: ['mod', '/'], description: 'Focus search', icon: Search },
      { keys: ['mod', '?'], description: 'Show keyboard shortcuts', icon: HelpCircle },
      { keys: ['Esc'], description: 'Close dialogs/modals' },
    ]
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['G', 'then', 'D'], description: 'Go to Dashboard' },
      { keys: ['G', 'then', 'M'], description: 'Go to Meetings' },
      { keys: ['G', 'then', 'P'], description: 'Go to Projects' },
      { keys: ['G', 'then', 'T'], description: 'Go to Tasks' },
      { keys: ['G', 'then', 'S'], description: 'Go to Search' },
    ]
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['mod', 'M'], description: 'New Meeting', icon: Mic },
      { keys: ['mod', 'P'], description: 'New Project', icon: FolderKanban },
      { keys: ['mod', 'T'], description: 'New Task', icon: CheckSquare },
    ]
  },
  {
    title: 'Search Page',
    shortcuts: [
      { keys: ['mod', 'Enter'], description: 'Submit search' },
      { keys: ['Tab'], description: 'Switch search type' },
      { keys: ['mod', 'S'], description: 'Save current search' },
    ]
  }
]

function KeyDisplay({ keys }) {
  const modKey = getModKey()

  return (
    <div className="flex items-center gap-1">
      {keys.map((key, idx) => {
        if (key === 'then') {
          return <span key={idx} className="text-gray-400 text-xs mx-0.5">then</span>
        }

        const displayKey = key === 'mod' ? modKey : key

        return (
          <kbd
            key={idx}
            className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300 rounded shadow-sm"
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
        <div className="relative w-full max-w-2xl transform rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <Command className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Keyboard Shortcuts</h2>
                <p className="text-sm text-gray-500">Navigate faster with these shortcuts</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            <div className="grid md:grid-cols-2 gap-6">
              {shortcutGroups.map((group) => (
                <div key={group.title}>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">{group.title}</h3>
                  <div className="space-y-2">
                    {group.shortcuts.map((shortcut, idx) => {
                      const Icon = shortcut.icon
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-2">
                            {Icon && <Icon className="w-4 h-4 text-gray-400" />}
                            <span className="text-sm text-gray-700">{shortcut.description}</span>
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
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Press <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-xs">Esc</kbd> to close
              </p>
              <p className="text-sm text-gray-500">
                {getModKey()} = {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? 'Command' : 'Control'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
