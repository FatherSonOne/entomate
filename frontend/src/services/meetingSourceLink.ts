export interface PassageAnchor {
  revision: string
  kind: 'segment' | 'text'
  /** One-based source line or Unicode character offset. */
  position: number
  /** Length of a quoted selection in an untimed transcript. */
  length?: number
}

/** Saved meeting links with an anchor or time open the paused transcript view. */
export function meetingSourceHref(meetingId: string, atMs?: number | null, anchor?: PassageAnchor | null): string {
  const path = `/meetings/${encodeURIComponent(meetingId)}`
  const timed = typeof atMs === 'number' && Number.isFinite(atMs) && atMs >= 0
  if (!timed && !anchor) return path
  const query = new URLSearchParams({ tab: 'transcript' })
  if (timed) query.set('t', String(Math.round(atMs)))
  if (anchor) {
    query.set('rev', anchor.revision)
    query.set(anchor.kind === 'segment' ? 'line' : 'textAt', String(anchor.position))
    if (anchor.kind === 'text' && anchor.length) query.set('textLen', String(anchor.length))
  }
  return `${path}?${query}`
}

export function readPassageAnchor(query: URLSearchParams): PassageAnchor | null {
  const revision = query.get('rev')
  if (!revision || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(revision)) return null
  const kind = query.has('line') ? 'segment' : 'text'
  const position = Number(query.get(kind === 'segment' ? 'line' : 'textAt'))
  if (!Number.isSafeInteger(position) || position <= 0) return null
  const length = Number(query.get('textLen'))
  return {
    revision: revision.toLowerCase(), kind, position,
    ...(kind === 'text' && Number.isInteger(length) && length > 0 && length <= 1200 ? { length } : {}),
  }
}

/** PostgreSQL offsets count Unicode characters, not JavaScript UTF-16 code units. */
export function plainTextPassage(text: string, position: number, length = 1200): [string, string, string] | null {
  const characters = Array.from(text)
  const start = position - 1
  if (start < 0 || start >= characters.length) return null
  const end = start + length
  return [characters.slice(0, start).join(''), characters.slice(start, end).join(''), characters.slice(end).join('')]
}
