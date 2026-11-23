import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { meetingsApi } from '../../services/api'
import cache from '../../services/apiCache'
import { useToast } from '../vc/ToastProvider'
import { Key, Led, Section, Signal, Toggle } from '../bench'
import {
  addRecipients, canEdit, normalizeFollowUp, recipientLabel, sendBlocker, sendingView, SOURCE_LABEL,
  type FollowUpData, type FollowUpInclude, type Recipient,
} from '../../services/followUpView'

/**
 * Follow-up tab on the meeting page (Slate pick C "Letter", 2026-11-23).
 * The email is drawn as the letter itself and edited in place. It goes out on
 * its own 20 minutes after the meeting unless someone edits or stops it; the
 * Sending block says when. Data: GET/PUT /api/meetings/:id/follow-up,
 * POST .../send and .../stop, PUT /api/meetings/follow-up/auto-send.
 */

interface ToastApi {
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
}

interface FollowUpPatch {
  recipients?: Recipient[]
  subject?: string
  opening?: string
  signoff?: string
  include?: Partial<FollowUpInclude>
}

export interface FollowUpState {
  data: FollowUpData | null
  loading: boolean
  loadError: string | null
  retry: () => Promise<void>
  busy: 'save' | 'send' | 'stop' | 'auto' | null
  save: (patch: FollowUpPatch) => Promise<void>
  send: () => Promise<void>
  stop: () => Promise<void>
  setAutoSend: (enabled: boolean) => Promise<void>
}

/** The server's own words when it gave any (409/422), else the client's. */
function errorText(err: unknown): string {
  const e = err as { message?: string; originalError?: { response?: { data?: { error?: unknown } } } }
  const own = e?.originalError?.response?.data?.error
  return typeof own === 'string' && own ? own : e?.message || 'Something went wrong.'
}

/**
 * Loads the follow-up once the meeting has minutes. While one is scheduled it
 * reads again shortly after its send time so the tab flips to Sent.
 */
export function useFollowUp(meetingId: string, ready: boolean): FollowUpState {
  const toast = useToast() as ToastApi
  const [data, setData] = useState<FollowUpData | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState<FollowUpState['busy']>(null)
  const path = `/meetings/${meetingId}/follow-up`
  const scope = useRef({ meetingId, ready, active: false, read: 0 })
  const isCurrent = useCallback((s: typeof scope.current) => s.active && scope.current === s, [])

  // Retire the previous meeting before paint, including its pending callbacks.
  useLayoutEffect(() => {
    const current = { meetingId, ready, active: true, read: 0 }
    scope.current = current
    setData(null)
    setLoadError(null)
    setLoading(false)
    setBusy(null)
    return () => { current.active = false }
  }, [meetingId, ready])

  const load = useCallback(async (quiet = false) => {
    const current = scope.current
    if (!isCurrent(current) || current.meetingId !== meetingId || !current.ready) return
    const request = ++current.read
    const latest = (): boolean => isCurrent(current) && current.read === request
    if (!quiet) setLoading(true)
    try {
      cache.invalidate(path)
      const reply = await meetingsApi.followUp(meetingId)
      if (!latest()) return
      setData(normalizeFollowUp(reply))
      setLoadError(null)
    } catch (err) {
      if (latest()) setLoadError(errorText(err))
    } finally {
      if (latest()) setLoading(false)
    }
  }, [meetingId, path, isCurrent])

  const retry = useCallback(() => load(), [load])

  useEffect(() => { if (ready) load() }, [ready, load])

  const sendAt = data?.row?.status === 'scheduled' ? data.row.sendAt : null
  useEffect(() => {
    if (!sendAt) return undefined
    const wait = new Date(sendAt).getTime() - Date.now() + 90 * 1000
    if (!Number.isFinite(wait) || wait > 30 * 60 * 1000) return undefined
    const t = window.setTimeout(() => load(true), Math.max(wait, 15 * 1000))
    return () => window.clearTimeout(t)
  }, [sendAt, load])

  const run = useCallback(async (kind: NonNullable<FollowUpState['busy']>, call: () => Promise<unknown>, done?: string) => {
    const current = scope.current
    if (!isCurrent(current) || current.meetingId !== meetingId || !current.ready) return
    setBusy(kind)
    try {
      const reply = await call()
      if (!isCurrent(current)) return
      cache.invalidate(path)
      setData(normalizeFollowUp(reply))
      if (done) toast.success(done)
    } catch (err) {
      if (!isCurrent(current)) return
      toast.error(kind === 'send' ? 'Not sent' : 'Not saved', errorText(err))
      load(true)
    } finally {
      if (isCurrent(current)) setBusy(null)
    }
  }, [meetingId, path, toast, load, isCurrent])

  const save = useCallback((patch: FollowUpPatch) => run('save', () => meetingsApi.saveFollowUp(meetingId, patch)), [run, meetingId])
  const send = useCallback(() => run('send', () => meetingsApi.sendFollowUp(meetingId), 'Follow-up sent'), [run, meetingId])
  const stop = useCallback(() => run('stop', () => meetingsApi.stopFollowUp(meetingId), 'Stopped. It will not go out on its own.'), [run, meetingId])
  const setAutoSend = useCallback(async (enabled: boolean) => {
    const current = scope.current
    if (!isCurrent(current) || current.meetingId !== meetingId || !current.ready) return
    setBusy('auto')
    try {
      await meetingsApi.setFollowUpAutoSend(enabled)
      if (!isCurrent(current)) return
      setData((d) => (d ? { ...d, autoSend: enabled } : d))
    } catch (err) {
      if (isCurrent(current)) toast.error('Not saved', errorText(err))
    } finally {
      if (isCurrent(current)) setBusy(null)
    }
  }, [meetingId, toast, isCurrent])

  return { data, loading, loadError, retry, busy, save, send, stop, setAutoSend }
}

