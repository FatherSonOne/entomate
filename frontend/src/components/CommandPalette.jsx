import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, LayoutDashboard, Mic, FolderKanban, CheckSquare,
  Zap, Bot, Target, BarChart3, FileText, Calendar, Settings,
  Kanban, X, Command, HelpCircle
} from 'lucide-react'
import { useKeyboardShortcuts, formatShortcut } from '../hooks/useKeyboardShortcuts'

const commands = [
  // Navigation
  { id: 'nav-dashboard', name: 'Go to Dashboard', icon: LayoutDashboard, action: 'navigate', path: '/dashboard', category: 'Navigation' },
  { id: 'nav-meetings', name: 'Go to Meetings', icon: Mic, action: 'navigate', path: '/meetings', category: 'Navigation' },
  { id: 'nav-projects', name: 'Go to Projects', icon: FolderKanban, action: 'navigate', path: '/projects', category: 'Navigation' },
  { id: 'nav-board', name: 'Go to Project Board', icon: Kanban, action: 'navigate', path: '/project-dashboard', category: 'Navigation' },
  { id: 'nav-tasks', name: 'Go to Tasks', icon: CheckSquare, action: 'navigate', path: '/tasks', category: 'Navigation' },
  { id: 'nav-automations', name: 'Go to Automations', icon: Zap, action: 'navigate', path: '/automations', category: 'Navigation' },
  { id: 'nav-agents', name: 'Go to AI Agents', icon: Bot, action: 'navigate', path: '/agents', category: 'Navigation' },
  { id: 'nav-goals', name: 'Go to Goals', icon: Target, action: 'navigate', path: '/goals', category: 'Navigation' },
  { id: 'nav-analytics', name: 'Go to Analytics', icon: BarChart3, action: 'navigate', path: '/analytics', category: 'Navigation' },
  { id: 'nav-reports', name: 'Go to Reports', icon: FileText, action: 'navigate', path: '/reports', category: 'Navigation' },
  { id: 'nav-calendar', name: 'Go to Calendar', icon: Calendar, action: 'navigate', path: '/calendar', category: 'Navigation' },
  { id: 'nav-search', name: 'Go to Search', icon: Search, action: 'navigate', path: '/search', category: 'Navigation' },
  { id: 'nav-settings', name: 'Go to Settings', icon: Settings, action: 'navigate', path: '/settings', category: 'Navigation' },

  // Actions
  { id: 'action-new-meeting', name: 'New Meeting', icon: Mic, action: 'navigate', path: '/meetings?new=true', category: 'Actions', shortcut: 'mod+m' },
  { id: 'action-new-project', name: 'New Project', icon: FolderKanban, action: 'navigate', path: '/projects?new=true', category: 'Actions' },
  { id: 'action-new-task', name: 'New Task', icon: CheckSquare, action: 'navigate', path: '/tasks?new=true', category: 'Actions' },
  { id: 'action-search', name: 'Search Everything', icon: Search, action: 'navigate', path: '/search', category: 'Actions', shortcut: 'mod+/' },

  // Help
  { id: 'help-shortcuts', name: 'Keyboard Shortcuts', icon: Command, action: 'showShortcuts', category: 'Help', shortcut: 'mod+?' },
  { id: 'help-docs', name: 'Documentation', icon: HelpCircle, action: 'openDocs', category: 'Help' },
]

export default function CommandPalette({ isOpen, onClose, onShowShortcuts }) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const navigate = useNavigate()

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands

    const searchTerm = query.toLowerCase()
    return commands.filter(cmd =>
      cmd.name.toLowerCase().includes(searchTerm) ||
      cmd.category.toLowerCase().includes(searchTerm)
    )
  }, [query])

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups = {}
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = []
      }
      groups[cmd.category].push(cmd)
    })
    return groups
  }, [filteredCommands])

  // Flatten for keyboard navigation
  const flatCommands = useMemo(() => {
    return Object.values(groupedCommands).flat()
  }, [groupedCommands])

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && flatCommands.length > 0) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`)
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex, flatCommands.length])

  // Handle keyboard navigation
  useKeyboardShortcuts({
    'escape': { callback: onClose, allowInInput: true },
    'ArrowDown': {
      callback: () => setSelectedIndex(i => Math.min(i + 1, flatCommands.length - 1)),
      allowInInput: true,
      requireMod: false
    },
    'ArrowUp': {
      callback: () => setSelectedIndex(i => Math.max(i - 1, 0)),
      allowInInput: true,
      requireMod: false
    },
    'Enter': {
      callback: () => {
        if (flatCommands[selectedIndex]) {
          executeCommand(flatCommands[selectedIndex])
        }
      },
      allowInInput: true,
      requireMod: false
    }
  }, isOpen)

  const executeCommand = (command) => {
    onClose()

    switch (command.action) {
      case 'navigate':
        navigate(command.path)
        break
      case 'showShortcuts':
        onShowShortcuts?.()
        break
      case 'openDocs':
        window.open('https://docs.entomate.com', '_blank')
        break
      default:
        console.log('Unknown action:', command.action)
    }
  }

  if (!isOpen) return null

  let flatIndex = 0

  return (
    <div className="cmd-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cmd-box">
        {/* Search input */}
        <div className="cmd-input-wrap">
          <Search className="w-5 h-5 text-content-tertiary" />
          <input
            ref={inputRef}
            type="text"
            className="cmd-input"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
          />
          <button
            onClick={onClose}
            className="rounded p-1 text-content-tertiary hover:text-content-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Commands list */}
        <div ref={listRef} className="cmd-results">
          {flatCommands.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <Search className="w-10 h-10 mx-auto mb-2 text-content-muted" />
              <p>No commands found</p>
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, cmds]) => (
              <div key={category} className="mb-2">
                <div className="cmd-section-label">
                  {category}
                </div>
                {cmds.map((cmd) => {
                  const currentIndex = flatIndex++
                  const Icon = cmd.icon
                  const isSelected = currentIndex === selectedIndex

                  return (
                    <button
                      key={cmd.id}
                      data-index={currentIndex}
                      className={`cmd-result${isSelected ? ' selected' : ''}`}
                      onClick={() => executeCommand(cmd)}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                    >
                      <div className="cmd-result-icon"><Icon className="w-4 h-4" /></div>
                      <span className="cmd-result-title">{cmd.name}</span>
                      {cmd.shortcut && (
                        <kbd className="cmd-kbd">
                          {formatShortcut(cmd.shortcut)}
                        </kbd>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="cmd-footer">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="cmd-kbd">↑↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="cmd-kbd">↵</kbd>
              to select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="cmd-kbd">esc</kbd>
              to close
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
