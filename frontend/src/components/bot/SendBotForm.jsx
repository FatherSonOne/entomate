/**
 * Send the bot: paste a link, confirm consent, go. Used inline on the Bot
 * page and in the "Send a bot" drawer (Meetings, Today, phone). Invitees for
 * the opt-out email sit behind a disclosure; the bot's name is a workspace
 * setting, not a per-launch field. The consent line adapts to the
 * workspace's jurisdiction, with the full note behind "Why".
 */

import React, { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useOrgSafe } from '../../contexts/OrgContext'
import { settingsApi, botsApi } from '../../services/api'
import { Key, Switch, TextInput, TextArea } from '../bench'
import { BOT_LAUNCHED_EVENT } from '../../services/botView'
import MeetingProfileField from '../intelligence/MeetingProfileField'

const ADMIN_ROLES = ['owner', 'admin']

const PLATFORMS = [
  { value: 'meet', label: 'Meet' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'teams', label: 'Teams' },
]

export function detectPlatform(url) {
  const u = String(url || '').toLowerCase()
  if (u.includes('zoom.us')) return 'zoom'
  if (u.includes('teams.microsoft') || u.includes('teams.live')) return 'teams'
  return 'meet'
}

export function isMeetingUrl(url) {
  try {
    const parsed = new URL(String(url || '').trim())
    return parsed.protocol === 'https:' && parsed.hostname.includes('.')
  } catch {
    return false
  }
}

export function parseEmails(text) {
  return String(text || '').split(/[\n,;\s]+/).map((s) => s.trim().toLowerCase()).filter((s) => s.includes('@'))
}

const CONSENT = {
  permissive: {
    label: 'Everyone in this meeting has agreed to be recorded.',
    why: 'You confirm you have whatever consent your context needs. Entomate posts a notice in the meeting chat when the bot joins.',
  },
  two_party: {
    label: 'Every participant has explicitly agreed to be recorded.',
    why: 'Some US states (CA, FL, IL, MD, MA, MT, NV, NH, PA, WA) need all-party consent. The legal duty rests with you, not Entomate.',
  },
  gdpr: {
    label: 'I have a GDPR lawful basis, usually explicit consent, from every participant.',
    why: 'Needed when EU or UK participants may join. Keep a record of your lawful basis.',
  },
}

/** Plain words for a failed launch (the raw Recall message stays in the logs). */
function launchError(err) {
  const msg = String(err?.response?.data?.message || err?.message || '')
  if (err?.response?.data?.error === 'bot_hours_exhausted') return msg
  if (err?.response?.data?.error === 'invalid_intelligence_profile') return 'That intelligence profile is unavailable. Choose another or use General.'
  if (/consent/i.test(msg)) return 'Tick the consent line first.'
  if (/403|forbidden|insufficient role/i.test(msg)) return 'Only owners and admins can send the bot.'
  if (/invalid.*url|meeting_url/i.test(msg)) return 'That meeting link did not work. Copy it again from the invite.'
  return 'The bot could not be sent. Check the link and try again in a minute.'
}

export default function SendBotForm({ onLaunched, autoFocus = false }) {
  const orgCtx = useOrgSafe()
  const org = orgCtx?.org
  const canSend = ADMIN_ROLES.includes(orgCtx?.myRole)

  const [url, setUrl] = useState('')
  const [platform, setPlatform] = useState('meet')
  const [platformPicked, setPlatformPicked] = useState(false)
  const [consent, setConsent] = useState(false)
  const [emails, setEmails] = useState('')
  const [jurisdiction, setJurisdiction] = useState('permissive')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [profileId, setProfileId] = useState('')

  useEffect(() => {
    if (!org?.id || !canSend) return
    let cancelled = false
    settingsApi.getWorkspace(org.id)
      .then((res) => {
        const j = res?.data?.settings?.data_controls_json?.consent_jurisdiction || res?.settings?.data_controls_json?.consent_jurisdiction
        if (!cancelled && CONSENT[j]) setJurisdiction(j)
      })
      .catch(() => { /* default copy */ })
    return () => { cancelled = true }
  }, [org?.id, canSend])

  useEffect(() => {
    if (!platformPicked) setPlatform(detectPlatform(url))
  }, [url, platformPicked])

  const invitees = useMemo(() => parseEmails(emails), [emails])
  const copy = CONSENT[jurisdiction] || CONSENT.permissive
  const urlOk = isMeetingUrl(url)
  const ready = canSend && urlOk && consent && !sending && org?.id

  if (!canSend) {
    return <p className="bs-bot-note">Only owners and admins can send the bot.</p>
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!ready) return
    setSending(true)
    setError(null)
    const meetingId = crypto.randomUUID()
    try {
      const res = await botsApi.launch({
        workspaceId: org.id,
        meetingId,
        meetingUrl: url.trim(),
        platform,
        consentAcknowledged: true,
        participantEmails: invitees,
        ...(profileId ? { intelligenceProfileId: profileId } : {}),
      })
      window.dispatchEvent(new CustomEvent(BOT_LAUNCHED_EVENT))
      onLaunched?.({ sessionId: res?.sessionId, meetingId, attendees: res?.attendees || [] })
      setUrl(''); setConsent(false); setEmails(''); setPlatformPicked(false); setProfileId('')
    } catch (err) {
      setError(launchError(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <form className="bs-bot-form" onSubmit={submit} noValidate>
      <label className="bs-bot-field">
        <span className="bs-lbl">Meeting link</span>
        <TextInput
          type="url"
          inputMode="url"
          placeholder="https://meet.google.com/abc-defg-hij"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoFocus={autoFocus}
          aria-invalid={url.length > 0 && !urlOk}
        />
        {url.length > 8 && !urlOk && <span className="bs-bot-hint">Paste the full https:// link from the invite.</span>}
      </label>

      <div className="bs-bot-field">
        <span className="bs-lbl">Platform</span>
        <Switch
          label="Meeting platform"
          options={PLATFORMS}
          value={platform}
          onChange={(v) => { setPlatform(v); setPlatformPicked(true) }}
        />
      </div>

      <MeetingProfileField value={profileId} onChange={setProfileId} disabled={sending} />

      <details className="bs-bot-more">
        <summary>Invitees (optional){invitees.length > 0 && ` · ${invitees.length}`}</summary>
        <p className="bs-bot-hint">Each gets an email before the call with a link to opt out. People who opt out are left out of the captions and the transcript.</p>
        <TextArea
          rows={3}
          placeholder="dana@acme.com, sam@acme.com"
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          aria-label="Invitee emails"
        />
      </details>

      <div className="bs-bot-consent">
        <label className="bs-aj-consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>{copy.label}</span>
        </label>
        <details className="bs-bot-why">
          <summary>Why</summary>
          <p className="bs-bot-hint">{copy.why}</p>
        </details>
      </div>

      {error && <p className="bs-bot-note bs-bot-err" role="alert">{error}</p>}

      <div className="bs-bot-send">
        <Key type="submit" variant="primary" disabled={!ready}>
          {sending && <Loader2 className="animate-spin" aria-hidden="true" />}Send the bot
        </Key>
      </div>
    </form>
  )
}
