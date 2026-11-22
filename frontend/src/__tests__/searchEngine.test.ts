import { describe, test, expect, vi } from 'vitest'

vi.mock('../services/api', () => ({ default: { post: vi.fn(), get: vi.fn() }, searchApi: {} }))
import {
  flatten, highlightParts, isQuestion, matchCommands, metaLine, normalizeResponse, readUrlState, recentFromHistory,
  resultHref, searchPagePath, statusSignal, timecode, writeUrlState,
} from '../services/searchEngine'
import type { SearchResult } from '../services/searchEngine'
import { clipFromResult, clipKey, noteHref, notesToMarkdown, originLabel, sourceLine } from '../services/searchNotesService'
import type { SearchNote } from '../services/searchNotesService'

const now = new Date('2026-11-22T12:00:00Z')

const meeting: SearchResult = {
  type: 'meeting', id: 'm1', title: 'Acme pricing call', titleHits: [[5, 12]],
  snippet: '…the pricing floor stays at $40…', snippetHits: [[5, 12]],
  meta: { date: '2026-11-12T10:00:00Z', atMs: 895000, speaker: 'Ana R.' },
}
const decision: SearchResult = {
  type: 'decision', id: 'm1:0', title: 'Pilot pricing floor stays at $40/seat', titleHits: [[6, 13]], snippet: '', snippetHits: [],
  meta: { meetingId: 'm1', meetingTitle: 'Acme pricing call', date: '2026-11-12T10:00:00Z', atMs: 895000 },
}
const item: SearchResult = {
  type: 'action_item', id: 'a1', title: 'Send revised pricing', titleHits: [], snippet: '', snippetHits: [],
  meta: { owner: null, dueDate: '2026-11-17', status: 'open', meetingTitle: 'Northwind check-in' },
}

describe('searchEngine', () => {
  test('highlightParts splits around hits and ignores bad ranges', () => {
    expect(highlightParts('the pricing floor', [[4, 11]])).toEqual([
      { text: 'the ', hit: false }, { text: 'pricing', hit: true }, { text: ' floor', hit: false },
    ])
    expect(highlightParts('abc', [[2, 1], [0, 99]])).toEqual([{ text: 'abc', hit: false }])
  })

  test('timecode formats minutes and hours', () => {
    expect(timecode(895000)).toBe('14:55')
    expect(timecode(3725000)).toBe('1:02:05')
    expect(timecode(null)).toBeNull()
    expect(timecode(-1)).toBeNull()
  })

  test('resultHref jumps meetings and decisions to the moment', () => {
    expect(resultHref(meeting)).toBe('/meetings/m1?t=895000')
    expect(resultHref(decision)).toBe('/meetings/m1?t=895000')
    expect(resultHref(item)).toBe('/tasks?item=action:a1')
    expect(resultHref({ ...meeting, meta: { atMs: null } })).toBe('/meetings/m1')
  })

  test('statusSignal marks late items and done ones', () => {
    expect(statusSignal(item, now)).toEqual({ tone: 'brand', word: 'Late' })
    expect(statusSignal({ ...item, meta: { ...item.meta, status: 'completed' } }, now)).toEqual({ tone: 'mint', word: 'Done' })
    expect(statusSignal({ ...item, meta: { status: 'in_progress' } }, now)).toEqual({ tone: 'live', word: 'In progress' })
    expect(statusSignal(meeting, now)).toBeNull()
  })

  test('metaLine reads like the mockup', () => {
    expect(metaLine(meeting, now)).toBe('Thu 12 Nov · Ana R.')
    expect(metaLine(item, now)).toBe('No owner · due Tue 17 Nov · Northwind check-in')
  })

  test('isQuestion', () => {
    expect(isQuestion('pricing?')).toBe(true)
    expect(isQuestion('what did we decide about pricing')).toBe(true)
    expect(isQuestion('pricing')).toBe(false)
    expect(isQuestion('who')).toBe(false)
  })

  test('matchCommands matches labels and keywords', () => {
    expect(matchCommands('dashboard').map((c) => c.id)).toEqual(['go-today'])
    expect(matchCommands('new task').map((c) => c.id)).toEqual(['new-task'])
    expect(matchCommands('').length).toBe(4)
  })

  test('normalizeResponse tolerates junk and flatten keeps group order', () => {
    const r = normalizeResponse({ groups: { decisions: [decision], meetings: [meeting] }, total: 2, engine: 'nope' }, 'pricing')
    expect(r.engine).toBe('words')
    expect(flatten(r).map((x) => x.id)).toEqual(['m1', 'm1:0'])
    expect(flatten(r, 'decisions').map((x) => x.id)).toEqual(['m1:0'])
    expect(normalizeResponse(null, 'x')).toMatchObject({ query: 'x', total: 0, groups: {} })
  })

  test('recentFromHistory dedupes case-insensitively', () => {
    const h = [
      { query: 'Pricing', result_count: 10, created_at: 'a' },
      { query: 'pricing', result_count: 9, created_at: 'b' },
      { query: ' ', result_count: 0 },
      { query: 'Northwind', result_count: 3 },
    ]
    expect(recentFromHistory(h)).toEqual([
      { query: 'Pricing', results: 10, at: 'a' },
      { query: 'Northwind', results: 3, at: null },
    ])
    expect(recentFromHistory('x')).toEqual([])
  })

  test('URL state round trip', () => {
    const p = writeUrlState(new URLSearchParams(), { q: ' pricing ', filter: 'decisions', ask: true })
    expect(p.toString()).toBe('q=pricing&f=decisions&ask=1')
    expect(readUrlState(p)).toEqual({ q: 'pricing', filter: 'decisions', ask: true, notes: false })
    expect(readUrlState(new URLSearchParams('f=bogus')).filter).toBe('all')
    expect(searchPagePath('pricing', true)).toBe('/search?q=pricing&ask=1')
    expect(searchPagePath(' ')).toBe('/search')
  })
})

