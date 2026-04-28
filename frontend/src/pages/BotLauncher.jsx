/**
 * BotLauncher — admin page that launches Meet Mate against a meeting URL.
 *
 * Replaces the PowerShell+curl+localStorage-token gymnastics we relied on
 * during P1.7 development. Form fields mirror the /api/admin/bots/launch
 * contract, including the P1.7 consent gate (Slice 1) and the optional
 * participantEmails list (Slice 2). Consent prompt language adapts to the
 * workspace's consent_jurisdiction setting (Slice 4).
 *
 * Auth: route is mounted under the protected layout. Component renders an
 * inline 403-style notice if the current user isn't owner/admin of the
 * workspace; the backend gates this independently.
 */

import React, { useEffect, useMemo, useState } from 'react'
import {
  Bot, Loader2, CheckCircle2, AlertCircle, AlertTriangle, RefreshCw, Square,
  Mail, ShieldCheck, ExternalLink, Copy, Info
} from 'lucide-react'
import { useOrg } from '../contexts/OrgContext'
import { settingsApi, botsApi } from '../services/api'

const ADMIN_ROLES = ['owner', 'admin']

const PLATFORMS = [
  { id: 'meet', label: 'Google Meet' },
  { id: 'zoom', label: 'Zoom' },
  { id: 'teams', label: 'Microsoft Teams' }
]

function detectPlatform(url) {
  if (!url) return 'meet'
  const u = url.toLowerCase()
  if (u.includes('zoom.us')) return 'zoom'
  if (u.includes('teams.microsoft') || u.includes('teams.live')) return 'teams'
  return 'meet'
}

function isValidMeetingUrl(url) {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname.length > 0
  } catch {
    return false
  }
}