/** A field that saves on blur when its text changed. */
function EditableText({
  value, onSave, disabled, label, multiline, className,
}: { value: string; onSave: (v: string) => void; disabled: boolean; label: string; multiline?: boolean; className?: string }): React.ReactElement {
  const [text, setText] = useState(value)
  useEffect(() => { setText(value) }, [value])
  const commit = (): void => { if (text.trim() !== value.trim()) onSave(text) }
  if (multiline) {
    return (
      <textarea
        aria-label={label}
        className={`bs-fu-ed bs-fu-ed-area ${className ?? ''}`}
        value={text}
        disabled={disabled}
        rows={Math.max(2, text.split('\n').length)}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
      />
    )
  }
  return (
    <input
      aria-label={label}
      className={`bs-fu-ed ${className ?? ''}`}
      value={text}
      disabled={disabled}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    />
  )
}

/** The To line: one chip per person, × to remove, a field to add more. */
function ToLine({ state, editable }: { state: FollowUpState; editable: boolean }): React.ReactElement {
  const row = state.data?.row
  const [typed, setTyped] = useState('')
  const [bad, setBad] = useState<string[]>([])
  const list = row?.recipients ?? []
  const add = (): void => {
    if (!typed.trim()) return
    const out = addRecipients(list, typed)
    setBad(out.rejected)
    if (out.list.length !== list.length) state.save({ recipients: out.list })
    setTyped(out.rejected.join(', '))
  }
  return (
    <div className="bs-fu-to">
      {list.map((r) => (
        <span key={r.email} className="bs-fu-chip" title={r.email}>
          <span className="bs-fu-chip-name">{recipientLabel(r)}</span>
          <small>{SOURCE_LABEL[r.source]}</small>
          {editable && (
            <button
              type="button"
              aria-label={`Remove ${recipientLabel(r)}`}
              onClick={() => state.save({ recipients: list.filter((x) => x.email !== r.email) })}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {editable && (
        <input
          className="bs-fu-add"
          aria-label="Add a person by email"
          placeholder={list.length ? '+ Add' : 'Add an email'}
          value={typed}
          onChange={(e) => { setTyped(e.target.value); setBad([]) }}
          onBlur={add}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }}
        />
      )}
      {!editable && list.length === 0 && <span className="bs-sub">Nobody yet</span>}
      {bad.length > 0 && <span className="bs-fu-bad" role="alert">Not an email: {bad.join(', ')}</span>}
    </div>
  )
}

/** The letter: To, Subject, the opening (an agent wrote it), Decided, Who is on what, Next, sign-off. */
export function FollowUpLetter({ state }: { state: FollowUpState }): React.ReactElement {
  const data = state.data
  const loadStatus = state.loadError ? (
    <div className="bs-fu-wait" role="alert" aria-busy={state.loading}>
      <p className="bs-sub">{data?.row ? 'The follow-up could not be refreshed. Showing the last loaded draft.' : 'The follow-up could not be loaded.'}</p>
      <p className="bs-sub">{state.loadError}</p>
      <Key size="sm" onClick={state.retry} disabled={state.loading || state.busy !== null}>
        {state.loading ? 'Retrying…' : 'Retry'}
      </Key>
    </div>
  ) : null
  if (!data?.row && loadStatus) return loadStatus
  if (!data) return <p className="bs-sub bs-fu-wait">Drafting the follow-up…</p>
  const row = data.row
  if (!row) return <p className="bs-sub bs-fu-wait">The follow-up is drafted as soon as the minutes are ready.</p>
  const editable = canEdit(data)
  const p = data.parts
  const inc = row.include
  return (
    <>
      {loadStatus}
    <article className="bs-fu-paper" aria-label="Follow-up email">
      <div className="bs-fu-hdr">
        <span className="bs-lbl">To</span>
        <ToLine state={state} editable={editable} />
        <span className="bs-lbl">Subject</span>
        <EditableText label="Subject" value={row.subject} disabled={!editable} onSave={(v) => state.save({ subject: v })} className="bs-fu-subject" />
      </div>
      <div className="bs-fu-letter">
        {!row.editedAt && row.status !== 'sent' && (
          <div className="bs-fu-ai"><Led tone="ai" />Opening written by Entomate · edit it</div>
        )}
        <EditableText label="Opening" multiline value={row.opening} disabled={!editable} onSave={(v) => state.save({ opening: v })} />
        {inc.summary && p.summary && (<><h4>Summary</h4><p>{p.summary}</p></>)}
        {inc.decisions && p.decisions.length > 0 && (
          <>
            <h4>Decided</h4>
            <ul className="bs-fu-dec">{p.decisions.map((d) => <li key={d}><span className="bs-fu-tick" aria-hidden="true" />{d}</li>)}</ul>
          </>
        )}
        {inc.items && p.items.length > 0 && (
          <>
            <h4>Who is on what</h4>
            {p.items.map((i) => (
              <div key={`${i.title}-${i.owner}`} className="bs-fu-who">
                <span>{i.title}</span><span className="bs-fu-o">{i.owner || ''}</span><span className="bs-fu-d">{i.due || ''}</span>
              </div>
            ))}
          </>
        )}
        {inc.next && row.nextMeeting && (
          <><h4>Next</h4><p>{row.nextMeeting.title}{row.nextMeeting.when ? ` · ${row.nextMeeting.when}` : ''}</p></>
        )}
        <EditableText label="Sign-off" multiline value={row.signoff} disabled={!editable} onSave={(v) => state.save({ signoff: v })} className="bs-fu-signoff" />
        <p className="bs-fu-foot">Sent by Entomate. Replies go to you. Private notes are never included.</p>
      </div>
    </article>
    </>
  )
}

/** When it goes, in one block: the LED + word, the time, Stop. */
export function FollowUpSending({ state }: { state: FollowUpState }): React.ReactElement | null {
  const data = state.data
  if (!data) return null
  const v = sendingView(data)
  const blocker = data.row ? sendBlocker(data) : null
  return (
    <div className="bs-fu-auto" role="status">
      <Signal tone={v.tone}>{v.word}</Signal>
      {v.time && <div className="bs-fu-big">{v.time}</div>}
      <p className="bs-sub">{v.sub}</p>
      {blocker && data.row && !['sent', 'sending'].includes(data.row.status) && blocker !== 'Add at least one person.' && (
        <p className="bs-sub bs-fu-why">{blocker}</p>
      )}
      {v.canStop && data.canSend && (
        <div className="bs-fu-keys">
          <Key size="sm" onClick={state.stop} disabled={state.busy !== null}>{state.busy === 'stop' ? 'Stopping' : 'Stop'}</Key>
        </div>
      )}
    </div>
  )
}

const INCLUDES: { key: keyof FollowUpInclude; label: string }[] = [
  { key: 'decisions', label: 'Decisions' },
  { key: 'items', label: 'Who is on what' },
  { key: 'next', label: 'Next meeting' },
  { key: 'summary', label: 'Summary' },
  { key: 'copy', label: 'Send me a copy' },
]

/** Include ticks and the per-person switch. */
export function FollowUpOptions({ state }: { state: FollowUpState }): React.ReactElement | null {
  const data = state.data
  if (!data?.row) return null
  const row = data.row
  const editable = canEdit(data)
  return (
    <>
      <div>
        <Section title="Includes" level={3} />
        <div className="bs-fu-opts">
          {INCLUDES.filter((o) => o.key !== 'next' || row.nextMeeting).map((o) => (
            <label key={o.key}>
              <input
                type="checkbox"
                className="bs-check"
                checked={row.include[o.key]}
                disabled={!editable || state.busy !== null}
                onChange={(e) => state.save({ include: { [o.key]: e.target.checked } })}
              />
              {o.label}
            </label>
          ))}
        </div>
      </div>
      <div>
        <Section title="Send on their own" level={3} />
        <div className="bs-fu-switch">
          <Toggle
            checked={data.autoSend}
            disabled={state.busy !== null}
            label="Send my follow-ups on their own"
            onChange={state.setAutoSend}
          />
          <span className="bs-sub">
            {data.autoSend ? 'On: new follow-ups go 20 minutes after the meeting.' : 'Off: every follow-up waits for Send now.'}
          </span>
        </div>
      </div>
    </>
  )
}

/** The context column while the Follow-up tab is open. */
export function FollowUpContext({ state }: { state: FollowUpState }): React.ReactElement {
  const row = state.data?.row
  const list = row ? (row.status === 'sent' && row.sentTo.length ? row.sentTo : row.recipients) : []
  return (
    <div className="bs-mtg-context">
      <div>
        <Section title="Sending" level={3} />
        <FollowUpSending state={state} />
      </div>
      {row && (
        <div>
          <Section title={row.status === 'sent' ? 'Went to' : 'Goes to'} level={3} />
          <ul className="bs-fu-people">
            {list.map((r) => (
              <li key={r.email}><span>{recipientLabel(r)}</span><span className="bs-fu-mail">{r.email}</span></li>
            ))}
            {list.length === 0 && <li><span className="bs-sub">Add people in the To line.</span></li>}
          </ul>
        </div>
      )}
      <FollowUpOptions state={state} />
    </div>
  )
}

