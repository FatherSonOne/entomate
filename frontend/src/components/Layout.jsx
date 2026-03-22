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
  User,
  LogOut,
  Home
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useKeyboardShortcuts, getModKey } from '../hooks/useKeyboardShortcuts'
import CommandPalette from './CommandPalette'
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp'
import { useTheme } from '../context/ThemeContext'
import '../styles/navigation.css'
import VCCanvas from './vc/VCCanvas'
import Logo from './Logo'

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
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    navigate('/sign-in')
  }

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
    <div className="min-h-screen transition-colors duration-300 hover-glow trans-slow">
      {/* Neural canvas background */}
      <VCCanvas mode="neural" speed={50} density={95} opacity={0.9} />

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`nl-sidebar z-50 transform transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ isolation: 'isolate' }}
      >
        <div className="flex flex-col h-full">

          {/* Logo */}
          <div className="flex items-center justify-between" style={{ padding: '16px 14px 12px' }}>
            <Logo size="sm" withText={true} />
            <button
              className="lg:hidden p-1 text-content-secondary hover:text-content-primary transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Grouped Navigation */}
          <nav className="nl-scroll">
            {navGroups.map((group) => (
              <div key={group.label}>
                <div className="nl-section">{group.label}</div>
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = isActive(item.href)
                  return (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      data-icon={item.iconKey}
                      className={`nl-item ${active ? 'active' : ''}`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className="nl-icon-box">
                        <Icon className="w-4 h-4" />
                      </span>
                      <span>{item.name}</span>
                    </NavLink>
                  )
                })}
              </div>
            ))}
          </nav>

          {/* Footer: Settings + User */}
          <div className="nl-footer">
            <NavLink
              to="/settings"
              data-icon="settings"
              className={`nl-item ${isActive('/settings') ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="nl-icon-box">
                <Settings className="w-4 h-4" />
              </span>
              <span>Settings</span>
            </NavLink>

            <div className="nav-user-area">
              <div className="nav-user-avatar">
                {user?.avatar_url
                  ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                  : <User className="w-4 h-4" />
                }
              </div>
              <div className="nav-user-info">
                <span className="nav-user-name">
                  {user?.name || user?.email || 'Workspace'}
                </span>
                <span className="nav-user-role">
                  {user?.email || 'Free plan'}
                </span>
              </div>
              <button
                onClick={handleSignOut}
                className="nav-signout-btn"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header
          className="vc-topbar"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            background: 'var(--bg-elevated, #101010)',
            borderBottom: '1px solid rgba(248,240,242,.06)',
            height: 52,
          }}
        >
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
              className="vc-topbar-search hidden sm:flex"
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
        <main className="p-4 lg:p-6" style={{ position: 'relative', zIndex: 1 }}>
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
