import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Moon, Search, Settings, Sun } from 'lucide-react'
import { Drawer } from '../Drawer'
import { Key } from '../Key'
import { Led } from '../Signal'
import { cx } from '../cx'

/* ============================================================
   Bench Swiss shell: patch-panel rail (desktop), slim toolbar on
   the case, one faceplate for the page, phone dock + nav sheet.
   Presentational: Layout.jsx owns routing, auth and app state.
   ============================================================ */

export interface ShellNavItem {
  /** Module number ("01"). Omit for tools that aren't modules. */
  no?: string
  name: string
  /** Route. Items without one call onSelect instead. */
  href?: string
  onSelect?: () => void
  /** Short mono note on the right (count, NEW). */
  note?: string
  /** Show the note in amber (something new). */
  noteIsNew?: boolean
}

export interface ShellNavGroup {
  label: string
  items: ReadonlyArray<ShellNavItem>
}

export interface ShellUser {
  name: string
  /** Second line in the profile menu (role · workspace). */
  detail: string
  avatarUrl?: string | null
}

export interface ShellMenuItem {
  label: string
  onSelect: () => void
  kbd?: string
}

export interface BenchShellProps {
  groups: ReadonlyArray<ShellNavGroup>
  isActive: (href: string) => boolean
  user: ShellUser
  isDark: boolean
  onThemeChange: (mode: 'light' | 'dark') => void
  onSearch: () => void
  onRecord: () => void
  onSettings: () => void
  settingsActive: boolean
  /** Profile menu items, top block. */
  menuItems: ReadonlyArray<ShellMenuItem>
  onSignOut: () => void
  /** "⌘" or "Ctrl". */
  modKey: string
  /** Dock routes: Today, Meetings, Tasks. */
  dock: ReadonlyArray<{ name: string; href: string }>
  children: React.ReactNode
}

const BRAND_MARK = '/brand/relay-orbits-128.webp'

function initials(name: string): string {
  const parts = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const second = parts[1]?.[0] ?? ''
  return (first + second).toUpperCase() || 'EN'
}

function useClock(): Date {
  const [now, setNow] = useState<Date>(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const up = (): void => setOnline(true)
    const down = (): void => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}

const DATE_FMT = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
const TIME_FMT = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })

/* ── Patch-panel rows ── */

interface PatchRowProps {
  item: ShellNavItem
  active: boolean
  onNavigate?: () => void
}

function PatchRow({ item, active, onNavigate }: PatchRowProps): React.ReactElement {
  const body = (
    <>
      <span className="bs-pi-n" aria-hidden="true">{item.no ?? ''}</span>
      <span className="bs-pi-name">{item.name}</span>
      <span className={cx('bs-pi-c', item.noteIsNew && 'bs-pi-new')}>{item.note ?? ''}</span>
      <span className="bs-pi-led" aria-hidden="true" />
    </>
  )
  if (item.href) {
    return (
      <Link to={item.href} className="bs-pi" aria-current={active ? 'page' : undefined} onClick={onNavigate}>
        {body}
      </Link>
    )
  }
  return (
    <button
      type="button"
      className="bs-pi"
      onClick={() => {
        onNavigate?.()
        item.onSelect?.()
      }}
    >
      {body}
    </button>
  )
}

