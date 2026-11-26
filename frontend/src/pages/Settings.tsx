import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { ChevronRight, X } from 'lucide-react'
import { settingsApi } from '../services/api'
import { useOrg } from '../contexts/OrgContext'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { usePermissions } from '../hooks/usePermissions'
import { TENANT_PLAN_LABELS } from '../constants/plans'
import { version } from '../../package.json'
import {
  Drawer, Key, PHONE_QUERY, Signal, Tag, TextInput, TitleRule, Toggle, applyReduceMotion, useMediaQuery,
} from '../components/bench'
import AppearanceSettings from '../components/settings/AppearanceSettings'
import RecordingSettings from '../components/settings/RecordingSettings'
import type { MeetingsJson } from '../components/settings/RecordingSettings'
import MeetingAgentsSettings from '../components/settings/MeetingAgentsSettings'
import ConnectionsSettings from '../components/settings/ConnectionsSettings'
import TeamSettings from '../components/settings/TeamSettings'
import PrivacySettings from '../components/settings/PrivacySettings'
import BillingSettings from '../components/settings/BillingSettings'
import DeleteOrgDialog from '../components/settings/DeleteOrgDialog'
import AgentPreferences from '../components/settings/AgentPreferences'
import ProfileSettings from '../components/settings/ProfileSettings'
import { canAdmin } from '../components/settings/settingsTypes'
import type { AuthCtx, OrgCtx } from '../components/settings/settingsTypes'
import {
  SETTINGS_GROUPS, findSettings, readUrlState, resolveSection, sectionDef, sectionGroup, writeUrlState,
} from '../services/settingsView'
import type { DrawerId, SectionId, UrlState } from '../services/settingsView'

interface NotificationsJson { email_overdue_reminder?: boolean }
interface UserSettings {
  theme_mode: string
  reduce_motion: boolean
  notifications_json: NotificationsJson
  meetings_json: MeetingsJson
}

type JsonColumn = 'notifications_json' | 'meetings_json'
type NavState = { section?: string; settingsBack?: 'section' | 'detail' }

const userApi = settingsApi as unknown as {
  getUser: () => Promise<{ settings?: Partial<UserSettings> }>
  updateUser: (data: Partial<Record<keyof UserSettings, unknown>>) => Promise<unknown>
}

interface ThemeApi { setThemeMode: (mode: string) => void }
interface Permission { id: string; state: 'granted' | 'denied' | 'prompt' | 'unavailable' }
interface PermissionsApi { permissions: Permission[]; requestPermission: (id: string) => Promise<void> }

const DEFAULTS: UserSettings = { theme_mode: 'dark', reduce_motion: false, notifications_json: {}, meetings_json: {} }
const ROLE: Record<string, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' }
const PLAN_LABELS = TENANT_PLAN_LABELS as Record<string, string>

