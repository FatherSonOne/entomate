import React, { Suspense, useState, useEffect, useCallback, useRef } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import PageSkeleton from './PageSkeleton'
import ErrorBoundary from './ErrorBoundary'
import { BootMark } from './BootLoader'
import {
  LayoutDashboard,
  Mic,
  FolderKanban,
  CheckSquare,
  Zap,
  BarChart3,
  Search,
  Settings,
  Menu,
  X,
  ChevronRight,
  Command,
  Moon,
  Sun,
  User,
  LogOut,
  Home,
  BookOpen
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import useBotDebriefWatch from './bot/useBotDebriefWatch'
import MissedBotAlert from './bot/MissedBotAlert'
import { useOrgSafe } from '../contexts/OrgContext'
import { useKeyboardShortcuts, getModKey } from '../hooks/useKeyboardShortcuts'
import { useNavigationShortcuts, navigationShortcut, shortcutLabel } from '../hooks/useNavigationShortcuts'
import CommandPalette from './CommandPalette'
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp'
import { useTheme } from '../context/ThemeContext'
import { useGuideNewFeatures } from './UsersGuide/useGuideNewFeatures'
import '../styles/navigation.css'
import '../styles/command-search.css'
import VCCanvas from './vc/VCCanvas'
import Logo from './Logo'
import EntoAssistantSkeleton from './EntoAssistant/EntoAssistantSkeleton'
import { requestVoiceOnOpen } from './EntoAssistant/voiceSignal'
import EntoAssistantButton from './EntoAssistant/EntoAssistantButton'
import EntoAIProactiveChecker from './EntoAssistant/EntoAIProactiveChecker'
import { BenchShell } from './bench/shell/BenchShell'
import { Drawer, Faceplate, Signal } from './bench'
import { MOTION, useEnterOnChange } from './bench/motion'
import { settingsApi } from '../services/api'
import '../styles/meeting-recorder.css'
const EntoAssistant = React.lazy(() => import('./EntoAssistant/EntoAssistant'))
const MeetingRecorder = React.lazy(() => import('./meetings/MeetingRecorder'))

// Grouped navigation structure — 4 sections
// Items with adminOnly: true are filtered out at render time for non-admin
// users via useOrgSafe().myRole. The backend gates the routes independently.
// Six modules (feature audit 2026-11-22), plus Search and the tools that have
// not merged yet. Calendar lives on Today (schedule + connect), the bot is
// Tools › Bot plus "Send a bot" on Meetings and Today, Board is a view inside Projects, Goals is
// gone. Their routes still work, so old links don't break.
const navGroups = [
  {
    label: 'Meetings',
    items: [
      { name: 'Today',        href: '/dashboard',     icon: LayoutDashboard, iconKey: 'dashboard' },
      { name: 'Meetings',     href: '/meetings',      icon: Mic,             iconKey: 'meetings'  },
    ],
  },
  {
    label: 'Work',
    items: [
      { name: 'Tasks',         href: '/tasks',             icon: CheckSquare,  iconKey: 'tasks'    },
      { name: 'Projects',      href: '/projects',          icon: FolderKanban, iconKey: 'projects' },
    ],
  },
  {
    label: 'Follow-through',
    items: [
      { name: 'Automations',href: '/automations', icon: Zap,       iconKey: 'automations'},
      { name: 'Insights',   href: '/analytics',   icon: BarChart3, iconKey: 'analytics' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { name: 'Search',       href: '/search',        icon: Search,   iconKey: 'search'    },
    ],
  },
]

// Breadcrumb label map
const breadcrumbMap = {
  '/dashboard':        'Today',
  '/meetings':         'Meetings',
  '/bot':              'Bot',
  '/calendar':         'Calendar',
  '/search':           'Search',
  '/projects':         'Projects',
  '/project-dashboard':'Project Board',
  '/tasks':            'Tasks',
  '/workflows':        'Automations',
  '/automations':      'Automations',
  '/analytics':        'Insights',
  '/settings':         'Settings',
  '/guide':            'User Guide',
  '/assistant/history': 'AI conversations',
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

/* ── Bench Swiss navigation ──
   Numbers are wayfinding: 01–06 for modules, 00 for Settings (in the
   toolbar). Tools that aren't modules sit unnumbered under "Tools". */
const benchModules = [
  { label: 'Meetings', items: [
    { no: '01', name: 'Today',       href: '/dashboard' },
    { no: '02', name: 'Meetings',    href: '/meetings' },
  ] },
  { label: 'Work', items: [
    { no: '03', name: 'Tasks',       href: '/tasks' },
    { no: '04', name: 'Projects',    href: '/projects' },
  ] },
  { label: 'Follow-through', items: [
    { no: '05', name: 'Automations', href: '/automations' },
    { no: '06', name: 'Insights',    href: '/analytics' },
  ] },
]

const benchDock = [
  { name: 'Today',    href: '/dashboard' },
  { name: 'Meetings', href: '/meetings' },
  { name: 'Tasks',    href: '/tasks' },
]

// Browser tab: "02 Meetings · Entomate" (the number lives in the tab and nav, never the title).
function getDocumentTitle(pathname) {
  for (const group of benchModules) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(item.href + '/')) return `${item.no} ${item.name} · Entomate`
    }
  }
  if (pathname.startsWith('/settings')) return '00 Settings · Entomate'
  const crumb = getBreadcrumb(pathname)
  return crumb ? `${crumb} · Entomate` : 'Entomate'
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [recorderOpen, setRecorderOpen] = useState(false)
  const [recorderLocked, setRecorderLocked] = useState(false)
  const [recordingVersion, setRecordingVersion] = useState(0)
  const [audioInputDeviceId, setAudioInputDeviceId] = useState('')
  const openRecorder = () => setRecorderOpen(true)
  const closeRecorder = () => setRecorderOpen(false)
  const recorderRecorded = () => setRecordingVersion((version) => version + 1)
  const recorderOutlet = { openRecorder, recorderOpen, recordingVersion }
  const shellOutlet = { ...recorderOutlet, openAssistant: () => setAssistantOpen(true) }
  // The panel chunk loads on first open, then stays mounted so its conversation survives a close.
  const [assistantMounted, setAssistantMounted] = useState(false)
  useEffect(() => { if (assistantOpen) setAssistantMounted(true) }, [assistantOpen])
  // EAI-06: the server's signals. The badge shows while one of them has not been seen in
  // the open panel yet; opening the panel marks the current ones seen.
  const [signals, setSignals] = useState({ signals: [], total: 0 })
  const [seenSignals, setSeenSignals] = useState(() => new Set())
  const onSignals = useCallback((next) => setSignals(next), [])
  const signalKey = signals.signals.map((s) => s.id).join(',')
  useEffect(() => {
    if (assistantOpen && signalKey) setSeenSignals((prev) => new Set([...prev, ...signalKey.split(',')]))
  }, [assistantOpen, signalKey])
  const proactiveSuggestion = signals.signals.some((s) => !seenSignals.has(s.id))
  const proactiveCount = proactiveSuggestion ? signals.total : 0
  const location = useLocation()
  const navigate = useNavigate()
  const { isDark, toggleMode, setThemeMode, isHeldLight, isBenchSwiss, designStyle } = useTheme()
  const classicPageRef = useRef(null)
  useEnterOnChange(classicPageRef, location.pathname, { rise: 0, duration: MOTION.fast })
  const { user, signOut } = useAuth()
  const orgCtx = useOrgSafe()
  const isAdmin = orgCtx?.myRole === 'owner' || orgCtx?.myRole === 'admin'
  const shortcutsHeld = useNavigationShortcuts(navigate, isAdmin, !commandPaletteOpen && !shortcutsHelpOpen && !recorderOpen)
  // Announce a saved debrief without interrupting the current page.
  useBotDebriefWatch({ orgId: orgCtx?.org?.id, userId: user?.id || null, enabled: isAdmin })

  const handleSignOut = async () => {
    await signOut()
    navigate('/sign-in')
  }

  const { hasNew: guideHasNew, dismiss: dismissGuideNew } = useGuideNewFeatures()

  const isActive = (href) => location.pathname.startsWith(href)
  const breadcrumb = getBreadcrumb(location.pathname)

  // Global keyboard shortcuts
  useKeyboardShortcuts({
    'mod+k': { callback: () => setCommandPaletteOpen(prev => !prev), allowInInput: true },
    'mod+?': () => setShortcutsHelpOpen(true),
    'mod+/': () => setAssistantOpen(prev => !prev),
    'mod+m': openRecorder,
    'mod+,': () => navigate('/settings'),
  }, !recorderOpen)

  // Bookmarks and results in command search still use the existing recorder URL.
  useEffect(() => {
    if (location.pathname !== '/meetings') return
    const params = new URLSearchParams(location.search)
    if (params.get('new') !== 'true') return
    setRecorderOpen(true)
    params.delete('new')
    navigate({ pathname: location.pathname, search: params.toString(), hash: location.hash }, { replace: true, state: location.state })
  }, [location, navigate])

  useEffect(() => {
    if (!recorderOpen) return
    let current = true
    settingsApi.getUser().then((res) => {
      if (current) setAudioInputDeviceId(res?.settings?.meetings_json?.audioInputDeviceId || '')
    }).catch(() => {})
    return () => { current = false }
  }, [recorderOpen])

  useEffect(() => {
    document.title = getDocumentTitle(location.pathname)
  }, [location.pathname])

  // Opening the guide clears its NEW note (the legacy sidebar does this on click).
  const onGuide = location.pathname.startsWith('/guide')
  useEffect(() => {
    if (isBenchSwiss && onGuide && guideHasNew) dismissGuideNew()
  }, [isBenchSwiss, onGuide, guideHasNew, dismissGuideNew])

  const toggleAssistant = () => setAssistantOpen(prev => !prev)
  // The launcher's mic: open the panel if needed and ask it to start (or stop) listening.
  const voiceAssistant = () => { requestVoiceOnOpen(); if (!assistantOpen) toggleAssistant() }

  // Overlays shared by both shells
  const overlays = (
    <>
      {/* Auto-join missed a calendar meeting: say so on every page (and re-check the calendar). */}
      {isAdmin && <MissedBotAlert />}
      {!isBenchSwiss && <CommandPalette
        isOpen={commandPaletteOpen}
        isAdmin={isAdmin}
        onClose={() => setCommandPaletteOpen(false)}
        onShowShortcuts={() => {
          setCommandPaletteOpen(false)
          setShortcutsHelpOpen(true)
        }}
      />}
      <KeyboardShortcutsHelp
        isOpen={shortcutsHelpOpen}
        onClose={() => setShortcutsHelpOpen(false)}
      />
      {assistantMounted && (
        <Suspense fallback={<EntoAssistantSkeleton />}>
          <EntoAssistant
            isOpen={assistantOpen}
            onClose={() => setAssistantOpen(false)}
            signals={signals.signals}
            signalTotal={signals.total}
            workspaceId={orgCtx?.org?.id}
          />
        </Suspense>
      )}
      <EntoAIProactiveChecker onSignals={onSignals} refreshKey={assistantOpen} />
      <Drawer open={recorderOpen} onClose={closeRecorder} dismissible={!recorderLocked}
        label="New meeting" className="bs-tokens bs-drawer-wide meeting-recorder-drawer" layer="top">
        <div className="bs-skin meeting-recorder-body">
          <Suspense fallback={<p role="status"><Signal tone="off">Loading recorder</Signal></p>}>
            <MeetingRecorder audioInputDeviceId={audioInputDeviceId} onRecorded={recorderRecorded}
              onCaptureChange={setRecorderLocked} onOpenMeeting={closeRecorder} />
          </Suspense>
        </div>
      </Drawer>
    </>
  )

  /* ── Bench Swiss shell (default style) ── */
  if (isBenchSwiss) {
    const goSettings = (section) => navigate('/settings', section ? { state: { section } } : undefined)
    const groups = [
      ...benchModules,
      { label: 'Tools', items: [
        { name: 'Search', href: '/search' },
        ...(isAdmin ? [{ name: 'Bot', href: '/bot' }] : []),
        { name: 'Ask Entomate', onSelect: toggleAssistant, note: proactiveSuggestion ? 'NEW' : undefined, noteIsNew: proactiveSuggestion, railHidden: true },
        { name: 'User Guide', href: '/guide', note: guideHasNew ? 'NEW' : undefined, noteIsNew: guideHasNew },
      ] },
    ]
    const role = orgCtx?.myRole ? orgCtx.myRole.charAt(0).toUpperCase() + orgCtx.myRole.slice(1) : 'Member'
    const workspace = orgCtx?.org?.name
    const shellUser = {
      name: user?.name || user?.email || 'Workspace',
      detail: workspace ? `${role} · ${workspace}` : (user?.email || role),
      avatarUrl: user?.avatar_url || null,
    }
    const changeTheme = (next) => {
      setThemeMode(next)
      settingsApi.updateUser({ theme_mode: next }).catch(() => { /* saved locally; DB sync is best-effort */ })
    }
    return (
      <>
        <BenchShell
          groups={groups}
          isActive={isActive}
          user={shellUser}
          isDark={isDark}
          onThemeChange={changeTheme}
          onSearch={() => setCommandPaletteOpen(true)}
          shortcutsHeld={shortcutsHeld}
          commandSearch={<CommandPalette toolbar isOpen={commandPaletteOpen} isAdmin={isAdmin}
            onOpen={() => setCommandPaletteOpen(true)} onClose={() => setCommandPaletteOpen(false)}
            onShowShortcuts={() => { setCommandPaletteOpen(false); setShortcutsHelpOpen(true) }} />}
          onRecord={openRecorder}
          onSettings={() => goSettings()}
          settingsActive={isActive('/settings')}
          menuItems={[
            { label: 'Profile', onSelect: () => goSettings('you') },
            { label: 'Workspace and team', onSelect: () => goSettings('workspace') },
            { label: 'Connected calendars', onSelect: () => goSettings('recording') },
            { label: 'Keyboard shortcuts', onSelect: () => setShortcutsHelpOpen(true), kbd: '?' },
          ]}
          onSignOut={handleSignOut}
          modKey={getModKey()}
          dock={benchDock}
          assistant={
            <EntoAssistantButton
              onClick={toggleAssistant}
              onVoice={voiceAssistant}
              isOpen={assistantOpen}
              proactiveCount={proactiveCount}
            />
          }
        >
          <Faceplate>
            {/* Pages reach shell overlays through the outlet context (Today's Ask Entomate key). */}
            {/* A page that breaks keeps the shell; navigating away clears it */}
            <ErrorBoundary scope="page" resetKey={location.pathname}>
              <Suspense fallback={<PageSkeleton />}>
                <Outlet context={shellOutlet} />
                <BootMark stage="page" />
              </Suspense>
            </ErrorBoundary>
          </Faceplate>
        </BenchShell>
        {overlays}
      </>
    )
  }

  return (
    <div className="app-shell min-h-screen transition-colors duration-300 hover-glow trans-slow" data-shortcuts-held={shortcutsHeld || undefined}>
      {/* Ambient background — Held Light: static crimson bloom (CSS, no rAF).
          Legacy: the animated neural canvas. */}
      {isHeldLight
        ? <div className="hl-bg" aria-hidden="true" />
        : <VCCanvas mode="neural" speed={50} density={95} opacity={0.9} />}

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
            <Logo variant="mark" size="sm" withText={true} />
            <button
              className="lg:hidden p-1 text-content-secondary hover:text-content-primary transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Grouped Navigation */}
          <nav className="nl-scroll">
            {navGroups.map((group) => {
              const visibleItems = group.items.filter((item) => !item.adminOnly || isAdmin)
              if (visibleItems.length === 0) return null
              return (
                <div key={group.label}>
                  <div className="nl-section">{group.label}</div>
                  {visibleItems.map((item) => {
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
                        <kbd className="bs-nav-peek">{shortcutLabel(navigationShortcut(item.href))}</kbd>
                      </NavLink>
                    )
                  })}
                </div>
              )
            })}
          </nav>

          {/* Footer: AI + Guide + Settings + User */}
          <div className="nl-footer">
            <EntoAssistantButton
              onClick={() => setAssistantOpen(prev => !prev)}
              onVoice={voiceAssistant}
              isOpen={assistantOpen}
              proactiveCount={proactiveCount}
            />

            <NavLink
              to="/guide"
              data-icon="guide"
              className={`nl-item ${isActive('/guide') ? 'active' : ''}`}
              onClick={() => { setSidebarOpen(false); dismissGuideNew() }}
            >
              <span className="nl-icon-box" style={{ position: 'relative' }}>
                <BookOpen className="w-4 h-4" />
                {guideHasNew && (
                  <span style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#FFB800',
                    border: '1.5px solid var(--bg0, #060606)',
                  }} />
                )}
              </span>
              <span>User Guide</span>
              <kbd className="bs-nav-peek">{shortcutLabel('mod+8')}</kbd>
              {guideHasNew && (
                <span style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: 4,
                  background: 'rgba(255,184,0,0.15)',
                  color: '#FFB800',
                  marginLeft: 'auto',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}>New</span>
              )}
            </NavLink>

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
              <kbd className="bs-nav-peek">{shortcutLabel('mod+,')}</kbd>
            </NavLink>

            <div className="nl-avatar-card">
              <div className="nl-avatar">
                {user?.avatar_url
                  ? <img src={user.avatar_url} alt="User avatar" />
                  : <User className="w-4 h-4" />
                }
                <span className="nl-avatar-status" />
              </div>
              <div className="nl-avatar-info">
                <span className="nl-avatar-name">
                  {user?.name || user?.email || 'Workspace'}
                </span>
                <span className="nl-avatar-role">
                  {user?.email || 'Free plan'}
                </span>
              </div>
              <button
                onClick={handleSignOut}
                className="nl-signout"
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
            background: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--b1)',
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
            <button className="btn btn-primary" onClick={openRecorder} aria-label="New meeting" aria-haspopup="dialog">
              <Mic className="w-4 h-4" />
              <span className="hidden sm:inline">New Meeting</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main ref={designStyle === 'classic' ? classicPageRef : undefined} className="p-4 lg:p-6" style={{ position: 'relative', zIndex: 1 }}>
          <ErrorBoundary scope="page" resetKey={location.pathname}>
            <Suspense fallback={<PageSkeleton />}>
              <Outlet context={isActive('/meetings') ? shellOutlet : recorderOutlet} />
              <BootMark stage="page" />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {overlays}
    </div>
  )
}
