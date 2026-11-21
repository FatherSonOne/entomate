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
export function toSegments(raw: unknown): TranscriptSegment[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const out: TranscriptSegment[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    if (typeof r.text !== 'string' || !r.text.trim()) continue
    const atMs = typeof r.atMs === 'number' && Number.isFinite(r.atMs) ? Math.max(0, r.atMs) : 0
    const seg: TranscriptSegment = {
      atMs,
      speaker: typeof r.speaker === 'string' && r.speaker.trim() ? r.speaker : 'Speaker',
      text: r.text,
    }
    if (typeof r.endMs === 'number' && Number.isFinite(r.endMs)) seg.endMs = r.endMs
    out.push(seg)
  }
  return out.length ? out : null
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
): Promise<{ result: RenameResult | null; error: string | null }> {
  try {
    const res = (await meetingsApi.renameSpeaker(meetingId, from, to)) as ApiEnvelope<{
      transcript?: unknown
      transcript_segments?: unknown
    }>
    // The PATCH goes to a child URL, which does not clear the cached GET of the meeting.
    cache.invalidate(`/meetings/${meetingId}`)
    const segments = toSegments(res?.data?.transcript_segments)
    if (!segments) return { result: null, error: 'The transcript could not be updated.' }
    return { result: { segments, transcript: String(res?.data?.transcript ?? '') }, error: null }
  } catch (err) {
    // api.js rejects with an Error whose message is the server's reason for a 400.
    const e = err as { status?: number; message?: unknown }
    const reason = e?.status === 400 && typeof e.message === 'string' ? e.message : null
    return { result: null, error: reason ?? 'The speaker could not be renamed.' }
  }
}
