import type { TranscriptSegment } from '../../services/meetingTranscriptService'

interface SpeakerTurn {
  speaker: string
  start: number
  end: number
}

const SPEAKER_COLORS = ['var(--bs-d-brand)', '#00F5D4', '#4DA6FF', '#9B6DFF']

function speakerColor(index: number): string {
  return SPEAKER_COLORS[index] ?? `oklch(0.8 0.13 ${(68 + (index - SPEAKER_COLORS.length) * 137.5) % 360})`
}

/** Match transcript time to a single lane. A later turn owns any overlap. */
export function recordingSpeakers(segments: readonly TranscriptSegment[], durationMs: number) {
  const turns: SpeakerTurn[] = []
  const colors = new Map<string, string>()
  const ordered = segments
    .filter(line => Number.isFinite(line.atMs) && line.atMs >= 0)
    .sort((a, b) => a.atMs - b.atMs)

  for (const [index, line] of ordered.entries()) {
    if (line.atMs >= durationMs) break
    const next = ordered[index + 1]?.atMs
    // Older recordings store starts only. The next line can bound a turn; the last
    // one has no known end, so don't attribute the rest of the recording to it.
    const end = typeof line.endMs === 'number' && line.endMs > line.atMs ? line.endMs : next
    if (end === undefined) continue
    const stop = Math.min(end, next ?? durationMs, durationMs)
    if (stop <= line.atMs) continue

    const previous = turns[turns.length - 1]
    if (previous?.speaker === line.speaker && previous.end === line.atMs) {
      previous.end = stop
    } else {
      turns.push({ speaker: line.speaker, start: line.atMs, end: stop })
    }
    if (!colors.has(line.speaker)) colors.set(line.speaker, speakerColor(colors.size))
  }

  const stops = turns.flatMap(({ speaker, start, end }) => {
    const color = colors.get(speaker)!
    return [
      { offset: start / durationMs, color: 'transparent' },
      { offset: start / durationMs, color },
      { offset: end / durationMs, color },
      { offset: end / durationMs, color: 'transparent' },
    ]
  })
  return { turns, colors, stops }
}