function parseEmails(textarea) {
  return textarea
    .split(/[\n,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0)
}

const CONSENT_COPY = {
  permissive: {
    label: 'I confirm I have consent from all participants to record this meeting.',
    note: 'Default posture. The organizer attests they\'ve obtained whatever consent is required for their context.'
  },
  two_party: {
    label: 'I confirm I have explicit, all-party consent from every participant in this meeting.',
    note: 'Required for meetings where any participant may be in a US two-party-consent state (CA, FL, IL, MD, MA, MT, NV, NH, PA, WA). The legal obligation rests with you, not Entomate.'
  },
  gdpr: {
    label: 'I confirm I have a valid GDPR Article 6 lawful basis (typically explicit consent under Art. 6(1)(a)) from every participant.',
    note: 'Required for meetings that may include EU/UK participants. Document your lawful basis in your own records.'
  }
}

export default function BotLauncher() {
  const { org, myRole } = useOrg()
  const isAdmin = ADMIN_ROLES.includes(myRole)

  // Form state
  const [meetingUrl, setMeetingUrl] = useState('')
  const [platform, setPlatform] = useState('meet')
  const [platformOverridden, setPlatformOverridden] = useState(false)
  const [meetingId, setMeetingId] = useState(() => crypto.randomUUID())
  const [botName, setBotName] = useState('')
  const [emailsText, setEmailsText] = useState('')
  const [consent, setConsent] = useState(false)

  // Workspace context (for consent copy)
  const [jurisdiction, setJurisdiction] = useState('permissive')
  const [jurisdictionLoading, setJurisdictionLoading] = useState(true)

  // Submission + result
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [result, setResult] = useState(null) // {sessionId, recallBotId, attendees}
  const [stopping, setStopping] = useState(false)
  const [stopped, setStopped] = useState(false)
  const [stopError, setStopError] = useState(null)

  useEffect(() => {
    if (!org?.id) return
    let cancelled = false
    ;(async () => {
      try {
        setJurisdictionLoading(true)
        const res = await settingsApi.getWorkspace(org.id)
        if (cancelled) return
        const j = res?.data?.settings?.data_controls_json?.consent_jurisdiction
        if (j && CONSENT_COPY[j]) setJurisdiction(j)
      } catch {
        // Non-admin viewers won't be able to read workspace settings; fall
        // back to permissive copy. The backend gates the launch anyway.
      } finally {
        if (!cancelled) setJurisdictionLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [org?.id])

  // Auto-detect platform from URL until the user manually picks one.
  useEffect(() => {
    if (platformOverridden) return
    setPlatform(detectPlatform(meetingUrl))
  }, [meetingUrl, platformOverridden])

  const cleanEmails = useMemo(() => parseEmails(emailsText), [emailsText])
  const consentCopy = CONSENT_COPY[jurisdiction] || CONSENT_COPY.permissive

  const canSubmit = isAdmin
    && !submitting
    && isValidMeetingUrl(meetingUrl)
    && consent
    && org?.id

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await botsApi.launch({
        workspaceId: org.id,
        meetingId,
        meetingUrl: meetingUrl.trim(),
        platform,
        botName: botName.trim() || undefined,
        consentAcknowledged: true,
        participantEmails: cleanEmails
      })
      setResult(res?.data || res)
    } catch (err) {
      const msg = err?.response?.data?.message
        || err?.response?.data?.error
        || err?.message
        || 'Launch failed'
      setSubmitError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStop() {
    if (!result?.sessionId) return
    setStopping(true)
    setStopError(null)
    try {
      await botsApi.stop(result.sessionId, 'manual_stop_from_launcher_ui')
      setStopped(true)
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Stop failed'
      setStopError(msg)
    } finally {
      setStopping(false)
    }
  }

  function handleReset() {
    setResult(null)
    setSubmitError(null)
    setStopped(false)
    setStopError(null)
    setMeetingUrl('')
    setBotName('')
    setEmailsText('')
    setConsent(false)
    setMeetingId(crypto.randomUUID())
    setPlatformOverridden(false)
  }

  function copyToClipboard(text) {
    navigator.clipboard?.writeText(text).catch(() => {})
  }

  // ── 403 state ────────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="max-w-2xl">
        <PageHeader
          icon={Bot}
          title="Bot Launcher"
          subtitle="Launch Meet Mate into a meeting"
        />
        <div
          className="p-6 rounded-lg flex items-start gap-4"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--b1)' }}
        >
          <AlertTriangle className="w-5 h-5 mt-0.5" style={{ color: 'var(--accent-warning, #FFB800)' }} />
          <div>
            <h3 className="text-base font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              Admin role required
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Only workspace owners and admins can launch Meet Mate. Ask your
              workspace owner to grant you the admin role, or to launch the bot
              for you.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Main page ────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl">
      <PageHeader
        icon={Bot}
        title="Bot Launcher"
        subtitle="Launch Meet Mate into a Meet / Zoom / Teams meeting"
      />

      {!result ? (
        <form
          onSubmit={handleSubmit}
          className="p-6 rounded-lg space-y-5"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--b1)' }}
        >
          {/* Meeting URL */}
          <Field
            label="Meeting URL"
            required
            hint="The full https:// URL participants would click to join."
          >
            <input
              type="url"
              required
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://meet.google.com/abc-defg-hij"
              autoFocus
              style={inputStyle}
            />
          </Field>

          {/* Platform */}
          <Field
            label="Platform"
            hint={platformOverridden ? 'Manually overridden.' : 'Auto-detected from the URL. Click a row to override.'}
          >
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const isSelected = platform === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setPlatform(p.id); setPlatformOverridden(true) }}
                    className="px-4 py-2 rounded-md text-sm font-medium transition-all"
                    style={{
                      background: isSelected ? 'var(--accent-primary)' : 'var(--bg-base)',
                      color: isSelected ? '#fff' : 'var(--text-primary)',
                      border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--b1)'}`,
                      cursor: 'pointer'
                    }}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </Field>

          {/* Meeting ID (UUID) */}
          <Field
            label="Meeting ID"
            hint="Auto-generated UUID for our records. Edit only if you need to deduplicate against an existing row."
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
                style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: 13 }}
              />
              <button
                type="button"
                onClick={() => setMeetingId(crypto.randomUUID())}
                title="Regenerate"
                className="px-3 py-2 rounded-md"
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--b1)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </Field>

          {/* Bot name */}
          <Field
            label="Bot display name"
            hint="What participants see in the meeting roster. Leave blank for the default."
          >
            <input
              type="text"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="Meet Mate"
              maxLength={80}
              style={inputStyle}
            />
          </Field>

          {/* Participant emails */}
          <Field
            label="Participant emails"
            icon={Mail}
            hint="External attendees who should receive a pre-meeting opt-out email. Newline- or comma-separated. Your own email is filtered out automatically. Leave blank to skip."
          >
            <textarea
              value={emailsText}
              onChange={(e) => setEmailsText(e.target.value)}
              rows={4}
              placeholder="alice@example.com&#10;bob@example.com"
              style={{
                ...inputStyle,
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                resize: 'vertical'
              }}
            />
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              {cleanEmails.length === 0
                ? 'No attendees will receive an opt-out email.'
                : `${cleanEmails.length} attendee${cleanEmails.length === 1 ? '' : 's'} will receive an opt-out email when the bot launches.`}
            </p>
          </Field>

          {/* Consent gate */}
          <div
            className="p-4 rounded-md"
            style={{
              background: jurisdiction === 'permissive' ? 'var(--bg-base)' : 'rgba(255, 184, 0, 0.06)',
              border: `1px solid ${jurisdiction === 'permissive' ? 'var(--b1)' : 'rgba(255, 184, 0, 0.3)'}`
            }}
          >
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1"
                style={{ accentColor: 'var(--accent-primary)' }}
              />
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                  <span
                    className="text-sm font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    Consent acknowledgment
                    {!jurisdictionLoading && jurisdiction !== 'permissive' && (
                      <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                        ({jurisdiction === 'gdpr' ? 'GDPR' : 'all-party consent'} posture)
                      </span>
                    )}
                  </span>
                </span>
                <span className="block text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
                  {consentCopy.label}
                </span>
                <span className="block text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {consentCopy.note}
                </span>
              </span>
            </label>
          </div>

          {/* Submit error */}
          {submitError && (
            <div
              className="flex items-start gap-2 p-3 rounded-md text-sm"
              style={{
                background: 'rgba(239, 68, 68, 0.06)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--accent-danger, #ef4444)'
              }}
            >
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Workspace: <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{org?.id || '—'}</code>
            </p>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-6 py-3 rounded-md text-sm font-medium transition-all"
              style={{
                background: canSubmit ? 'var(--accent-primary)' : 'var(--bg-base)',
                color: canSubmit ? '#fff' : 'var(--text-muted)',
                border: `1px solid ${canSubmit ? 'var(--accent-primary)' : 'var(--b1)'}`,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Launching…
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4" />
                  Launch Meet Mate
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        // ── Result panel ─────────────────────────────────────────────────
        <div className="space-y-4">
          <div
            className="p-6 rounded-lg"
            style={{
              background: 'var(--bg-elevated)',
              border: `1px solid ${stopped ? 'var(--b1)' : 'rgba(16, 185, 129, 0.4)'}`
            }}
          >
            <div className="flex items-start gap-3 mb-4">
              {stopped ? (
                <Square className="w-5 h-5 mt-0.5" style={{ color: 'var(--text-muted)' }} />
              ) : (
                <CheckCircle2 className="w-5 h-5 mt-0.5" style={{ color: 'var(--accent-success, #10b981)' }} />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                  {stopped ? 'Bot stopped' : 'Bot launched'}
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {stopped
                    ? 'Recall has been told to leave the meeting. Status will reach `stopped` once the webhook fires.'
                    : 'Meet Mate is en route to the meeting. Status will progress: launching → joining → in_call → completed.'}
                </p>
              </div>
            </div>

            <ResultRow label="Session ID" value={result.sessionId} mono copy />
            <ResultRow label="Recall bot ID" value={result.recallBotId} mono copy />

            {/* Attendees */}
            {Array.isArray(result.attendees) && result.attendees.length > 0 && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--b1)' }}>
                <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Pre-meeting opt-out emails
                </h4>
                <div className="space-y-1">
                  {result.attendees.map((a) => (
                    <div
                      key={a.email}
                      className="flex items-center justify-between text-xs py-1.5"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      <span style={{ color: 'var(--text-secondary)' }}>{a.email}</span>
                      <AttendeeStatus status={a.status} error={a.error} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(result.attendees) && result.attendees.length === 0 && cleanEmails.length === 0 && (
              <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                No participant emails were provided. Skip the opt-out email step.
              </p>
            )}

            {/* Actions */}
            {!stopped && (
              <div className="mt-5 pt-4 flex flex-wrap gap-2" style={{ borderTop: '1px solid var(--b1)' }}>
                <button
                  type="button"
                  onClick={handleStop}
                  disabled={stopping}
                  className="px-4 py-2 rounded-md text-sm font-medium"
                  style={{
                    background: 'var(--bg-base)',
                    border: '1px solid var(--b1)',
                    color: 'var(--text-primary)',
                    cursor: stopping ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {stopping ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Stopping…
                    </>
                  ) : (
                    <>
                      <Square className="w-4 h-4" />
                      Stop bot
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(`curl ${window.location.origin}/api/admin/bots/${result.sessionId}/state -H "Authorization: Bearer $TOKEN"`)}
                  className="px-4 py-2 rounded-md text-sm"
                  style={{
                    background: 'var(--bg-base)',
                    border: '1px solid var(--b1)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Copy className="w-4 h-4" />
                  Copy curl for state
                </button>
              </div>
            )}

            {stopError && (
              <div
                className="flex items-start gap-2 p-3 rounded-md text-sm mt-4"
                style={{
                  background: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: 'var(--accent-danger, #ef4444)'
                }}
              >
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{stopError}</span>
              </div>
            )}
          </div>

          {/* Reset */}
          <button
            type="button"
            onClick={handleReset}
            className="text-sm"
            style={{
              color: 'var(--accent-primary)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0
            }}
          >
            ← Launch another bot
          </button>
        </div>
      )}

      {/* Help footer */}
      <div className="mt-6">
        <div
          className="p-4 rounded-lg flex items-start gap-3 text-xs"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--b1)',
            color: 'var(--text-secondary)'
          }}
        >
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />
          <div>
            Consent posture is set in{' '}
            <a href="/settings" style={{ color: 'var(--accent-primary)' }}>
              Settings → Data &amp; Privacy
            </a>
            . The opt-out email + retention policies apply to every launch.
            Per-bot status updates are recorded automatically via the Recall
            webhook.
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  background: 'var(--bg-base)',
  border: '1px solid var(--b1)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-body)',
  fontSize: 14
}

function PageHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <div
        className="flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center"
        style={{ background: 'var(--accent-soft)' }}
      >
        <Icon className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <h1
          className="text-2xl font-semibold mb-1"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
        >
          {title}
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {subtitle}
        </p>
      </div>
    </div>
  )
}

function Field({ label, icon: Icon, hint, required, children }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />}
        <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {label}
          {required && <span style={{ color: 'var(--accent-primary)' }}>{' *'}</span>}
        </label>
      </div>
      {children}
      {hint && (
        <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {hint}
        </p>
      )}
    </div>
  )
}

function ResultRow({ label, value, mono, copy }) {
  return (
    <div className="flex items-center gap-3 py-2 text-sm">
      <span style={{ color: 'var(--text-muted)', minWidth: 100 }}>{label}</span>
      <code
        className="flex-1 min-w-0 truncate"
        style={{
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)',
          fontSize: mono ? 12 : 13,
          color: 'var(--text-primary)',
          background: 'var(--bg-base)',
          padding: '4px 8px',
          borderRadius: 4,
          border: '1px solid var(--b1)'
        }}
      >
        {value}
      </code>
      {copy && (
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(value).catch(() => {})}
          title="Copy"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 4
          }}
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

function AttendeeStatus({ status, error }) {
  const styles = {
    sent: { color: 'var(--accent-success, #10b981)', label: 'sent' },
    failed: { color: 'var(--accent-danger, #ef4444)', label: 'failed' },
    skipped: { color: 'var(--text-muted)', label: 'skipped' }
  }
  const s = styles[status] || styles.skipped
  return (
    <span
      title={error || (status === 'skipped' ? 'RESEND_API_KEY likely unset' : status)}
      style={{
        color: s.color,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        fontWeight: 600
      }}
    >
      {s.label}
    </span>
  )
}
