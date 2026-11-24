import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { settingsApi } from '../services/api'
import { supabase } from '../services/supabaseClient'
import { useOrg } from '../contexts/OrgContext'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { usePermissions } from '../hooks/usePermissions'
import { TENANT_PLAN_LABELS } from '../constants/plans'
import { version } from '../../package.json'
import {
  Cell, Drawer, Grid, Key, Readout, Section, Signal, Tag, TextInput, TitleRule, Toggle, applyReduceMotion,
  Select,
} from '../components/bench'
import { smoothScrollBehavior } from '../components/bench/motion'
import AppearanceSettings, { STYLE_SCROLL_KEY } from '../components/settings/AppearanceSettings'
import RecordingSettings from '../components/settings/RecordingSettings'
import type { MeetingsJson } from '../components/settings/RecordingSettings'
import MeetingAgentsSettings from '../components/settings/MeetingAgentsSettings'
import ConnectionsSettings from '../components/settings/ConnectionsSettings'
import TeamSettings from '../components/settings/TeamSettings'
import PrivacySettings from '../components/settings/PrivacySettings'
import BillingSettings from '../components/settings/BillingSettings'
import DeleteOrgDialog from '../components/settings/DeleteOrgDialog'
import AgentPreferences from '../components/settings/AgentPreferences'
import { canAdmin } from '../components/settings/settingsTypes'
import type { AuthCtx, OrgCtx } from '../components/settings/settingsTypes'
import {
  SECTIONS, findSettings, initials, readUrlState, resolveSection, sectionDef, writeUrlState,
} from '../services/settingsView'
import type { DrawerId, SectionId, UrlState } from '../services/settingsView'

/**
 * Settings (route /settings), module 00. Direction A "Ledger" from the Settings Slate pass
 * (2026-11-22): one page, five numbered sections, every control inline, a contents column
 * with readouts. Billing, learned patterns, the ecosystem bridge, Slack, profile and invites
 * open in drawers. URL state: ?s=<section>, ?dr=<drawer>, ?q=<find>. Old tab names
 * (location.state.section, ?section=) map onto the sections via settingsView.LEGACY_SECTIONS.
 *
 * Cut in this pass (nothing read them): notification switches other than overdue email,
 * quiet hours, AI behaviour (summary detail, auto-assign threshold, sentiment), recording
 * quality, speaker output, transcription language, the About tab.
 */

interface NotificationsJson { email_overdue_reminder?: boolean }
interface UserSettings {
  theme_mode: string
  reduce_motion: boolean
  notifications_json: NotificationsJson
  meetings_json: MeetingsJson
}
type JsonColumn = 'notifications_json' | 'meetings_json'

interface SettingsApi {
  getUser: () => Promise<{ settings?: Partial<UserSettings> }>
  updateUser: (data: Partial<Record<keyof UserSettings, unknown>>) => Promise<unknown>
}
const userApi = settingsApi as unknown as SettingsApi

interface ThemeApi { setThemeMode: (mode: string) => void }
interface Permission { id: string; state: 'granted' | 'denied' | 'prompt' | 'unavailable' }
interface PermissionsApi { permissions: Permission[]; requestPermission: (id: string) => Promise<void> }

const DEFAULTS: UserSettings = { theme_mode: 'dark', reduce_motion: false, notifications_json: {}, meetings_json: {} }
const ROLE: Record<string, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' }
const PLAN_LABELS = TENANT_PLAN_LABELS as Record<string, string>

function sectionEl(id: SectionId): HTMLElement | null {
  return document.getElementById(`set-${id}`)
}

