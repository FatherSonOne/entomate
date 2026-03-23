import React, { useState } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Mic, FolderKanban, CheckSquare, Zap, Bot,
  Target, BarChart3, Search, Settings, Menu, X, ChevronRight,
  Kanban, FileText, Calendar, Command, Workflow, Moon, Sun,
  User, LogOut,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useKeyboardShortcuts, getModKey } from '../hooks/useKeyboardShortcuts'
import CommandPalette from './CommandPalette'
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp'
import { useTheme } from '../context/ThemeContext'
import '../styles/navigation.css'
import VCCanvas from './vc/VCCanvas'
import Logo from './Logo'

/* ── Section accent config ────────────────────────────────── */
const ACCENT = {
  Intelligence: 'crimson',
  Work:         'mint',
  Automation:   'amber',
  Output:       'phosphor',
}

/* ── Grouped navigation ───────────────────────────────────── */
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
      { name: 'Workflows',   href: '/workflows',   icon: Workflow, iconKey: 'workflows'   },
      { name: 'Automations', href: '/automations', icon: Zap,      iconKey: 'automations' },
      { name: 'AI Agents',   href: '/agents',      icon: Bot,      iconKey: 'agents'      },
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

/* ── Breadcrumb map ───────────────────────────────────────── */
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
  if (breadcrumbMap[pathname]) return breadcrumbMap[pathname]
  for (const [key, label] of Object.entries(breadcrumbMap)) {
    if (pathname.startsWith(key + '/')) return label
  }
  return null
}

/* ═══════════════════════════════════════════════════════════
   LAYOUT
   ═══════════════════════════════════════════════════════════ */
