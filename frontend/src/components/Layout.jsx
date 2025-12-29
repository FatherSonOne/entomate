import React, { useState } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Mic,
  FolderKanban,
  CheckSquare,
  Zap,
  Bot,
  Target,
  BarChart3,
  Search,
  Settings,
  Menu,
  X,
  ChevronRight,
  Kanban,
  FileText,
  Calendar,
  Command,
  Workflow
} from 'lucide-react'
import { useKeyboardShortcuts, getModKey } from '../hooks/useKeyboardShortcuts'
import CommandPalette from './CommandPalette'
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp'
import ThemeToggle from './ThemeToggle'
import { useTheme } from '../context/ThemeContext'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Meetings', href: '/meetings', icon: Mic },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Project Board', href: '/project-dashboard', icon: Kanban },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Automations', href: '/automations', icon: Zap },
  { name: 'Workflows', href: '/workflows', icon: Workflow },
  { name: 'AI Agents', href: '/agents', icon: Bot },
  { name: 'Goals', href: '/goals', icon: Target },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Calendar', href: '/calendar', icon: Calendar },
  { name: 'Search', href: '/search', icon: Search },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { isDark } = useTheme()

  const isActive = (href) => location.pathname.startsWith(href)

  // Global keyboard shortcuts
  useKeyboardShortcuts({
    'mod+k': () => setCommandPaletteOpen(true),
    'mod+?': () => setShortcutsHelpOpen(true),
    'mod+/': () => navigate('/search'),
    'mod+m': () => navigate('/meetings?new=true'),
  })

  return (
    <div className="min-h-screen transition-colors duration-300">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar fixed top-0 left-0 z-50 h-full w-64 transform transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo - CMF Nothing style with highlight accent */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-nothing-200 dark:border-nothing-800">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'var(--highlight-color)' }}
              >
                <span className="text-white font-bold text-lg font-mono">E</span>
              </div>
              <span className="text-xl font-bold text-nothing-900 dark:text-nothing-100">Entomate</span>
            </div>
            <button
              className="lg:hidden p-1 text-nothing-500 hover:text-nothing-700 dark:text-nothing-400 dark:hover:text-nothing-200"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
            {navigation.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={`nav-item ${active ? 'nav-item-active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                  {active && <ChevronRight className="w-4 h-4 ml-auto" />}
                </NavLink>
              )
            })}
          </nav>

          {/* Settings link */}
          <div className="p-3 border-t border-nothing-200 dark:border-nothing-800">
            <NavLink
              to="/settings"
              className={`nav-item ${isActive('/settings') ? 'nav-item-active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </NavLink>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar - CMF Nothing style header */}
        <header className="header sticky top-0 z-30 flex items-center h-16 px-4 lg:px-6">
          <button
            className="p-2 -ml-2 text-nothing-500 hover:text-nothing-700 dark:text-nothing-400 dark:hover:text-nothing-200 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Breadcrumb placeholder */}
          <div className="flex-1" />

          {/* Right side actions */}
          <div className="flex items-center gap-3">
            {/* Command palette button */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-nothing-500 dark:text-nothing-400 bg-nothing-100 dark:bg-nothing-800 hover:bg-nothing-200 dark:hover:bg-nothing-700 rounded-lg transition-colors"
            >
              <Search className="w-4 h-4" />
              <span>Search...</span>
              <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-white dark:bg-nothing-900 border border-nothing-300 dark:border-nothing-600 rounded">
                {getModKey()}K
              </kbd>
            </button>

            {/* Keyboard shortcuts hint */}
            <button
              onClick={() => setShortcutsHelpOpen(true)}
              className="hidden md:flex p-2 text-nothing-400 hover:text-nothing-600 dark:hover:text-nothing-200 hover:bg-nothing-100 dark:hover:bg-nothing-800 rounded-lg"
              title="Keyboard shortcuts"
            >
              <Command className="w-5 h-5" />
            </button>

            {/* Theme Toggle - CMF Nothing style */}
            <ThemeToggle compact />

            <button className="btn btn-primary" onClick={() => navigate('/meetings?new=true')}>
              <Mic className="w-4 h-4" />
              <span className="hidden sm:inline">New Meeting</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      {/* Command Palette (Cmd+K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onShowShortcuts={() => {
          setCommandPaletteOpen(false)
          setShortcutsHelpOpen(true)
        }}
      />

      {/* Keyboard Shortcuts Help (Cmd+?) */}
      <KeyboardShortcutsHelp
        isOpen={shortcutsHelpOpen}
        onClose={() => setShortcutsHelpOpen(false)}
      />
    </div>
  )
}