function PatchPanel({ groups, isActive, onNavigate }: { groups: ReadonlyArray<ShellNavGroup>; isActive: (href: string) => boolean; onNavigate?: () => void }): React.ReactElement {
  return (
    <>
      {groups.map((g) => (
        <div key={g.label} role="group" aria-label={g.label}>
          <div className="bs-lbl" aria-hidden="true">{g.label}</div>
          {g.items.map((item) => (
            <PatchRow key={item.name} item={item} active={item.href ? isActive(item.href) : false} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </>
  )
}

/* ── Theme switch ── */

function ThemeSwitch({ isDark, onChange }: { isDark: boolean; onChange: (mode: 'light' | 'dark') => void }): React.ReactElement {
  return (
    <div className="bs-tsw" role="group" aria-label="Theme">
      <button type="button" aria-pressed={!isDark} onClick={() => onChange('light')} aria-label="Light">
        <Sun aria-hidden="true" strokeWidth={1.7} />
        <span>Light</span>
      </button>
      <button type="button" aria-pressed={isDark} onClick={() => onChange('dark')} aria-label="Dark">
        <Moon aria-hidden="true" strokeWidth={1.7} />
        <span>Dark</span>
      </button>
    </div>
  )
}

/* ── Profile key + menu ── */

function ProfileMenu({ user, items, onSignOut, onSettings, modKey }: {
  user: ShellUser
  items: ReadonlyArray<ShellMenuItem>
  onSignOut: () => void
  onSettings: () => void
  modKey: string
}): React.ReactElement {
  const [open, setOpen] = useState<boolean>(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const keyRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setOpen(false)
        keyRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus({ preventScroll: true })
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const onMenuKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const els = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
    const i = els.indexOf(document.activeElement as HTMLButtonElement)
    const next = els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length]
    next?.focus()
  }

  const pick = (fn: () => void) => (): void => {
    setOpen(false)
    fn()
  }

  return (
    <div className="bs-prof" ref={wrapRef}>
      <button
        ref={keyRef}
        type="button"
        className="bs-av"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="bs-avi" aria-hidden="true">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user.name)}
        </span>
        <span className="bs-av-name">{user.name}</span>
        <span className="bs-car" aria-hidden="true">▾</span>
      </button>
      <div ref={menuRef} className="bs-pmenu" role="menu" aria-label="Account" data-open={open} onKeyDown={onMenuKey}>
        <div className="bs-pmenu-who">
          <b>{user.name}</b>
          <span>{user.detail}</span>
        </div>
        {items.map((it) => (
          <button key={it.label} type="button" role="menuitem" className="bs-pmenu-item" tabIndex={open ? 0 : -1} onClick={pick(it.onSelect)}>
            {it.label}
            {it.kbd && <span className="bs-k">{it.kbd}</span>}
          </button>
        ))}
        <hr />
        <button type="button" role="menuitem" className="bs-pmenu-item" tabIndex={open ? 0 : -1} onClick={pick(onSettings)}>
          Settings<span className="bs-k">{modKey},</span>
        </button>
        <button type="button" role="menuitem" className="bs-pmenu-item" tabIndex={open ? 0 : -1} onClick={pick(onSignOut)}>
          Sign out
        </button>
      </div>
    </div>
  )
}

/* ── The shell ── */

export function BenchShell(props: BenchShellProps): React.ReactElement {
  const {
    groups, isActive, user, isDark, onThemeChange, onSearch, onRecord,
    onSettings, settingsActive, menuItems, onSignOut, modKey, dock, children,
  } = props
  const [navOpen, setNavOpen] = useState<boolean>(false)
  const now = useClock()
  const online = useOnline()

  const dockItem = (d: { name: string; href: string }): React.ReactElement => {
    const active = isActive(d.href)
    return (
      <Link key={d.href} to={d.href} className="bs-dock-item" aria-current={active ? 'page' : undefined}>
        <Led tone={active ? 'brand' : 'off'} />
        {d.name}
      </Link>
    )
  }
  const [d0, d1, d2] = dock

  return (
    <div className="bs-app">
      <a href="#bs-page" className="bs-sr">Skip to content</a>

      {/* Rail: the patch panel (desktop) */}
      <aside className="bs-rail" aria-label="Main navigation">
        <Link to="/dashboard" className="bs-brand" aria-label="Entomate, go to Today">
          <img src={BRAND_MARK} alt="" width={28} height={28} />
          entomate
          <span className="bs-ver" aria-hidden="true">EN-01</span>
        </Link>
        <Key className="bs-search" onClick={onSearch} kbd={`${modKey}K`} aria-label="Search or ask">
          <span className="bs-search-label">Search or ask</span>
        </Key>
        <nav className="bs-patch" aria-label="Modules">
          <PatchPanel groups={groups} isActive={isActive} />
        </nav>
        <button type="button" className="bs-recbox" onClick={onRecord}>
          <span className="bs-rec" aria-hidden="true" />
          <span>
            <b>Record</b>
            <span className="bs-lbl">{modKey}M to start</span>
          </span>
        </button>
      </aside>

      {/* Main: toolbar on the case, then the faceplate */}
      <div className="bs-main">
        <div className="bs-tbar">
          <Link to="/dashboard" className="bs-tbar-brand" aria-label="Entomate, go to Today">
            <img src={BRAND_MARK} alt="" width={22} height={22} />
            entomate
          </Link>
          <div className="bs-tbar-stat bs-lbl">
            <Led tone={online ? 'live' : 'off'} />
            <span>{online ? 'Online' : 'Offline'}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={now.toISOString()}>{DATE_FMT.format(now)} · {TIME_FMT.format(now)}</time>
          </div>
          <Key className="bs-ph-only" iconOnly onClick={onSearch} aria-label="Search or ask" icon={<Search aria-hidden="true" strokeWidth={1.6} />} />
          <ThemeSwitch isDark={isDark} onChange={onThemeChange} />
          <Key
            iconOnly
            onClick={onSettings}
            aria-label="Settings"
            aria-current={settingsActive ? 'page' : undefined}
            icon={<Settings aria-hidden="true" strokeWidth={1.6} />}
          />
          <ProfileMenu user={user} items={menuItems} onSignOut={onSignOut} onSettings={onSettings} modKey={modKey} />
        </div>

        <main id="bs-page" className="bs-page-wrap">
          {children}
        </main>
      </div>

      {/* Phone dock */}
      <nav className="bs-dock" aria-label="Quick navigation">
        {d0 && dockItem(d0)}
        {d1 && dockItem(d1)}
        <button type="button" className="bs-dock-rec" onClick={onRecord} aria-label="Record a meeting">
          <span className="bs-rec" aria-hidden="true" />
        </button>
        {d2 && dockItem(d2)}
        <button type="button" className="bs-dock-item" onClick={() => setNavOpen(true)} aria-haspopup="dialog" aria-expanded={navOpen}>
          <Led tone="off" />
          More
        </button>
      </nav>

      {/* Phone: full nav as a sheet */}
      <Drawer open={navOpen} onClose={() => setNavOpen(false)} label="All modules" hideEscHint>
        <nav className="bs-navsheet bs-patch" aria-label="All modules">
          <PatchPanel groups={groups} isActive={isActive} onNavigate={() => setNavOpen(false)} />
          <div role="group" aria-label="Account">
            <div className="bs-lbl" aria-hidden="true">Account</div>
            <PatchRow item={{ no: '00', name: 'Settings', href: '/settings' }} active={settingsActive} onNavigate={() => setNavOpen(false)} />
          </div>
        </nav>
      </Drawer>
    </div>
  )
}

export default BenchShell