export default function Layout() {
  const [sidebarOpen, setSidebarOpen]       = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [shortcutsHelpOpen, setShortcutsHelpOpen]   = useState(false)
  // Collapsed state per section — start all open
  const [collapsed, setCollapsed] = useState({})

  const location  = useLocation()
  const navigate  = useNavigate()
  const { isDark, toggleMode } = useTheme()
  const { user, signOut }      = useAuth()

  const handleSignOut = async () => { await signOut(); navigate('/sign-in') }
  const isActive = (href) => location.pathname.startsWith(href)
  const breadcrumb = getBreadcrumb(location.pathname)

  const toggleCollapse = (label) =>
    setCollapsed(c => ({ ...c, [label]: !c[label] }))

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

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside
        className={`nl-sidebar ${sidebarOpen ? 'open' : ''}`}
        style={{ isolation: 'isolate' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

          {/* Logo area */}
          <div className="nl-logo">
            <Logo size="sm" withText={true} />
            <button
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            >
              <X style={{ width: 16, height: 16, color: 'var(--t2)' }} />
            </button>
          </div>

          {/* Scrollable grouped nav */}
          <nav className="nl-scroll">
            {navGroups.map((group) => {
              const accent    = ACCENT[group.label] || 'crimson'
              const isOpen    = !collapsed[group.label]
              const anyActive = group.items.some(i => isActive(i.href))

              return (
                <div key={group.label} className="nl-group">

                  {/* Section header — clickable to collapse */}
                  <button
                    className="nl-section-toggle"
                    onClick={() => toggleCollapse(group.label)}
                    aria-expanded={isOpen}
                  >
                    <span className="nl-section">{group.label}</span>
                    <ChevronRight
                      className={`nl-section-chevron ${isOpen ? 'open' : ''}`}
                      style={{ width: 10, height: 10 }}
                    />
                  </button>

                  {/* Collapsible items */}
                  <div className={`nl-group-items ${isOpen ? '' : 'collapsed'}`}>
                    {group.items.map((item) => {
                      const Icon   = item.icon
                      const active = isActive(item.href)
                      return (
                        <NavLink
                          key={item.name}
                          to={item.href}
                          data-icon={item.iconKey}
                          data-accent={accent}
                          className={`nl-item ${active ? 'active' : ''}`}
                          onClick={() => setSidebarOpen(false)}
                        >
                          <span className={`nl-icon-box nl-icon-box-${accent}`}>
                            <Icon style={{ width: 14, height: 14 }} />
                          </span>
                          <span>{item.name}</span>
                        </NavLink>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </nav>

          {/* Footer — settings + avatar card */}
          <div className="nl-footer">

            {/* Settings link */}
            <NavLink
              to="/settings"
              data-icon="settings"
              data-accent="neutral"
              className={`nl-item ${isActive('/settings') ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
              style={{ marginBottom: 4 }}
            >
              <span className="nl-icon-box">
                <Settings style={{ width: 14, height: 14 }} />
              </span>
              <span>Settings</span>
            </NavLink>

            {/* Avatar card user area */}
            <div className="nl-avatar-card" role="button" tabIndex={0}>
              <div className="nl-avatar">
                {user?.avatar_url
                  ? <img src={user.avatar_url} alt={user?.name || 'User'} />
                  : <User style={{ width: 14, height: 14 }} />
                }
                <span className="nl-avatar-status" title="Online" />
              </div>

              <div className="nl-avatar-info">
                <span className="nl-avatar-name">
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Workspace'}
                </span>
                <span className="nl-avatar-role">
                  {user?.email || 'Free plan'}
                </span>
              </div>

              <button
                className="nl-signout"
                onClick={handleSignOut}
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut style={{ width: 13, height: 13 }} />
              </button>
            </div>

          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div style={{ paddingLeft: 240 }} className="max-lg:pl-0">

        {/* Topbar */}
        <header
          className="vc-topbar"
          style={{
            position:     'sticky',
            top:          0,
            zIndex:       30,
            background:   'rgba(14,14,14,.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(248,240,242,.06)',
            height:       52,
          }}
        >
          {/* Mobile hamburger */}
          <button
            style={{ padding: 8, marginLeft: -8, background:'none', border:'none', cursor:'pointer', color:'var(--t1)' }}
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu style={{ width: 22, height: 22 }} />
          </button>

          {/* Breadcrumb */}
          {breadcrumb && (
            <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13 }} className="hidden sm:flex">
              <span style={{ color:'var(--t2)', fontFamily:'var(--font-mono,JetBrains Mono,monospace)', fontSize:10, textTransform:'uppercase', letterSpacing:'.1em' }}>
                entomate
              </span>
              <ChevronRight style={{ width:12, height:12, color:'var(--t2)' }} />
              <span style={{ color:'var(--t0)', fontWeight:600 }}>{breadcrumb}</span>
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* Right actions */}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {/* Command palette trigger */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="vc-topbar-search hidden sm:flex"
            >
              <Search style={{ width: 14, height: 14 }} />
              <span className="hidden md:inline" style={{ fontSize: 12 }}>Search...</span>
              <kbd style={{ marginLeft:4, padding:'2px 6px', fontSize:10, background:'rgba(248,240,242,.06)', border:'1px solid rgba(248,240,242,.1)', borderRadius:4, fontFamily:'var(--font-mono,monospace)', color:'var(--t2)' }}>
                {getModKey()}K
              </kbd>
            </button>

            {/* Keyboard shortcuts */}
            <button
              onClick={() => setShortcutsHelpOpen(true)}
              style={{ padding:8, background:'none', border:'none', cursor:'pointer', color:'var(--t2)', borderRadius:8, transition:'color 150ms ease, background 150ms ease' }}
              title="Keyboard shortcuts"
              className="hidden md:flex"
              onMouseEnter={e => { e.currentTarget.style.color='var(--t0)'; e.currentTarget.style.background='rgba(248,240,242,.05)' }}
              onMouseLeave={e => { e.currentTarget.style.color='var(--t2)'; e.currentTarget.style.background='transparent' }}
            >
              <Command style={{ width: 15, height: 15 }} />
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleMode}
              style={{ padding:8, background:'none', border:'none', cursor:'pointer', color:'var(--t1)', borderRadius:8, transition:'color 150ms ease, background 150ms ease' }}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              onMouseEnter={e => { e.currentTarget.style.color='var(--t0)'; e.currentTarget.style.background='rgba(248,240,242,.05)' }}
              onMouseLeave={e => { e.currentTarget.style.color='var(--t1)'; e.currentTarget.style.background='transparent' }}
            >
              {isDark ? <Sun style={{ width: 15, height: 15 }} /> : <Moon style={{ width: 15, height: 15 }} />}
            </button>

            {/* New Meeting CTA */}
            <button
              className="vbtn vbtn-primary vbtn-sm"
              onClick={() => navigate('/meetings?new=true')}
              style={{ gap: 6 }}
            >
              <Mic style={{ width: 13, height: 13 }} />
              <span className="hidden sm:inline">New Meeting</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main style={{ padding: '16px 24px', position: 'relative', zIndex: 1 }}>
          <Outlet />
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onShowShortcuts={() => { setCommandPaletteOpen(false); setShortcutsHelpOpen(true) }}
      />

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        isOpen={shortcutsHelpOpen}
        onClose={() => setShortcutsHelpOpen(false)}
      />
    </div>
  )
}
