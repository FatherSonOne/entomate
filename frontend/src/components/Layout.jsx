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
  Workflow,
  Moon,
  Sun,
  User
} from 'lucide-react'
import { useKeyboardShortcuts, getModKey } from '../hooks/useKeyboardShortcuts'
import CommandPalette from './CommandPalette'
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp'
import { useTheme } from '../context/ThemeContext'
import '../styles/navigation.css'

// Grouped navigation structure — 4 sections
const navGroups = [
  {
    label: 'Intelligence',
    items: [
      { name: 'Dashboard',  href: '/dashboard',        icon: LayoutDashboard, iconKey: 'dashboard' },
      { name: 'Meetings',   href: '/meetings',          icon: Mic,             iconKey: 'meetings'  },
      { name: 'Calendar',   href: '/calendar',          icon: Calendar,        iconKey: 'calendar'  },
      { name: 'Search',     href: '/search',            icon: Search,          iconKey: 'search'    },
    ],
  },
  {
    label: 'Work',
    items: [
      { name: 'Projects',      href: '/projects',          icon: FolderKanban, iconKey: 'projects' },
      { name: 'Project Board', href: '/project-dashboard', icon: Kanban,       iconKey: 'board'    },
      { name: 'Tasks',         href: '/tasks',             icon: CheckSquare,  iconKey: 'tasks'    },
      { name: 'Goals',         href: '/goals',             icon: Target,       iconKey: 'goals'    },
    ],
  },
  {
    label: 'Automation',
    items: [
      { name: 'Workflows',  href: '/workflows',   icon: Workflow, iconKey: 'workflows'  },
      { name: 'Automations',href: '/automations', icon: Zap,      iconKey: 'automations'},
      { name: 'AI Agents',  href: '/agents',      icon: Bot,      iconKey: 'agents'     },
    ],
  },
  {
    label: 'Output',
    items: [
      { name: 'Analytics', href: '/analytics', icon: BarChart3, iconKey: 'analytics' },
      { name: 'Reports',   href: '/reports',   icon: FileText,  iconKey: 'reports'   },
    ],
  },
]

// Breadcrumb label map
const breadcrumbMap = {
  '/dashboard':        'Dashboard',
  '/meetings':         'Meetings',
  '/calendar':         'Calendar',
  '/search':           'Search',
  '/projects':         'Projects',
  '/project-dashboard':'Project Board',
  '/tasks':            'Tasks',
  '/goals':            'Goals',
  '/workflows':        'Workflows',
  '/automations':      'Automations',
  '/agents':           'AI Agents',
  '/analytics':        'Analytics',
  '/reports':          'Reports',
  '/settings':         'Settings',
}

function getBreadcrumb(pathname) {
  // Exact match first
  if (breadcrumbMap[pathname]) return breadcrumbMap[pathname]
  // Prefix match for detail routes (/meetings/:id, /projects/:id, etc.)
  for (const [key, label] of Object.entries(breadcrumbMap)) {
    if (pathname.startsWith(key + '/')) return label
  }
  return null
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { isDark, toggleMode } = useTheme()

  const isActive = (href) => location.pathname.startsWith(href)
  const breadcrumb = getBreadcrumb(location.pathname)

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

          {/* Logo */}
          <div className="sidebar-logo flex items-center justify-between h-16 px-4">
            <div className="flex items-center gap-2.5">
              <div className="sidebar-logo-mark w-8 h-8 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-base font-mono leading-none">E</span>
              </div>
              <span className="text-xl font-display font-bold tracking-tight text-content-primary">
                entomate
              </span>
            </div>
            <button
              className="lg:hidden p-1 text-content-secondary hover:text-content-primary transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Grouped Navigation */}
          <nav className="nav-container flex-1 overflow-y-auto nav-scrollbar">
            {navGroups.map((group, gi) => (
              <div key={group.label} className={gi > 0 ? 'nav-group' : 'nav-group nav-group-first'}>
                <div className="nav-section-label">{group.label}</div>
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = isActive(item.href)
                  return (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      data-icon={item.iconKey}
                      className={`nav-item ${active ? 'nav-item-active' : ''}`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className="nav-icon-wrap">
                        <Icon className="w-5 h-5" />
                      </span>
                      <span>{item.name}</span>
                      {active && <ChevronRight className="nav-item-chevron w-4 h-4 ml-auto" />}
                    </NavLink>
                  )
                })}
              </div>
            ))}
          </nav>

          {/* Footer: Settings + User */}
          <div className="nav-footer">
            <NavLink
              to="/settings"
              data-icon="settings"
              className={`nav-item ${isActive('/settings') ? 'nav-item-active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="nav-icon-wrap">
                <Settings className="w-5 h-5" />
              </span>
              <span>Settings</span>
              {isActive('/settings') && <ChevronRight className="nav-item-chevron w-4 h-4 ml-auto" />}
            </NavLink>

            <div className="nav-user-area">
              <div className="nav-user-avatar">
                <User className="w-4 h-4" />
              </div>
              <div className="nav-user-info">
                <span className="nav-user-name">Workspace</span>
                <span className="nav-user-role">Free plan</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="header sticky top-0 z-30 flex items-center h-16 px-4 lg:px-6">
          <button
            className="p-2 -ml-2 text-content-secondary hover:text-content-primary lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Breadcrumb */}
          {breadcrumb && (
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="text-content-muted font-mono text-xs uppercase tracking-widest">entomate</span>
              <ChevronRight className="w-3.5 h-3.5 text-content-muted" />
              <span className="text-content-primary font-semibold">{breadcrumb}</span>
            </div>
          )}

          <div className="flex-1" />

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {/* Command palette trigger */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-content-secondary bg-surface-muted hover:bg-muted rounded-lg transition-colors border border-border-subtle"
            >
              <Search className="w-4 h-4" />
              <span className="hidden md:inline">Search...</span>
              <kbd className="ml-1 px-1.5 py-0.5 text-xs bg-surface border border-border-default rounded font-mono">
                {getModKey()}K
              </kbd>
            </button>

            {/* Keyboard shortcuts */}
            <button
              onClick={() => setShortcutsHelpOpen(true)}
              className="hidden md:flex p-2 text-content-tertiary hover:text-content-secondary hover:bg-surface-muted rounded-lg transition-colors"
              title="Keyboard shortcuts"
            >
              <Command className="w-4 h-4" />
            </button>

            {/* Dark / Light toggle */}
            <button
              onClick={toggleMode}
              className="p-2 text-content-secondary hover:text-content-primary hover:bg-surface-muted rounded-lg transition-colors"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Light mode' : 'Dark mode'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* New Meeting CTA */}
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

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onShowShortcuts={() => {
          setCommandPaletteOpen(false)
          setShortcutsHelpOpen(true)
        }}
      />

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        isOpen={shortcutsHelpOpen}
        onClose={() => setShortcutsHelpOpen(false)}
      />
    </div>
  )
}
