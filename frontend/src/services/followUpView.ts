/**
 * Follow-up email tab (Slate pick C "Letter", 2026-11-23): pure view logic.
 * Shapes the reply of GET /api/meetings/:id/follow-up and says what the
 * Sending block shows. No React, no API calls.
 */

import type { SignalTone } from '../components/bench'

export type FollowUpStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'stopped' | 'failed'
export type RecipientSource = 'invite' | 'owner' | 'added'

export interface Recipient {
  name: string | null
  email: string
  source: RecipientSource
}

export interface FollowUpInclude {
  decisions: boolean
  items: boolean
  next: boolean
  summary: boolean
  copy: boolean
}

export interface NextMeeting {
  title: string
  start: string | null
  when: string | null
}

export interface FollowUpRow {
  id: string
  status: FollowUpStatus
  recipients: Recipient[]
  subject: string
  opening: string
  signoff: string
  include: FollowUpInclude
  nextMeeting: NextMeeting | null
  sendAt: string | null
  sentAt: string | null
  sentTo: Recipient[]
  error: string | null
  editedAt: string | null
}

export interface FollowUpItem {
  title: string
  owner: string | null
  due: string | null
}

export interface FollowUpParts {
  summary: string
  decisions: string[]
  items: FollowUpItem[]
}

export interface FollowUpData {
  row: FollowUpRow | null
  parts: FollowUpParts
  autoSend: boolean
  mailReady: boolean
  canSend: boolean
}

export const DEFAULT_INCLUDE: FollowUpInclude = { decisions: true, items: true, next: true, summary: false, copy: true }
export const MAX_RECIPIENTS = 20
const STATUSES: ReadonlyArray<FollowUpStatus> = ['draft', 'scheduled', 'sending', 'sent', 'stopped', 'failed']
const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/

type Loose = Record<string, unknown>
const obj = (v: unknown): Loose => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Loose) : {})
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)

function toRecipients(v: unknown): Recipient[] {
  if (!Array.isArray(v)) return []
  return v
    .map(obj)
    .filter((r) => EMAIL_RE.test(str(r.email)))
    .map((r) => ({
      name: strOrNull(r.name),
      email: str(r.email),
      source: (['invite', 'owner', 'added'] as const).find((s) => s === r.source) ?? 'added',
    }))
}

function toInclude(v: unknown): FollowUpInclude {
  const o = obj(v)
  const pick = (k: keyof FollowUpInclude): boolean => (typeof o[k] === 'boolean' ? (o[k] as boolean) : DEFAULT_INCLUDE[k])
  return { decisions: pick('decisions'), items: pick('items'), next: pick('next'), summary: pick('summary'), copy: pick('copy') }
}

function toRow(v: unknown): FollowUpRow | null {
  const r = obj(v)
  if (!str(r.id)) return null
  const status = STATUSES.find((s) => s === r.status) ?? 'draft'
  const nx = obj(r.next_meeting)
  return {
    id: str(r.id),
    status,
    recipients: toRecipients(r.recipients),
    subject: str(r.subject),
    opening: str(r.opening),
    signoff: str(r.signoff),
    include: toInclude(r.include),
    nextMeeting: str(nx.title) ? { title: str(nx.title), start: strOrNull(nx.start), when: strOrNull(nx.when) } : null,
    sendAt: strOrNull(r.send_at),
    sentAt: strOrNull(r.sent_at),
    sentTo: toRecipients(r.sent_to),
    error: strOrNull(r.error),
    editedAt: strOrNull(r.edited_at),
  }
}

/** Survives an empty or partial reply. */
export function normalizeFollowUp(reply: unknown): FollowUpData {
  const o = obj(reply)
  const p = obj(o.parts)
  return {
    row: toRow(o.followUp),
    parts: {
      summary: str(p.summary),
      decisions: Array.isArray(p.decisions) ? p.decisions.filter((d): d is string => typeof d === 'string' && d.trim() !== '') : [],
      items: Array.isArray(p.items)
        ? p.items.map(obj).filter((i) => str(i.title)).map((i) => ({ title: str(i.title), owner: strOrNull(i.owner), due: strOrNull(i.due) }))
        : [],
    },
    autoSend: o.autoSend !== false,
    mailReady: o.mailReady === true,
    canSend: o.canSend === true,
  }
}

/** "15:05" in the viewer's own time zone. */
export function clock(iso: string | null, timeZone?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone })
}

/** "Ana Ruiz" or the part of the email before the @. */
export function recipientLabel(r: Recipient): string {
  return r.name?.trim() || r.email.split('@')[0] || r.email
}