export default function Settings(): React.ReactElement {
  const location = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const url = readUrlState(params)
  const orgCtx = useOrg() as unknown as OrgCtx
  const { org, orgMembers, myRole } = orgCtx
  const { user, signOut } = useAuth() as unknown as AuthCtx
  const { setThemeMode } = useTheme() as unknown as ThemeApi
  const { permissions, requestPermission } = usePermissions() as unknown as PermissionsApi
  const admin = canAdmin(myRole)

  const [settings, setSettings] = useState<UserSettings>(DEFAULTS)
  const settingsRef = useRef<UserSettings>(DEFAULTS)
  useEffect(() => { settingsRef.current = settings }, [settings])
  const [current, setCurrent] = useState<SectionId>(url.section ?? 'you')
  const [deleteMode, setDeleteMode] = useState<'soft' | 'hard' | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileMsg, setProfileMsg] = useState<string | null>(null)
  const [calendarVersion, setCalendarVersion] = useState(0)
  const findRef = useRef<HTMLInputElement>(null)

  const setUrl = useCallback((next: Partial<UrlState>) => {
    setParams((prev) => writeUrlState(prev, next), { replace: true })
  }, [setParams])
  const openDrawer = useCallback((d: DrawerId | null) => {
    setParams((prev) => {
      const next = writeUrlState(prev, { drawer: d })
      next.delete('calendar_error')
      if (d !== 'learning') next.delete('agent')
      return next
    }, { replace: true })
  }, [setParams])

  // Load user settings, merged over defaults so nothing is ever undefined.
  useEffect(() => {
    let live = true
    userApi.getUser()
      .then((res) => {
        if (!live || !res?.settings) return
        setSettings((prev) => ({ ...prev, ...res.settings }))
        if (typeof res.settings.reduce_motion === 'boolean') applyReduceMotion(res.settings.reduce_motion)
      })
      .catch(() => { /* defaults keep the page usable */ })
    return () => { live = false }
  }, [])

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]): void => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    userApi.updateUser({ [key]: value }).catch(() => { /* saved locally; DB sync is best-effort */ })
  }
  const updateJson = (column: JsonColumn, key: string, value: unknown): void => {
    const next = { ...(settingsRef.current[column] as Record<string, unknown>), [key]: value }
    setSettings((prev) => ({ ...prev, [column]: next }))
    userApi.updateUser({ [column]: next }).catch(() => { /* best-effort */ })
  }

  // Old links pass location.state.section (a tab name). Move it into the URL, then clear the
  // state so a remount (style switch) doesn't jump back to it.
  useEffect(() => {
    const state = location.state as { section?: string } | null
    const legacy = resolveSection(state?.section)
    if (!legacy) return
    const p = writeUrlState(new URLSearchParams(location.search), { section: legacy.section, drawer: legacy.drawer ?? null })
    navigate(`${location.pathname}?${p.toString()}`, { replace: true, state: null })
  }, [location.state]) // eslint-disable-line react-hooks/exhaustive-deps

  // Back from Google Calendar sign-in (started on Bot auto-join).
  useEffect(() => {
    if (params.get('connected') === 'true' && !url.section) setUrl({ section: 'recording' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll on arrival. A style switch remounts this page: put the style picker back in view
  // (layout effect, so it lands before the crossfade captures the new view). Otherwise go to ?s=.
  const lastScrolled = useRef<string | null>(null)
  useLayoutEffect(() => {
    let styleSwitch = false
    try { styleSwitch = sessionStorage.getItem(STYLE_SCROLL_KEY) === '1'; sessionStorage.removeItem(STYLE_SCROLL_KEY) } catch { /* storage blocked */ }
    if (styleSwitch) {
      document.querySelector('[data-style-picker]')?.scrollIntoView({ block: 'center' })
      lastScrolled.current = url.section
      return
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!url.section || lastScrolled.current === url.section) return
    lastScrolled.current = url.section
    setCurrent(url.section)
    const id = url.section
    sectionEl(id)?.scrollIntoView({ block: 'start' })
    // Sections above load their data after mount and grow; settle on the target once more.
    const t = window.setTimeout(() => sectionEl(id)?.scrollIntoView({ block: 'start' }), 600)
    return () => window.clearTimeout(t)
  }, [url.section])

  // Opening the profile drawer from a link (?dr=profile) still starts with your name filled in.
  useEffect(() => {
    if (url.drawer === 'profile') { setProfileName(user?.name ?? ''); setProfileMsg(null) }
  }, [url.drawer, user?.name])

  // Contents column follows the section in view.
  useEffect(() => {
    const els = SECTIONS.map((s) => sectionEl(s.id)).filter((e): e is HTMLElement => e !== null)
    if (els.length === 0 || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => {
      const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      const id = top?.target.id.replace('set-', '')
      if (id && SECTIONS.some((s) => s.id === id)) setCurrent(id as SectionId)
    }, { rootMargin: '0px 0px -65% 0px' })
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [url.query])

  // "/" focuses Find a setting.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null
      if (e.key !== '/' || e.metaKey || e.ctrlKey || t?.closest('input, textarea, select, [contenteditable="true"]')) return
      e.preventDefault()
      findRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const jump = (section: SectionId, drawer?: DrawerId): void => {
    lastScrolled.current = null
    setUrl({ section, query: '', drawer: drawer ?? null })
    setCurrent(section)
    requestAnimationFrame(() => sectionEl(section)?.scrollIntoView({ block: 'start', behavior: smoothScrollBehavior() }))
  }

  const onThemeChange = (mode: string): void => {
    setThemeMode(mode)
    updateSetting('theme_mode', mode)
  }

  const saveProfile = async (): Promise<void> => {
    const name = profileName.trim()
    if (!name) { setProfileMsg('Enter a name.'); return }
    setProfileMsg('Saving…')
    const { error } = await supabase.auth.updateUser({ data: { name } })
    if (error) { setProfileMsg(error.message); return }
    setProfileMsg(null)
    openDrawer(null)
  }

  const results = findSettings(url.query)
  const push = permissions.find((p) => p.id === 'notifications')
  const role = ROLE[myRole ?? 'member'] ?? 'Member'
  const plan = PLAN_LABELS[org?.plan ?? 'free'] ?? 'Free'
  const n = orgMembers.length

  return (
    <div className="bs-set">
      <TitleRule
        title="Settings"
        meta={org ? `00 · ${org.name} · ${role}` : '00 · Settings'}
        actions={
          <div className="bs-set-find">
            <TextInput
              ref={findRef}
              type="search"
              aria-label="Find a setting"
              placeholder="Find a setting"
              value={url.query}
              onChange={(e) => setUrl({ query: e.target.value })}
              onKeyDown={(e) => {
                const first = results[0]
                if (e.key === 'Enter' && first) jump(first.section, first.drawer)
                if (e.key === 'Escape') setUrl({ query: '' })
              }}
            />
            <span className="bs-set-find-k" aria-hidden="true">/</span>
          </div>
        }
      />

      {url.query ? (
        <div className="bs-set-results" role="region" aria-label="Matching settings">
          <Section title={`${results.length} ${results.length === 1 ? 'match' : 'matches'}`} level={3} aside={<Key size="sm" onClick={() => setUrl({ query: '' })}>Clear</Key>} />
          {results.length === 0 && <p className="bs-set-note">Nothing called that. Try “mic”, “invite” or “retention”.</p>}
          <ul>
            {results.map((r) => (
              <li key={r.label}>
                <button type="button" className="bs-set-hit" onClick={() => jump(r.section, r.drawer)}>
                  <b>{r.label}</b>
                  <span className="bs-lbl">{sectionDef(r.section).number} {sectionDef(r.section).title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <div className="bs-set-jump">
            <Select
              label="Jump to section"
              value={current}
              onChange={(v) => jump(v as SectionId)}
              options={SECTIONS.map((s) => ({ value: s.id, label: s.title, hint: s.number }))}
            />
          </div>
          <Grid>
            <Cell span={8}>
              {/* ── 01 You ── */}
              <section id="set-you" className="bs-set-sec" aria-labelledby="set-you-h">
                <Section number="01" title={<span id="set-you-h">You</span>} />
                <div className="bs-set-row">
                  <div className="bs-set-who">
                    <span className="bs-set-avatar" aria-hidden="true">{initials(user?.name, user?.email)}</span>
                    <div><b>{user?.name || user?.email || 'You'}</b><span>{user?.email}{org ? ` · ${role}` : ''}</span></div>
                  </div>
                  <div className="bs-set-c">
                    <Key size="sm" onClick={() => openDrawer('profile')}>Edit profile</Key>
                    <Key size="sm" onClick={() => { void signOut() }}>Sign out</Key>
                  </div>
                </div>

                <div className="bs-set-sub"><span className="bs-h3">Notifications</span></div>
                <div className="bs-set-row bs-set-row--tg">
                  <div className="bs-set-l">
                    <b>Overdue task emails</b>
                    <span>One email a morning listing tasks assigned to you that are past due.</span>
                  </div>
                  <div className="bs-set-c">
                    <Toggle
                      label="Overdue task emails"
                      checked={settings.notifications_json.email_overdue_reminder !== false}
                      onChange={(on) => updateJson('notifications_json', 'email_overdue_reminder', on)}
                    />
                  </div>
                </div>
                <div className="bs-set-row">
                  <div className="bs-set-l">
                    <b>Browser alerts</b>
                    <span>Desktop alerts from this browser when Entomate isn’t in front.</span>
                  </div>
                  <div className="bs-set-c">
                    {push?.state === 'granted' && <Signal tone="live">Allowed</Signal>}
                    {push?.state === 'denied' && <Signal tone="brand">Blocked in this browser</Signal>}
                    {push?.state === 'unavailable' && <Signal tone="off">Not supported</Signal>}
                    {(push?.state === 'prompt' || !push) && (
                      <>
                        <Signal tone="off">Not allowed</Signal>
                        <Key size="sm" onClick={() => { void requestPermission('notifications') }}>Allow</Key>
                      </>
                    )}
                  </div>
                </div>
              </section>

              {/* ── 02 Appearance ── */}
              <section id="set-appearance" className="bs-set-sec" aria-label="Appearance">
                <Section number="02" title="Appearance" />
                <AppearanceSettings
                  reduceMotion={settings.reduce_motion}
                  onReduceMotion={(on: boolean) => { applyReduceMotion(on); updateSetting('reduce_motion', on) }}
                  onThemeChange={onThemeChange}
                />
              </section>

              {/* ── 03 Recording ── */}
              <section id="set-recording" className="bs-set-sec" aria-label="Recording">
                <Section number="03" title="Recording" />
                <RecordingSettings
                  meetingsJson={settings.meetings_json}
                  calendarVersion={calendarVersion}
                  onManageCalendar={() => jump('connections', 'calendar')}
                  onUpdate={(key, value) => updateJson('meetings_json', key, value)}
                />
              </section>

              {/* ── 04 Meeting agents ── */}
              <section id="set-agents" className="bs-set-sec" aria-label="Meeting agents">
                <Section number="04" title="Meeting agents" />
                <MeetingAgentsSettings />
                <div className="bs-set-row">
                  <div className="bs-set-l">
                    <b>What the agents learned</b>
                    <span>Review preferences suggested by repeated Owner and Priority corrections in this workspace.</span>
                  </div>
                  <div className="bs-set-c"><Key size="sm" onClick={() => openDrawer('learning')}>Review</Key></div>
                </div>
              </section>

              {/* ── 05 Connections ── */}
              <section id="set-connections" className="bs-set-sec" aria-label="Connections">
                <Section number="05" title="Connections" />
                <ConnectionsSettings
                  drawer={url.drawer}
                  onDrawer={openDrawer}
                  onCalendarChange={() => setCalendarVersion((current) => current + 1)}
                  calendarError={params.get('calendar_error')}
                />
              </section>

              {/* ── 06 Workspace ── */}
              <section id="set-workspace" className="bs-set-sec" aria-label="Workspace">
                <Section number="06" title="Workspace" />
                {org ? (
                  <>
                    <div className="bs-set-row">
                      <div className="bs-set-l">
                        <b>{org.name}</b>
                        <span className="bs-mono">{org.slug ? `${org.slug} · ` : ''}you are {role}</span>
                      </div>
                      <div className="bs-set-c">
                        <Tag>{plan}</Tag>
                        <Key size="sm" onClick={() => openDrawer('billing')}>Plan and billing</Key>
                      </div>
                    </div>
                    <TeamSettings inviteOpen={url.drawer === 'invite'} onInviteOpen={(o) => openDrawer(o ? 'invite' : null)} />
                    <PrivacySettings key={org.id} />
                    {admin && (
                      <div className="bs-set-danger">
                        <div className="bs-set-l">
                          <b>Archive or delete {org.name}</b>
                          <span>Archive hides the workspace and can be undone. Delete removes it for good. Your personal projects, tasks and automations stay.</span>
                        </div>
                        <div className="bs-set-c">
                          <Key size="sm" onClick={() => setDeleteMode('soft')}>Archive</Key>
                          {myRole === 'owner' && <Key size="sm" className="bs-set-warn" onClick={() => setDeleteMode('hard')}>Delete…</Key>}
                        </div>
                      </div>
                    )}
                  </>
                ) : <p className="bs-set-note">You’re not in a workspace yet.</p>}
              </section>

              <footer className="bs-set-foot">
                <span>Entomate {version}</span>
                <button type="button" className="bs-set-foot-link" onClick={() => jump('connections')}>Status</button>
              </footer>
            </Cell>

            <Cell span={4} rule desktopOnly>
              <div className="bs-set-side">
                <span className="bs-lbl bs-set-side-h">On this page</span>
                <nav aria-label="Settings sections">
                  <ul className="bs-set-contents">
                    {SECTIONS.map((s) => (
                      <li key={s.id}>
                        <a
                          href={`?s=${s.id}`}
                          aria-current={current === s.id ? 'location' : undefined}
                          onClick={(e) => { e.preventDefault(); jump(s.id) }}
                        >
                          <span className="bs-set-contents-n">{s.number}</span>{s.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
                {org && (
                  <div className="bs-set-readouts">
                    <Readout label="Team" value={n} context={n === 1 ? 'Just you so far' : `${n} people in ${org.name}`} />
                    <Readout label="Plan" value={plan} context="Change it under Plan and billing" />
                  </div>
                )}
              </div>
            </Cell>
          </Grid>
        </>
      )}

      {/* ── Drawers ── */}
      <Drawer
        open={url.drawer === 'profile'}
        onClose={() => openDrawer(null)}
        label="Profile"
        footer={<><Key onClick={() => openDrawer(null)}>Cancel</Key><Key variant="primary" onClick={() => { void saveProfile() }}>Save</Key></>}
      >
        <label className="bs-set-fld">
          <span className="bs-lbl">Name</span>
          <TextInput value={profileName} onChange={(e) => setProfileName(e.target.value)} autoFocus />
        </label>
        <div className="bs-set-fld">
          <span className="bs-lbl">Email</span>
          <span>{user?.email}</span>
          <span className="bs-set-help">From your sign-in. Change it with your sign-in provider.</span>
        </div>
        {profileMsg && <p className="bs-set-note" role="status">{profileMsg}</p>}
      </Drawer>

      <Drawer open={url.drawer === 'billing'} onClose={() => openDrawer(null)} label="Plan and billing">
        <div className="bs-skin"><BillingSettings /></div>
      </Drawer>

      <Drawer open={url.drawer === 'learning'} onClose={() => openDrawer(null)} label="What the agents learned">
        {org ? <AgentPreferences key={org.id} workspaceId={org.id} canReview={admin} initialAgent={params.get('agent') === 'priority' ? 'Priority' : 'Owner'} />
          : <p className="bs-set-note">Select a workspace to see its agent preferences.</p>}
      </Drawer>

      {org && (
        <DeleteOrgDialog
          orgName={org.name}
          mode={deleteMode ?? 'soft'}
          isOpen={deleteMode !== null}
          isLoading={deleteBusy}
          onCancel={() => setDeleteMode(null)}
          onConfirm={async () => {
            setDeleteBusy(true)
            try {
              if (deleteMode === 'soft') await orgCtx.softDeleteOrg(org.id)
              else await orgCtx.hardDeleteOrg(org.id)
              setDeleteMode(null)
            } catch { /* the dialog stays open; the org context reports the error */ } finally {
              setDeleteBusy(false)
            }
          }}
        />
      )}
    </div>
  )
}

