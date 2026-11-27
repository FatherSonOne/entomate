/**
 * Meeting transcript — typed client for timed transcript lines.
 * Ported from Logos Vision `meetingTranscript.ts` (`TranscriptSegment`, Notetaker Sweep 2).
 *
 * `meetings.transcript_segments` holds [{ atMs, endMs?, speaker, text }]. Recall bot
 * meetings get it on ingestion; pasted and uploaded meetings have only flat text, so
 * `toSegments` returns null for them and the page keeps its plain-text view.
 */

import { meetingsApi } from './api'
import cache from './apiCache'

export interface TranscriptSegment {
  /** Milliseconds from the start of the recording. */
  atMs: number
  eventId?: string
  sourcePosition?: number
  endMs?: number
  speaker: string
  text: string
}

interface ApiEnvelope<T> {
  success?: boolean
  data?: T
  error?: string
}

/** Validates the column's shape; anything malformed is dropped rather than rendered. */
export function toSegments(raw: unknown, { requireTimestamp = false, includeSourcePosition = false } = {}): TranscriptSegment[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const out: TranscriptSegment[] = []
  for (const [index, item] of raw.entries()) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    if (typeof r.text !== 'string' || !r.text.trim()) continue
    if (requireTimestamp && (typeof r.atMs !== 'number' || !Number.isFinite(r.atMs) || r.atMs < 0)) continue
    const atMs = typeof r.atMs === 'number' && Number.isFinite(r.atMs) ? Math.max(0, r.atMs) : 0
    const seg: TranscriptSegment = {
      atMs,
      speaker: typeof r.speaker === 'string' && r.speaker.trim() ? r.speaker : 'Speaker',
      text: r.text,
    }
    if (typeof r.eventId === 'string' && r.eventId) seg.eventId = r.eventId
    if (includeSourcePosition) seg.sourcePosition = index + 1
    if (typeof r.endMs === 'number' && Number.isFinite(r.endMs)) seg.endMs = r.endMs
    out.push(seg)
  }
  return out.length ? out : null
}

export interface SummaryMoments {
  keyPoints: Array<number | null>
  decisions: Array<number | null>
}

/**
 * `meetings.summary_moments`: transcript timecodes index-aligned with key_points and
 * decisions. Anything malformed reads as "no timecode" rather than a wrong one.
 */
export function toSummaryMoments(raw: unknown): SummaryMoments {
  const list = (v: unknown): Array<number | null> =>
    Array.isArray(v) ? v.map((x) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : null)) : []
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return { keyPoints: list(r.keyPoints), decisions: list(r.decisions) }
}

/** 0:05, 12:40, 1:02:03 — the clock a person reads off a recording. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/** Speakers in order of first appearance, with how many lines each one has. */
export function speakersOf(segments: TranscriptSegment[]): Array<{ name: string; lines: number }> {
  const counts = new Map<string, number>()
  for (const s of segments) counts.set(s.speaker, (counts.get(s.speaker) ?? 0) + 1)
  return [...counts].map(([name, lines]) => ({ name, lines }))
}

/** Indexes of lines whose text or speaker contains the query (case-insensitive). */
export function matchingLines(segments: TranscriptSegment[], query: string): number[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const hits: number[] = []
  segments.forEach((s, i) => {
    if (s.text.toLowerCase().includes(q) || s.speaker.toLowerCase().includes(q)) hits.push(i)
  })
  return hits
}

export interface RenameResult {
  segments: TranscriptSegment[]
  transcript: string
}

/**
 * Rename a speaker everywhere in one meeting's transcript. Returns null on failure;
 * `error` carries the server's reason (for example, a name with a colon).
 */
export async function renameSpeaker(
  meetingId: string,
  from: string,
  to: string,
  merge = false,
): Promise<{ result: RenameResult | null; error: string | null }> {
  try {
    const save = merge ? meetingsApi.mergeSpeakers : meetingsApi.renameSpeaker
    const res = (await save(meetingId, from, to)) as ApiEnvelope<{
      transcript?: unknown
      transcript_segments?: unknown
    }>
    // The PATCH goes to a child URL, which does not clear the cached GET of the meeting.
    cache.invalidate(`/meetings/${meetingId}`)
    const segments = toSegments(res?.data?.transcript_segments)
    if (!segments) return { result: null, error: 'The transcript could not be updated.' }
    return { result: { segments, transcript: String(res?.data?.transcript ?? '') }, error: null }
  } catch (err) {
    const e = err as { status?: number; message?: unknown }
    const showReason = e?.status === 400 || e?.status === 409 || (merge && e?.status === 404)
    const reason = showReason && typeof e.message === 'string' ? e.message : null
    return { result: null, error: reason ?? (merge ? 'The speakers could not be merged.' : 'The speaker could not be renamed.') }
  }
}

/* ── Speaker name suggestions (audit rec 11) ─────────────────────────── */

export interface SpeakerSuggestion {
  speaker: string
  name: string
  /** 0-1. */
  confidence: number
  /** Words from the transcript that show it, when there are some. */
  evidence: string | null
}

/** "Speaker 2" style labels that still need a real name. */
export function isGenericSpeaker(name: string): boolean {
  return /^speaker(\s*\d+)?$/i.test(name.trim())
}

/** Valid suggestions for speakers still in the transcript, one per speaker. */
export function toSuggestions(raw: unknown, segments: TranscriptSegment[]): SpeakerSuggestion[] {
  if (!Array.isArray(raw)) return []
  const present = new Set(segments.map((s) => s.speaker))
  const seen = new Set<string>()
  const out: SpeakerSuggestion[] = []
  for (const r of raw as Array<Record<string, unknown>>) {
    const speaker = typeof r?.speaker === 'string' ? r.speaker : ''
    const name = typeof r?.name === 'string' ? r.name.trim() : ''
    if (!speaker || !name || !present.has(speaker) || seen.has(speaker) || /[\r\n:]/.test(name)) continue
    seen.add(speaker)
    const c = typeof r.confidence === 'number' ? r.confidence : 0
    out.push({ speaker, name, confidence: Math.max(0, Math.min(1, c)), evidence: typeof r.evidence === 'string' && r.evidence ? r.evidence : null })
  }
  return out
}

/** Ask the server to guess names. Renames nothing. */
export async function suggestSpeakers(meetingId: string, segments: TranscriptSegment[]): Promise<{ suggestions: SpeakerSuggestion[]; error: string | null }> {
  try {
    const res = (await meetingsApi.suggestSpeakers(meetingId)) as ApiEnvelope<{ suggestions?: unknown }>
    return { suggestions: toSuggestions(res?.data?.suggestions, segments), error: null }
  } catch {
    return { suggestions: [], error: 'Names could not be suggested. Try again.' }
  }
}
