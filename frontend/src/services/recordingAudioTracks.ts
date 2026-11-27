export const ISOLATED_AUDIO_TRACKS = ['mic', 'tab'] as const
export type IsolatedAudioTrack = typeof ISOLATED_AUDIO_TRACKS[number]
export const ROOM_PARTICIPANT_TRACKS = ['p1', 'p2', 'p3'] as const
export type RoomParticipantTrack = typeof ROOM_PARTICIPANT_TRACKS[number]
export type PlaybackTrack = IsolatedAudioTrack | RoomParticipantTrack
export type RecordingTrack = 'mix' | PlaybackTrack
export const TRACK_LABELS = { mix: 'Combined', mic: 'Microphone', tab: 'Tab audio' }

export interface TrackCoverage { pieces: number; durationMs: number; label?: string }
export type AudioTracks = Partial<Record<PlaybackTrack, TrackCoverage>>

export interface AudioGapRange {
  startMs: number
  endMs: number | null
}

export interface RecordingGaps {
  tabAudioGaps?: AudioGapRange[]
  micAudioGaps?: AudioGapRange[]
}

export interface AudioGap extends AudioGapRange {
  track: IsolatedAudioTrack
}

export function audioGaps(timeline: RecordingGaps): AudioGap[] {
  return [
    ...(timeline.micAudioGaps ?? []).map(gap => ({ ...gap, track: 'mic' as const })),
    ...(timeline.tabAudioGaps ?? []).map(gap => ({ ...gap, track: 'tab' as const })),
  ].sort((a, b) => a.startMs - b.startMs)
}

export function readRecordingGaps(raw: Record<string, unknown>, durationMs: number): AudioGap[] {
  return audioGaps({ micAudioGaps: readAudioGaps(raw.micAudioGaps, durationMs), tabAudioGaps: readAudioGaps(raw.tabAudioGaps, durationMs) })
}

function readAudioGaps(raw: unknown, durationMs: number): AudioGapRange[] {
  const gaps: AudioGapRange[] = []
  for (const gap of Array.isArray(raw) ? raw : []) {
    const startMs = gap?.startMs
    const endMs = gap?.endMs
    if (!Number.isSafeInteger(startMs) || startMs < 0 || startMs >= durationMs) continue
    if (endMs !== null && (!Number.isSafeInteger(endMs) || endMs <= startMs)) continue
    const previous = gaps.at(-1)
    if (previous && (previous.endMs === null || startMs < previous.endMs)) continue
    gaps.push({ startMs, endMs: endMs !== null && endMs <= durationMs ? endMs : null })
  }
  return gaps
}