describe('searchNotesService', () => {
  test('clipFromResult keeps the words and the way back', () => {
    expect(clipFromResult(meeting, 'pricing', 'search')).toMatchObject({
      kind: 'transcript', body: '…the pricing floor stays at $40…', sourceType: 'meeting', sourceId: 'm1', sourceLabel: 'Acme pricing call', atMs: 895000, query: 'pricing',
    })
    expect(clipFromResult(decision, 'pricing', 'palette')).toMatchObject({
      kind: 'decision', body: 'Pilot pricing floor stays at $40/seat', sourceType: 'meeting', sourceId: 'm1', origin: 'palette',
    })
    const a = clipFromResult(decision, 'pricing', 'search')
    const b = clipFromResult(decision, 'other', 'palette')
    expect(clipKey(a)).toBe(clipKey(b))
  })

  const note = (over: Partial<SearchNote>): SearchNote => ({
    id: 'n1', kind: 'decision', body: 'Pilot floor $40', sourceType: 'meeting', sourceId: 'm1', sourceLabel: 'Acme pricing call',
    atMs: 895000, query: 'pricing', origin: 'search', createdAt: '', updatedAt: '', ...over,
  })

  test('labels and links', () => {
    expect(originLabel(note({}))).toBe('from Search “pricing”')
    expect(originLabel(note({ origin: 'meeting' }))).toBe('from a meeting')
    expect(sourceLine(note({}))).toBe('Acme pricing call · ▶ 14:55')
    expect(noteHref(note({}))).toBe('/meetings/m1?t=895000')
    expect(noteHref(note({ sourceType: null }))).toBeNull()
  })

  test('notesToMarkdown quotes clips and keeps typed notes plain', () => {
    const md = notesToMarkdown([note({ kind: 'note', body: 'Ask Ana', sourceType: null }), note({})], 'https://app')
    expect(md).toBe('# Notes\n\nAsk Ana\n\n**Decision** · Acme pricing call · ▶ 14:55\n> Pilot floor $40\nhttps://app/meetings/m1?t=895000\n')
  })
})