/** "Ana, Bo and Cy" / "Ana and 4 others". */
export function peopleLine(list: ReadonlyArray<Recipient>): string {
  const names = list.map((r) => recipientLabel(r).split(/\s+/)[0] ?? '')
  if (names.length === 0) return 'nobody yet'
  if (names.length === 1) return names[0] ?? ''
  if (names.length <= 3) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `${names[0] ?? ''} and ${names.length - 1} others`
}

export interface SendingView {
  tone: SignalTone
  word: string
  /** The big mono time, or '' when there is none. */
  time: string
  sub: string
  /** Show the Stop key. */
  canStop: boolean
  /** A short word for the tab ("Sends 15:05", "Sent", "Draft"). */
  tabWord: string
}

/** What the Sending block says for this follow-up. Pure. */
export function sendingView(data: FollowUpData, timeZone?: string): SendingView {
  const row = data.row
  if (!row) {
    return { tone: 'off', word: 'Waiting for the minutes', time: '', sub: 'The follow-up is drafted as soon as the minutes are ready.', canStop: false, tabWord: '' }
  }
  const n = row.status === 'sent' ? (row.sentTo.length || row.recipients.length) : row.recipients.length
  const copy = row.include.copy ? ' A copy goes to you.' : ''
  switch (row.status) {
    case 'scheduled':
      return {
        tone: 'ai', word: 'Agent will send', time: clock(row.sendAt, timeZone),
        sub: 'Sends on its own 20 minutes after the meeting ends, unless you edit it or stop it.',
        canStop: true, tabWord: `Sends ${clock(row.sendAt, timeZone)}`,
      }
    case 'sending':
      return { tone: 'live', word: 'Sending', time: '', sub: `Going out to ${n} ${n === 1 ? 'person' : 'people'} now.`, canStop: false, tabWord: 'Sending' }
    case 'sent':
      return {
        tone: 'mint', word: 'Sent', time: clock(row.sentAt, timeZone),
        sub: `To ${peopleLine(row.sentTo.length ? row.sentTo : row.recipients)}.${row.include.copy ? ' A copy went to you.' : ''} Replies go to you.`,
        canStop: false, tabWord: 'Sent',
      }
    case 'stopped':
      return { tone: 'off', word: 'Stopped', time: '', sub: 'It will not go out on its own. Send now still works.', canStop: false, tabWord: 'Stopped' }
    case 'failed':
      return { tone: 'brand', word: 'Not sent', time: '', sub: row.error || 'The email could not be sent.', canStop: false, tabWord: 'Not sent' }
    default: {
      let sub = `Ready when you are.${copy}`
      if (!row.recipients.length) sub = 'Add who gets it, then press Send now.'
      else if (row.editedAt) sub = 'You edited it, so it waits for you. Press Send now when it reads right.'
      else if (!data.autoSend) sub = `Sending on its own is off, so it waits for you.${copy}`
      return { tone: 'brand', word: row.editedAt ? 'Held for you' : 'Draft ready', time: '', sub, canStop: false, tabWord: 'Draft' }
    }
  }
}

/** Why Send now is off, or null when it can be pressed. */
export function sendBlocker(data: FollowUpData): string | null {
  const row = data.row
  if (!row) return 'The minutes are not ready yet.'
  if (row.status === 'sent' || row.status === 'sending') return 'It has already gone out.'
  if (!data.canSend) return 'Only the person it is sent for, or a workspace admin, can send it.'
  if (!data.mailReady) return 'Email is not set up on the server.'
  if (!row.recipients.length) return 'Add at least one person.'
  return null
}

/** Editable until it goes out. */
export function canEdit(data: FollowUpData): boolean {
  return Boolean(data.row && data.canSend && !['sent', 'sending'].includes(data.row.status))
}

/**
 * Parse what was typed in the To field ("Ana <ana@x.com>", "ana@x.com, bo@x.com")
 * and add the new ones. Returns the list and the parts that were not emails.
 */
export function addRecipients(list: ReadonlyArray<Recipient>, typed: string): { list: Recipient[]; rejected: string[] } {
  const out = [...list]
  const seen = new Set(out.map((r) => r.email.toLowerCase()))
  const rejected: string[] = []
  for (const raw of typed.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)) {
    const m = /^(.*?)\s*<([^>]+)>$/.exec(raw)
    const email = (m?.[2] ?? raw).trim()
    const name = m ? (m[1] ?? '').replace(/^"|"$/g, '').trim() || null : null
    if (!EMAIL_RE.test(email)) { rejected.push(raw); continue }
    if (seen.has(email.toLowerCase()) || out.length >= MAX_RECIPIENTS) continue
    seen.add(email.toLowerCase())
    out.push({ name, email, source: 'added' })
  }
  return { list: out, rejected }
}

export const SOURCE_LABEL: Record<RecipientSource, string> = { invite: 'Invite', owner: 'Owner', added: 'Added' }
