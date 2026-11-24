/**
 * Settings › Bot auto-join
 *
 * Sends the meeting bot to calls on your Google Calendar without a launch
 * step (feature audit 2026-11-22, rec 1). The backend
 * (services/calendarAutoJoin.js) schedules a bot ahead of time for
 * each qualifying event; this screen switches it on, picks the scope and
 * shows what it will do with the next day of events.
 * GET/PUT /api/calendar/auto-join.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { calendarApi } from '../../services/api'
import { useOrg } from '../../contexts/OrgContext'
import { Key, Select, Signal, Toggle } from '../bench'
import { lastCheckedLabel, toHealth } from '../../services/autoJoinHealth'

const SCOPES = [
  { id: 'organized', label: 'Meetings I organise' },
  { id: 'all', label: 'Every meeting with a video link' },
]

const LEAD_TIMES = Array.from({ length: 6 }, (_, n) => ({
  value: String(n),
  label: n === 0 ? 'At meeting start' : `${n} minute${n === 1 ? '' : 's'} early`,
}))

const PLATFORM = { meet: 'Google Meet', zoom: 'Zoom', teams: 'Teams' }

const REASON = {
  no_link: 'No video link',
  not_organizer: 'Someone else organises it',
  no_invitees: 'Nobody else invited',
  declined: 'You declined',
  cancelled: 'Cancelled',
  started: 'Already started',
  later: 'Later',
}

const BOT_STATUS = {
  pending: 'Bot scheduled',
  launching: 'Bot scheduled',
  joining: 'Bot joining',
  in_call: 'Bot in the call',
  timeout: 'Bot timed out',
  completed: 'Recorded',
  failed: 'Bot failed',
}

const timeFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })

function rowSignal(e, enabled) {
  if (e.botStatus) return { tone: ['failed', 'timeout'].includes(e.botStatus) ? 'brand' : 'live', text: BOT_STATUS[e.botStatus] || 'Bot scheduled' }
  if (!e.join) return { tone: 'off', text: REASON[e.reason] || 'Skipped' }
  return enabled ? { tone: 'ai', text: 'Bot will join' } : { tone: 'off', text: 'Would join' }
}

export default function CalendarAutoJoinSettings({ onManageCalendar }) {
  const { org, myRole } = useOrg()
  const canSend = myRole === 'owner' || myRole === 'admin'
  const [state, setState] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)
  const [consent, setConsent] = useState(false)

  const load = useCallback(async () => {
    try {
      // A partial response (no settings yet) must not crash Settings: fill the defaults.
      const res = (await calendarApi.getAutoJoin()) || {}
      setState({ ...res, settings: { enabled: false, scope: 'organized', lead_minutes: 0, ...(res.settings || {}) }, upcoming: Array.isArray(res.upcoming) ? res.upcoming : [] })
    } catch (err) {
      setError(err.message || 'Could not load auto-join settings')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const save = async (patch) => {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const settings = state.settings
      const body = {
        enabled: patch.enabled ?? settings.enabled,
        scope: patch.scope ?? settings.scope,
        orgId: org?.id,
        ...(patch.leadMinutes !== undefined ? { leadMinutes: patch.leadMinutes } : {}),
        ...(patch.enabled && !settings.consent_at ? { consentAcknowledged: consent } : {}),
      }
      const res = await calendarApi.updateAutoJoin(body)
      setNotice(
        body.enabled
          ? 'Auto-join settings saved. Invitees get an email with an opt-out link when a bot is scheduled.'
          : res.withdrawn ? `Off. ${res.withdrawn} scheduled bot${res.withdrawn === 1 ? '' : 's'} withdrawn.` : 'Auto-join is off. Settings saved.'
      )
      await load()
    } catch (err) {
      setError(err.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  if (error && !state) return <p className="bs-agents-note bs-agents-err" role="alert">{error}</p>
  if (!state) return <p className="bs-agents-note">Loading…</p>

  const { settings, connected, configured, botsConfigured, upcoming, previewError } = state
  const health = toHealth(state.health)
  const lastChecked = lastCheckedLabel(health.lastRunAt)
  const needsConsent = !settings.consent_at

  if (!configured || !botsConfigured) {
    return (
      <p className="bs-agents-note">
        Auto-join needs Google Calendar and the meeting bot set up on the server
        {!configured && ' (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)'}
        {!botsConfigured && ' (RECALL_API_KEY)'}.
      </p>
    )
  }

  return (
    <div className="bs-agents">
      <p className="bs-agents-note">
        The bot joins calls on your Google Calendar by itself, records and transcribes them, and the meeting shows up
        with its summary and action items. It only joins calls with a Google Meet, Zoom or Teams link and at least one
        other invitee, and never a meeting you declined.
      </p>

      <ul className="bs-agents-list">
        <li className="bs-agents-row">
          <div className="bs-agents-main">
            <div className="bs-agents-head">
              <span className="bs-h3">Google Calendar</span>
              <Signal tone={connected ? 'mint' : 'off'}>{connected ? 'Connected' : 'Not connected'}</Signal>
            </div>
            <p className="bs-agents-what">Auto-join reads the primary calendar of your connected account.</p>
          </div>
          <Key onClick={onManageCalendar}>{connected ? 'Manage Google Calendar' : 'Connect'}</Key>
        </li>

        <li className="bs-agents-row">
          <div className="bs-agents-main">
            <div className="bs-agents-head">
              <span className="bs-h3">Auto-join</span>
              <Signal tone={settings.enabled ? 'ai' : 'off'}>{settings.enabled ? 'On' : 'Off'}</Signal>
            </div>
            <div className="bs-agents-bar">
              <span className="bs-lbl" id="aj-scope">Join</span>
              <Select
                className="bs-agents-select"
                aria-labelledby="aj-scope"
                sheetLabel="Auto-join: which meetings"
                value={settings.scope}
                disabled={!connected || saving || !canSend}
                onChange={(v) => save({ scope: v })}
                options={SCOPES.map((s) => ({ value: s.id, label: s.label }))}
              />
            </div>
            <div className="bs-agents-bar">
              <span className="bs-lbl" id="aj-lead">Bot arrival</span>
              <Select
                className="bs-agents-select"
                aria-labelledby="aj-lead"
                sheetLabel="Bot arrival"
                value={String(settings.lead_minutes)}
                disabled={!connected || saving || !canSend}
                onChange={(v) => save({ leadMinutes: Number(v) })}
                options={LEAD_TIMES}
              />
            </div>
            {!settings.enabled && needsConsent && connected && canSend && (
              <label className="bs-aj-consent">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>
                  I’ll make sure the people I meet know the meeting is recorded. The bot also says so when it joins, and
                  invitees get an email with a link to opt out.
                </span>
              </label>
            )}
            {!canSend && <p className="bs-agents-what">Only workspace owners and admins can send the bot.</p>}
            {settings.enabled && (
              <p className="bs-agents-what" data-testid="aj-last-checked">
                {lastChecked ? `Calendar last checked ${lastChecked}.` : 'Not checked yet. It checks every few minutes and whenever you open Entomate.'}
                {health.missed.length > 0 && ` Missed today: ${health.missed.map((m) => m.title).join(', ')}.`}
              </p>
            )}
          </div>
          <Toggle
            checked={settings.enabled}
            disabled={!connected || saving || !canSend || (!settings.enabled && needsConsent && !consent)}
            label={settings.enabled ? 'Turn off auto-join' : 'Turn on auto-join'}
            onChange={(v) => save({ enabled: v })}
          />
        </li>
      </ul>

      {error && <p className="bs-agents-note bs-agents-err" role="alert">{error}</p>}
      {notice && <p className="bs-agents-note" role="status">{notice}</p>}

      {connected && (
        <section className="bs-aj-next" aria-labelledby="bs-aj-next-h">
          <h3 id="bs-aj-next-h" className="bs-lbl">Next 24 hours</h3>
          {previewError && <p className="bs-agents-note bs-agents-err">{previewError}</p>}
          {!previewError && upcoming.length === 0 && <p className="bs-agents-note">Nothing on your calendar.</p>}
          {upcoming.length > 0 && (
            <ul className="bs-aj-list">
              {upcoming.map((e) => {
                const sig = rowSignal(e, settings.enabled)
                return (
                  <li key={`${e.id}-${e.start}`} className="bs-aj-row">
                    <span className="bs-aj-time">{timeFmt.format(new Date(e.start))}</span>
                    <span className="bs-aj-title">
                      {e.title}
                      {e.platform && <span className="bs-aj-plat">{PLATFORM[e.platform]}</span>}
                    </span>
                    <Signal tone={sig.tone}>{sig.text}</Signal>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