export default function Settings(): React.ReactElement {
  const location = useLocation()
  const navigate = useNavigate()
  const { closeSettings } = useOutletContext<{ closeSettings: () => void }>()
  const [params, setParams] = useSearchParams()
  const url = readUrlState(params)
  const state = location.state as NavState | null
  const isPhone = useMediaQuery(PHONE_QUERY)
  const orgCtx = useOrg() as unknown as OrgCtx
  const { org, myRole } = orgCtx
  const auth = useAuth() as unknown as AuthCtx
  const { setThemeMode } = useTheme() as unknown as ThemeApi
  const { permissions, requestPermission } = usePermissions() as unknown as PermissionsApi
  const admin = canAdmin(myRole)
  const role = ROLE[myRole ?? 'member'] ?? 'Member'
  const plan = PLAN_LABELS[org?.plan ?? 'free'] ?? 'Free'

  const [settings, setSettings] = useState<UserSettings>(DEFAULTS)
  const settingsRef = useRef<UserSettings>(DEFAULTS)
  useEffect(() => { settingsRef.current = settings }, [settings])
  const [deleteMode, setDeleteMode] = useState<'soft' | 'hard' | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [calendarVersion, setCalendarVersion] = useState(0)
  const findRef = useRef<HTMLInputElement>(null)
  const pageRef = useRef<HTMLElement>(null)
  const lastSection = useRef<SectionId>('profile')
  const active = url.section ?? (isPhone ? lastSection.current : 'profile')
  const activeDef = sectionDef(active)
  const activeGroup = sectionGroup(active)
  useLayoutEffect(() => {
    if (url.section) lastSection.current = url.section
  }, [url.section])

  const replaceUrl = (next: Partial<UrlState>) => {
    setParams((prev) => writeUrlState(prev, { section: url.section, drawer: url.drawer, ...next }),
      { replace: true, state })
  }

  const jump = useCallback((section: SectionId, drawer: DrawerId | null = null) => {
    if (url.section === section && url.drawer === drawer && !url.query) return
    setParams((prev) => {
      const next = writeUrlState(prev, { section, query: '', drawer })
      next.delete('calendar_error')
      next.delete('agent')
      return next
    }, { state: { settingsBack: drawer ? 'detail' : 'section' } satisfies NavState })
  }, [setParams, url.section, url.drawer, url.query])

  const openDrawer = useCallback((drawer: DrawerId | null) => {
    if (drawer) {
      jump(active, drawer)
    } else if (state?.settingsBack === 'detail') {
      navigate(-1)
    } else {
      setParams((prev) => {
        const next = writeUrlState(prev, { section: active, drawer: null })
        next.delete('calendar_error')
        next.delete('agent')
        return next
      }, { replace: true, state })
    }
  }, [active, jump, navigate, setParams, state])

  const closeSection = () => {
    if (state?.settingsBack === 'section') {
      navigate(-1)
    } else {
      setParams((prev) => {
        const next = writeUrlState(prev, { section: null, drawer: null })
        next.delete('connected')
        next.delete('calendar_error')
        next.delete('agent')
        return next
      }, { replace: true })
    }
  }

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

  // Older entry points use router state or return from Google with only ?connected.
  useEffect(() => {
    const legacy = resolveSection(state?.section)
    if (legacy) {
      setParams((prev) => writeUrlState(prev, { section: legacy.section, drawer: legacy.drawer ?? null }),
        { replace: true, state: null })
    } else if (params.get('connected') === 'true' && !url.section) {
      setParams((prev) => writeUrlState(prev, { section: 'recording' }), { replace: true, state })
    }
  }, [params, setParams, state, url.section])

  useLayoutEffect(() => {
    const page = pageRef.current
    if (page && page.getBoundingClientRect().top < 70) page.scrollIntoView({ block: 'start' })
  }, [active])

  // "/" focuses Find a setting while no sheet or dialog is open.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.key !== '/' || event.metaKey || event.ctrlKey || deleteMode || url.drawer || (isPhone && url.section) ||
          target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
      event.preventDefault()
      findRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteMode, isPhone, url.drawer, url.section])

  const push = permissions.find((permission) => permission.id === 'notifications')
  const results = findSettings(url.query)
  const noWorkspace = <p className="bs-set-note">Select a workspace to use these settings.</p>
  const sections: Record<SectionId, React.ReactNode> = {
    profile: <ProfileSettings key={auth.user?.id} {...auth} />,
    notifications: (
      <>
        <div className="bs-set-row bs-set-row--tg">
          <div className="bs-set-l">
            <b>Overdue task emails</b>
            <span>One email a morning listing tasks assigned to you that are past due.</span>
          </div>
          <div className="bs-set-c">
            <Toggle label="Overdue task emails" checked={settings.notifications_json.email_overdue_reminder !== false}
              onChange={(on) => updateJson('notifications_json', 'email_overdue_reminder', on)} />
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
      </>
    ),
    appearance: <AppearanceSettings
      reduceMotion={settings.reduce_motion}
      onReduceMotion={(on: boolean) => { applyReduceMotion(on); updateSetting('reduce_motion', on) }}
      onThemeChange={(mode: string) => { setThemeMode(mode); updateSetting('theme_mode', mode) }}
    />,
    recording: <RecordingSettings
      meetingsJson={settings.meetings_json}
      calendarVersion={calendarVersion}
      onManageCalendar={() => jump('connections', 'calendar')}
      onUpdate={(key, value) => updateJson('meetings_json', key, value)}
    />,
    agents: (
      <>
        <MeetingAgentsSettings />
        <div className="bs-set-row">
          <div className="bs-set-l">
            <b>What the agents learned</b>
            <span>Review preferences suggested by repeated Owner and Priority corrections in this workspace.</span>
          </div>
          <div className="bs-set-c"><Key size="sm" onClick={() => openDrawer('learning')}>Review</Key></div>
        </div>
        <Drawer open={url.drawer === 'learning'} onClose={() => openDrawer(null)} label="What the agents learned">
          {org ? <AgentPreferences key={org.id} workspaceId={org.id} canReview={admin}
            initialAgent={params.get('agent') === 'priority' ? 'Priority' : 'Owner'} /> : noWorkspace}
        </Drawer>
      </>
    ),
    connections: <ConnectionsSettings drawer={url.drawer} onDrawer={openDrawer}
      onCalendarChange={() => setCalendarVersion((current) => current + 1)} calendarError={params.get('calendar_error')} />,
    workspace: org ? (
      <>
        <div className="bs-set-row">
          <div className="bs-set-l">
            <b>{org.name}</b>
            <span className="bs-mono">{org.slug ? org.slug + ' · ' : ''}you are {role}</span>
          </div>
          <div className="bs-set-c"><Tag>{plan}</Tag></div>
        </div>
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
    ) : noWorkspace,
    people: <TeamSettings inviteOpen={admin && url.drawer === 'invite'} onInviteOpen={(open) => openDrawer(open ? 'invite' : null)} />,
    billing: <div className="bs-skin bs-set-billing"><BillingSettings /></div>,
    privacy: org ? <PrivacySettings key={org.id} /> : noWorkspace,
  }

  const navigation = (
    <nav className="bs-set-nav" aria-label="Settings sections">
      {SETTINGS_GROUPS.map((group) => (
        <div className="bs-set-nav-group" key={group.id}>
          <h2>{group.title}</h2>
          <ul>
            {group.sections.map((section) => (
              <li key={section.id}>
                <a href={'?s=' + section.id} aria-current={!isPhone && active === section.id ? 'page' : undefined}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                    event.preventDefault()
                    jump(section.id)
                  }}>
                  <span>
                    <b>{section.title}</b>
                    <span className="bs-set-nav-summary">{section.summary}</span>
                  </span>
                  <ChevronRight aria-hidden="true" size={16} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )

  return (
    <div className="bs-set">
      <TitleRule title="Settings" meta={org ? org.name + ' · ' + role : undefined}
        actions={
          <div className="bs-set-find">
            <TextInput ref={findRef} type="search" aria-label="Find a setting" placeholder="Find a setting"
              value={url.query} onChange={(event) => replaceUrl({ query: event.target.value })}
              onKeyDown={(event) => {
                const first = results[0]
                if (event.key === 'Enter' && first) jump(first.section, first.drawer)
                if (event.key === 'Escape') replaceUrl({ query: '' })
              }} />
            <span className="bs-set-find-k" aria-hidden="true">/</span>
          </div>
        }
      />
      {url.query.trim() ? (
        <section className="bs-set-results" aria-label="Matching settings">
          <div className="bs-set-sub">
            <span className="bs-h3" role="status">{results.length} {results.length === 1 ? 'match' : 'matches'}</span>
            <Key size="sm" onClick={() => { replaceUrl({ query: '' }); findRef.current?.focus() }}>Clear</Key>
          </div>
          {results.length ? (
            <ul>
              {results.map((result) => (
                <li key={result.label}>
                  <button type="button" className="bs-set-hit" onClick={() => jump(result.section, result.drawer)}>
                    <b>{result.label}</b>
                    <span className="bs-lbl">{sectionDef(result.section).title}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="bs-set-note">Nothing called that. Try “photo”, “invite” or “retention”.</p>}
        </section>
      ) : (
        <div className="bs-set-layout">
          {navigation}
          {!isPhone && (
            <section key={active} ref={pageRef} className="bs-set-page" aria-labelledby="settings-section-title">
              <header className="bs-set-page-header">
                <span className="bs-lbl">{activeGroup.title}</span>
                <h2 id="settings-section-title">{activeDef.title}</h2>
                <p className="bs-set-help">{activeDef.summary}</p>
              </header>
              {sections[active]}
            </section>
          )}
        </div>
      )}
      {isPhone && (
        <Drawer open={!!url.section && !url.query.trim()} onClose={closeSection} label={activeDef.title}
          className="bs-set-section-sheet" layer="underlay"
          footer={<Key onClick={closeSettings} icon={<X size={16} aria-hidden="true" />}>Close Settings</Key>}>
          <div className="bs-set" key={active}>
            <p className="bs-set-help bs-set-section-intro">{activeDef.summary}</p>
            {sections[active]}
          </div>
        </Drawer>
      )}
      <footer className="bs-set-foot">
        <span>Entomate {version}</span>
        <button type="button" className="bs-set-foot-link" onClick={() => jump('connections')}>System status</button>
      </footer>

      {org && (
        <DeleteOrgDialog orgName={org.name} mode={deleteMode ?? 'soft'} isOpen={deleteMode !== null} isLoading={deleteBusy}
          onCancel={() => setDeleteMode(null)}
          onConfirm={async () => {
            setDeleteBusy(true)
            try {
              if (deleteMode === 'soft') await orgCtx.softDeleteOrg(org.id)
              else await orgCtx.hardDeleteOrg(org.id)
              setDeleteMode(null)
            } catch { /* the dialog stays open; the org context reports the error */ }
            finally { setDeleteBusy(false) }
          }} />
      )}
    </div>
  )
}
