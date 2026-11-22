/**
 * Search notes: the Notes column on the Search page. Clips (a result, a decision,
 * an Ask answer, a transcript line) and typed notes, collected from search, the
 * ⌘K palette and other modules. Private to the signed-in user (enforced by
 * backend/services/searchNotesService.js).
 *
 * Other modules clip with `clipToNotes(...)`; it fires a window event so an open
 * Search page refreshes its column without a reload.
 */

import api from './api'
import { timecode } from './searchEngine'
import type { SearchResult } from './searchEngine'

export type NoteKind = 'note' | 'meeting' | 'decision' | 'action_item' | 'task' | 'project' | 'transcript' | 'answer' | 'meeting_note'
export type NoteOrigin = 'search' | 'palette' | 'meeting' | 'ask' | 'tasks' | 'other'

export interface SearchNote {
  id: string
  kind: NoteKind
  body: string
  sourceType: string | null
  sourceId: string | null
  sourceLabel: string | null
  atMs: number | null
  query: string | null
  origin: NoteOrigin
  createdAt: string
  updatedAt: string
}

export interface NewNote {
  kind: NoteKind
  body: string
  sourceType?: string | null
  sourceId?: string | null
  sourceLabel?: string | null
  atMs?: number | null
  query?: string | null
  origin: NoteOrigin
}

export const NOTES_CHANGED = 'entomate:search-notes-changed'

const http = api as unknown as {
  get: (url: string, config?: Record<string, unknown>) => Promise<unknown>
  post: (url: string, body: unknown) => Promise<unknown>
  patch: (url: string, body: unknown) => Promise<unknown>
  delete: (url: string) => Promise<unknown>
}

function toNote(raw: unknown): SearchNote | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || typeof r.body !== 'string') return null
  const s = (v: unknown) => (typeof v === 'string' ? v : null)
  return {
    id: r.id,
    kind: (s(r.kind) || 'note') as NoteKind,
    body: r.body,
    sourceType: s(r.sourceType),
    sourceId: s(r.sourceId),
    sourceLabel: s(r.sourceLabel),
    atMs: typeof r.atMs === 'number' ? r.atMs : null,
    query: s(r.query),
    origin: (s(r.origin) || 'other') as NoteOrigin,
    createdAt: s(r.createdAt) || '',
    updatedAt: s(r.updatedAt) || '',
  }
}

export async function listNotes(): Promise<SearchNote[]> {
  const raw = (await http.get('/search/notes')) as { notes?: unknown[] }
  return (raw.notes || []).map(toNote).filter((n): n is SearchNote => n !== null)
}

export async function createNote(note: NewNote): Promise<SearchNote> {
  const raw = (await http.post('/search/notes', note)) as { note?: unknown }
  const n = toNote(raw.note)
  if (!n) throw new Error('The note was not saved')
  window.dispatchEvent(new CustomEvent(NOTES_CHANGED))
  return n
}

export async function updateNote(id: string, body: string): Promise<SearchNote> {
  const raw = (await http.patch(`/search/notes/${id}`, { body })) as { note?: unknown }
  const n = toNote(raw.note)
  if (!n) throw new Error('The note was not saved')
  return n
}

export async function deleteNote(id: string): Promise<void> {
  await http.delete(`/search/notes/${id}`)
  window.dispatchEvent(new CustomEvent(NOTES_CHANGED))
}

/** Clip from any module (meeting page, Tasks): same as createNote. */
export const clipToNotes = createNote

const KIND_BY_TYPE: Record<SearchResult['type'], NoteKind> = {
  meeting: 'transcript',
  decision: 'decision',
  action_item: 'action_item',
  task: 'task',
  project: 'project',
  note: 'note',
  meeting_note: 'meeting_note',
}

/** The clip a search result becomes: its words, and a link back to where it came from. */
export function clipFromResult(r: SearchResult, query: string, origin: NoteOrigin): NewNote {
  const plain = (s: string) => s.replace(/\s+/g, ' ').trim()
  const isMeeting = r.type === 'meeting'
  const body = isMeeting ? plain(r.snippet || r.title) : plain(r.title) + (r.snippet && r.type !== 'decision' ? `\n${plain(r.snippet)}` : '')
  const label = isMeeting ? r.title : r.meta.meetingTitle || r.meta.projectName || null
  const sourceId = r.type === 'decision' ? r.meta.meetingId || null : r.id
  const sourceType = r.type === 'decision' ? 'meeting' : r.type
  return {
    kind: KIND_BY_TYPE[r.type],
    body,
    sourceType,
    sourceId,
    sourceLabel: label,
    atMs: r.meta.atMs ?? null,
    query: query || null,
    origin,
  }
}

/** Stable key for "already clipped" state: same source and same words. */
export function clipKey(n: Pick<NewNote, 'sourceType' | 'sourceId' | 'body'>): string {
  return `${n.sourceType || ''}:${n.sourceId || ''}:${n.body.slice(0, 120)}`
}

const KIND_LABEL: Record<NoteKind, string> = {
  note: 'Note', meeting: 'Meeting', decision: 'Decision', action_item: 'Action item', task: 'Task',
  project: 'Project', transcript: 'Transcript', answer: 'Answer', meeting_note: 'Meeting note',
}
const ORIGIN_LABEL: Record<NoteOrigin, string> = {
  search: 'from Search', palette: 'from ⌘K', meeting: 'from a meeting', ask: 'from Ask', tasks: 'from Tasks', other: '',
}

export const kindLabel = (k: NoteKind): string => KIND_LABEL[k] || 'Note'
export function originLabel(n: Pick<SearchNote, 'origin' | 'query'>): string {
  if (n.origin === 'search' && n.query) return `from Search “${n.query}”`
  return ORIGIN_LABEL[n.origin] || ''
}

/** Link back to the source of a clip, when it has one. */
export function noteHref(n: SearchNote): string | null {
  const at = n.atMs != null ? `?t=${n.atMs}` : ''
  switch (n.sourceType) {
    case 'meeting': return n.sourceId ? `/meetings/${n.sourceId}${at}` : null
    case 'meeting_note': return null
    case 'action_item': return n.sourceId ? `/tasks?item=action:${n.sourceId}` : null
    case 'task': return n.sourceId ? `/tasks?item=task:${n.sourceId}` : null
    case 'project': return n.sourceId ? `/projects/${n.sourceId}` : null
    default: return null
  }
}

/** "Acme pricing call · ▶ 14:55" */
export function sourceLine(n: SearchNote): string {
  const tc = timecode(n.atMs)
  return [n.sourceLabel, tc ? `▶ ${tc}` : null].filter(Boolean).join(' · ')
}

/** Notes as Markdown, newest first, for Copy as Markdown. */
export function notesToMarkdown(notes: ReadonlyArray<SearchNote>, origin = ''): string {
  const lines: string[] = ['# Notes', '']
  for (const n of notes) {
    const src = sourceLine(n)
    const href = noteHref(n)
    if (n.kind === 'note') {
      lines.push(n.body, '')
      continue
    }
    const quoted = n.body.split('\n').map((l) => `> ${l}`).join('\n')
    lines.push(`**${kindLabel(n.kind)}**${src ? ` · ${src}` : ''}`, quoted)
    if (href && origin) lines.push(`${origin}${href}`)
    lines.push('')
  }
  return lines.join('\n').trim() + '\n'
}

