/**
 * Settings › Meeting agents
 *
 * The four meeting agents used to have their own page (the custom-agent
 * builder, removed 2026-11-22). They are features of Meetings, so their
 * settings live here: which agents run when a meeting ends, and how confident
 * an agent must be before its call is applied. Stored per workspace at
 * tenant_organizations.settings.meeting_agents (GET/PUT /api/settings/meeting-agents).
 * Every call an agent makes is shown on the action item with its reason.
 */

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { settingsApi } from '../../services/api'
import { useOrg } from '../../contexts/OrgContext'
import { Key, Select, Signal, Toggle } from '../bench'

const AGENTS = [
  { key: 'assignment', name: 'Owner', what: 'Gives an action item nobody owns to someone in the meeting.', bar: true },
  { key: 'priority', name: 'Priority', what: 'Raises or lowers an item’s priority.', bar: true },
  { key: 'deadline', name: 'Deadline', what: 'Fills in a due date when the meeting didn’t set one. Never changes a date someone said.', bar: false },
]
const BARS = [0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95]
const pct = (v) => `${Math.round(v * 100)}%`

export default function MeetingAgentsSettings() {
  const { org, myRole } = useOrg()
  const orgId = org?.id
  const canEdit = myRole === 'owner' || myRole === 'admin'
  const [settings, setSettings] = useState(null)
  const [saved, setSaved] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    if (!orgId) return
    let live = true
    settingsApi.getMeetingAgents(orgId)
      .then((res) => { if (live) { setSettings(res.settings); setSaved(res.settings) } })
      .catch((err) => { if (live) setError(err.message || 'Could not load meeting agent settings') })
    return () => { live = false }
  }, [orgId])

  const dirty = settings && saved && JSON.stringify(settings) !== JSON.stringify(saved)

  const update = (key, patch) => {
    setNotice(null)
    setSettings((s) => ({ ...s, [key]: { ...s[key], ...patch } }))
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await settingsApi.updateMeetingAgents(orgId, settings)
      setSettings(res.settings)
      setSaved(res.settings)
      setNotice('Saved. The next meeting uses these settings.')
    } catch (err) {
      setError(err.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  if (!orgId) return <p className="bs-agents-note">Join or create a workspace to set up meeting agents.</p>
  if (error && !settings) return <p className="bs-agents-note bs-agents-err" role="alert">{error}</p>
  if (!settings) return <p className="bs-agents-note">Loading…</p>

  return (
    <div className="bs-agents">
      <p className="bs-agents-note">
        These run on every meeting as soon as its action items are found, before your{' '}
        <Link to="/automations">automations</Link>. Each call shows on the action item with its reason and confidence.
        {!canEdit && ' Only workspace owners and admins can change them.'}
      </p>

      <ul className="bs-agents-list">
        {AGENTS.map((a) => {
          const cfg = settings[a.key] || {}
          return (
            <li key={a.key} className="bs-agents-row">
              <div className="bs-agents-main">
                <div className="bs-agents-head">
                  <span className="bs-h3">{a.name}</span>
                  <Signal tone={cfg.enabled ? 'ai' : 'off'}>{cfg.enabled ? (a.bar ? `On · ${pct(cfg.minConfidence)}` : 'On') : 'Off'}</Signal>
                </div>
                <p className="bs-agents-what">{a.what}</p>
                {a.bar && (
                  <div className="bs-agents-bar">
                    <span className="bs-lbl" id={`agent-bar-${a.key}`}>Apply when confidence is at least</span>
                    <Select
                      className="bs-agents-select"
                      aria-labelledby={`agent-bar-${a.key}`}
                      sheetLabel={`${a.name}: confidence`}
                      value={String(cfg.minConfidence)}
                      disabled={!canEdit || !cfg.enabled}
                      onChange={(v) => update(a.key, { minConfidence: Number(v) })}
                      options={BARS.map((b) => ({ value: String(b), label: pct(b) }))}
                    />
                  </div>
                )}
              </div>
              <Toggle
                checked={Boolean(cfg.enabled)}
                disabled={!canEdit}
                label={`${cfg.enabled ? 'Turn off' : 'Turn on'}: ${a.name} agent`}
                onChange={(v) => update(a.key, { enabled: v })}
              />
            </li>
          )
        })}
        <li className="bs-agents-row">
          <div className="bs-agents-main">
            <div className="bs-agents-head">
              <span className="bs-h3">Follow-up</span>
              <Signal tone="off">As a step</Signal>
            </div>
            <p className="bs-agents-what">
              Spots promises that didn’t become action items. It runs as the “Detect follow-ups” step: switch on the
              {' '}<Link to="/automations">Flag follow-ups nobody owns</Link> recipe to use it.
            </p>
          </div>
        </li>
      </ul>

      {error && <p className="bs-agents-note bs-agents-err" role="alert">{error}</p>}
      {notice && <p className="bs-agents-note" role="status">{notice}</p>}
      {canEdit && (
        <div className="bs-agents-keys">
          <Key disabled={!dirty || saving} onClick={() => setSettings(saved)}>Reset</Key>
          <Key variant="primary" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</Key>
        </div>
      )}
    </div>
  )
}
