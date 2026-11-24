/**
 * Settings › Connections (Ledger pass, 2026-11-22). Merges the old Integrations and
 * System Status tabs: one row per service with an LED + word, and a Test all key.
 * Logos Vision / Pulse detail (EcosystemSettings) and Slack open in drawers.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { calendarApi, checkHealth, integrationsApi } from '../../services/api'
import { authFetch } from '../../services/authFetch'
import EcosystemSettings from '../EcosystemSettings'
import SlackSettings from './SlackSettings'
import CalendarConnectionSettings from './CalendarConnectionSettings'
import { Drawer, Key, Signal } from '../bench'
import type { SignalTone } from '../bench'
import { serviceState } from '../../services/settingsView'
import type { DrawerId, ServiceState } from '../../services/settingsView'

interface Health { services?: Record<string, unknown> }
interface Integration { configured?: boolean; provider?: string; status?: string }
interface IntegrationStatus { integrations?: Record<string, Integration | undefined> }
interface EcoStatus { logosVision?: boolean; pulse?: boolean }
interface CalStatus { configured?: boolean; connected?: boolean }

interface StatusData {
  health: Health | null
  integrations: Record<string, Integration | undefined>
  eco: EcoStatus | null
  cal: CalStatus | null
  checkedAt: Date
}

const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined) || ''

const TONE: Record<ServiceState, SignalTone> = { up: 'live', down: 'brand', unset: 'off', hold: 'off', unknown: 'off' }

interface Row {
  key: string
  name: string
  what: string
  state: ServiceState
  word: string
  action?: { label: string; onClick: () => void }
}

export interface ConnectionsSettingsProps {
  drawer: DrawerId | null
  onDrawer: (d: DrawerId | null) => void
  onCalendarChange: () => void
  calendarError: string | null
}

const clock = (d: Date): string => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export default function ConnectionsSettings({ drawer, onDrawer, onCalendarChange, calendarError }: ConnectionsSettingsProps): React.ReactElement {
  const [data, setData] = useState<StatusData | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [health, integ, eco, cal] = await Promise.all([
      (checkHealth() as Promise<Health>).catch(() => null),
      (integrationsApi.getStatus() as Promise<IntegrationStatus>).catch(() => ({ integrations: {} } as IntegrationStatus)),
      authFetch(`${API_BASE}/api/ecosystem/status`).then((r: Response) => r.json() as Promise<EcoStatus>).catch(() => null),
      (calendarApi.getStatus() as Promise<CalStatus>).catch(() => null),
    ])
    setData({ health, integrations: integ.integrations ?? {}, eco, cal, checkedAt: new Date() })
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const ai = data?.integrations.gemini
  const aiName = ai?.provider === 'openai' ? 'OpenAI' : ai?.provider === 'gemini' ? 'Gemini' : 'AI provider'
  const db = data?.health?.services?.database ?? data?.integrations.supabase?.status
  const word = (s: ServiceState, up: string): string => (
    s === 'up' ? up : s === 'down' ? 'Error' : s === 'unset' ? 'Not set up' : s === 'hold' ? 'On hold' : (loading ? 'Checking' : 'Unknown')
  )
  const st = (raw: unknown): ServiceState => (data ? serviceState(raw) : 'unknown')

  const base: Row[] = [
    { key: 'lv', name: 'Logos Vision', what: 'CRM task sync through the ecosystem bridge', state: st(data?.eco?.logosVision), word: '', action: { label: 'Manage', onClick: () => onDrawer('ecosystem') } },
    { key: 'pulse', name: 'Pulse', what: 'Team recaps and alerts through the ecosystem bridge', state: st(data?.eco?.pulse), word: '', action: { label: 'Manage', onClick: () => onDrawer('ecosystem') } },
    {
      key: 'cal', name: 'Google Calendar', what: 'Upcoming meetings, briefings and bot scheduling',
      state: st(data?.cal ? data.cal.connected : undefined),
      word: data?.cal?.configured && !data.cal.connected ? 'Not connected' : '',
      action: { label: 'Manage', onClick: () => onDrawer('calendar') },
    },
    { key: 'ai', name: aiName, what: 'Transcription and analysis', state: st(ai?.status), word: '' },
    { key: 'db', name: 'Database', what: 'Supabase · live query', state: st(db), word: '' },
    { key: 'slack', name: 'Slack', what: 'Two-way Slack waits on per-workspace connect', state: 'hold' as ServiceState, word: 'On hold', action: { label: 'Set up', onClick: () => onDrawer('slack') } },
  ]
  const rows: Row[] = base.map((r) => ({ ...r, word: r.word || word(r.state, r.key === 'ai' || r.key === 'db' ? 'Up' : 'Connected') }))

  return (
    <>
      <div className="bs-set-cnx bs-set-cnx--head" aria-hidden="true">
        <span className="bs-lbl">Service</span><span className="bs-lbl">Status</span><span className="bs-lbl bs-dt">Checked</span><span />
      </div>
      <ul className="bs-set-cnxs" aria-label="Connections" aria-busy={loading}>
        {rows.map((r) => (
          <li key={r.key} className="bs-set-cnx">
            <div className="bs-set-cnx-nm"><b>{r.name}</b><span>{r.what}</span></div>
            <Signal tone={TONE[r.state]}>{r.word}</Signal>
            <span className="bs-set-cnx-t bs-dt">{data ? clock(data.checkedAt) : '–'}</span>
            <span>{r.action && <Key size="sm" onClick={r.action.onClick}>{r.action.label}</Key>}</span>
          </li>
        ))}
      </ul>
      <div className="bs-set-keys"><Key size="sm" disabled={loading} onClick={() => { void load() }}>{loading ? 'Testing…' : 'Test all'}</Key></div>

      <Drawer open={drawer === 'ecosystem'} onClose={() => onDrawer(null)} label="Logos Vision and Pulse">
        <div className="bs-skin"><EcosystemSettings /></div>
      </Drawer>
      <Drawer open={drawer === 'calendar'} onClose={() => onDrawer(null)} label="Google Calendar">
        {drawer === 'calendar' && (
          <CalendarConnectionSettings
            status={data?.cal}
            oauthError={calendarError}
            onDisconnect={() => { onCalendarChange(); return load() }}
          />
        )}
      </Drawer>
      <Drawer open={drawer === 'slack'} onClose={() => onDrawer(null)} label="Slack">
        <p className="bs-set-note">Two-way Slack is on hold until each workspace can connect its own Slack. Recaps to a channel still work when the server has a Slack bot token.</p>
        <div className="bs-skin"><SlackSettings /></div>
      </Drawer>
    </>
  )
}
