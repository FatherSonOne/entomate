import { describe, it, expect } from 'vitest'
import {
  addRecipients, canEdit, clock, normalizeFollowUp, peopleLine, sendBlocker, sendingView, type FollowUpData,
} from '../services/followUpView'

const reply = (row: Record<string, unknown> | null, extra: Record<string, unknown> = {}): FollowUpData => normalizeFollowUp({
  followUp: row && {
    id: 'f1', status: 'draft', subject: 'Follow-up: Q4', opening: 'Hi all', signoff: 'Thanks,\nFrank',
    recipients: [{ name: 'Ana Ruiz', email: 'ana@x.test', source: 'invite' }, { email: 'bo@x.test' }, { email: 'nope' }],
    include: { summary: true }, send_at: null, ...row,
  },
  parts: { summary: 'S', decisions: ['Ship', '', 3], items: [{ title: 'Brief', owner: 'Ana', due: 'Fri 27 Nov' }, { owner: 'x' }] },
  autoSend: true, mailReady: true, canSend: true, ...extra,
})

describe('normalizeFollowUp', () => {
  it('survives an empty reply', () => {
    expect(normalizeFollowUp(undefined)).toMatchObject({ row: null, parts: { decisions: [], items: [] }, autoSend: true, mailReady: false, canSend: false })
  })
  it('keeps valid recipients, fills include defaults and cleans parts', () => {
    const d = reply({})
    expect(d.row?.recipients.map((r) => r.email)).toEqual(['ana@x.test', 'bo@x.test'])
    expect(d.row?.recipients[1]?.source).toBe('added')
    expect(d.row?.include).toEqual({ decisions: true, items: true, next: true, summary: true, copy: true })
    expect(d.parts.decisions).toEqual(['Ship'])
    expect(d.parts.items).toHaveLength(1)
  })
})

describe('sendingView', () => {
  it('a scheduled one says the agent will send, with the time and Stop', () => {
    const v = sendingView(reply({ status: 'scheduled', send_at: '2026-11-23T15:05:00Z' }), 'UTC')
    expect(v).toMatchObject({ tone: 'ai', word: 'Agent will send', time: '15:05', canStop: true, tabWord: 'Sends 15:05' })
  })
  it('an edited draft is held for you', () => {
    expect(sendingView(reply({ edited_at: '2026-11-23T14:50:00Z' }))).toMatchObject({ tone: 'brand', word: 'Held for you' })
  })
  it('says why a draft waits when auto-send is off', () => {
    expect(sendingView(reply({}, { autoSend: false })).sub).toMatch(/off/)
  })
  it('sent shows who it went to', () => {
    const v = sendingView(reply({ status: 'sent', sent_at: '2026-11-23T15:05:00Z', sent_to: [{ name: 'Ana Ruiz', email: 'ana@x.test' }] }), 'UTC')
    expect(v).toMatchObject({ tone: 'mint', word: 'Sent', time: '15:05' })
    expect(v.sub).toMatch(/^To Ana\./)
  })
  it('failed shows the server error', () => {
    expect(sendingView(reply({ status: 'failed', error: 'Resend says no' })).sub).toBe('Resend says no')
  })
  it('no row yet: waits for the minutes', () => {
    expect(sendingView(reply(null)).word).toBe('Waiting for the minutes')
  })
})

describe('sendBlocker and canEdit', () => {
  it('lets a draft with people be sent and edited', () => {
    expect(sendBlocker(reply({}))).toBeNull()
    expect(canEdit(reply({}))).toBe(true)
  })
  it('blocks once sent, without permission, without mail or people', () => {
    expect(sendBlocker(reply({ status: 'sent' }))).toMatch(/already/)
    expect(canEdit(reply({ status: 'sent' }))).toBe(false)
    expect(sendBlocker(reply({}, { canSend: false }))).toMatch(/admin/)
    expect(sendBlocker(reply({}, { mailReady: false }))).toMatch(/not set up/)
    expect(sendBlocker(reply({ recipients: [] }))).toMatch(/Add/)
  })
})

describe('addRecipients', () => {
  it('parses names and lists, skips duplicates, reports bad entries', () => {
    const out = addRecipients([{ name: null, email: 'ana@x.test', source: 'invite' }], 'Cy Lee <cy@x.test>, ANA@x.test; nope')
    expect(out.list.map((r) => r.email)).toEqual(['ana@x.test', 'cy@x.test'])
    expect(out.list[1]).toEqual({ name: 'Cy Lee', email: 'cy@x.test', source: 'added' })
    expect(out.rejected).toEqual(['nope'])
  })
})

describe('labels', () => {
  it('peopleLine and clock', () => {
    expect(peopleLine([])).toBe('nobody yet')
    expect(peopleLine([{ name: 'Ana Ruiz', email: 'a@x.test', source: 'invite' }, { name: null, email: 'bo@x.test', source: 'added' }])).toBe('Ana and bo')
    expect(clock('2026-11-23T09:07:00Z', 'UTC')).toBe('09:07')
    expect(clock(null)).toBe('')
  })
})
