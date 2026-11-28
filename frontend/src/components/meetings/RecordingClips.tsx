import React, { useEffect, useState } from 'react'
import { Key } from '../bench'
import { formatClock, type TranscriptSegment } from '../../services/meetingTranscriptService'
import { recordingsApi } from '../../services/api'
import type { RecordingTrack } from '../../services/recordingAudioTracks'

export interface ClipRange { startMs: number; endMs: number }
interface SavedClip extends ClipRange { id: string; title: string }
interface Props {
  meetingId: string
  sharedClipId?: string | null
  range: ClipRange
  durationMs: number
  position: number
  drawing: boolean
  tracks: { id: RecordingTrack; label: string }[]
  transcript?: ReadonlyArray<TranscriptSegment> | null
  onRange: (range: ClipRange) => void
  onDraw: () => void
  onCue: (atMs: number) => void
  onPreview: (range: ClipRange) => void
}

export const validClipRange = ({ startMs, endMs }: ClipRange, durationMs: number): boolean =>
  Number.isSafeInteger(startMs) && Number.isSafeInteger(endMs) && startMs >= 0 && startMs < endMs && endMs <= durationMs

export function RecordingClips({
  meetingId, sharedClipId, range, durationMs, position, drawing, tracks, transcript, onRange, onDraw, onCue, onPreview,
}: Props) {
  const [clips, setClips] = useState<SavedClip[]>([])
  const [selected, setSelected] = useState<SavedClip | null>(null)
  const [title, setTitle] = useState('')
  const [track, setTrack] = useState<RecordingTrack>('mix')
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [listError, setListError] = useState('')
  const [notice, setNotice] = useState('')
  const valid = validClipRange(range, durationMs)
  const active = selected && selected.startMs === range.startMs && selected.endMs === range.endMs ? selected : null

  useEffect(() => {
    const controller = new AbortController()
    void recordingsApi.listClips(meetingId, controller.signal).then(response => {
      if (controller.signal.aborted) return
      const { clips: savedClips } = response as unknown as { clips: SavedClip[] }
      setClips(current => [...current, ...savedClips.filter(clip => !current.some(saved => saved.id === clip.id))])
    }).catch(() => { if (!controller.signal.aborted) setListError('Saved clips could not be loaded.') })
    return () => controller.abort()
  }, [meetingId])

  // Resolve each shared clip once, using callbacks that read the current media element.
  const latest = React.useRef({ onRange, onCue })
  latest.current = { onRange, onCue }
  useEffect(() => {
    if (!sharedClipId) return
    const controller = new AbortController()
    void recordingsApi.clip(meetingId, sharedClipId, controller.signal).then(response => {
      if (controller.signal.aborted) return
      const { clip } = response as unknown as { clip: SavedClip }
      setSelected(clip)
      setTitle(clip.title)
      latest.current.onRange(clip)
      latest.current.onCue(clip.startMs)
    }).catch(() => { if (!controller.signal.aborted) setError('This clip is unavailable.') })
    return () => controller.abort()
  }, [meetingId, sharedClipId])

  const openClip = (clip: SavedClip) => {
    setSelected(clip)
    setTitle(clip.title)
    setNotice('')
    setError('')
    onRange(clip)
    onCue(clip.startMs)
  }

  const save = async () => {
    setSaving(true)
    setNotice('')
    setError('')
    try {
      const response = await recordingsApi.saveClip(meetingId, { title: title.trim(), startMs: range.startMs, endMs: range.endMs })
      const { clip } = response as unknown as { clip: SavedClip }
      setClips(previous => [clip, ...previous])
      setSelected(clip)
      setNotice('Clip saved.')
    } catch {
      setError('Could not save the clip. Try again.')
    } finally { setSaving(false) }
  }

  const copyLink = async (clip: SavedClip) => {
    setError('')
    setNotice('')
    try {
      const url = new URL('/meetings/' + meetingId, window.location.origin)
      url.searchParams.set('tab', 'transcript')
      url.searchParams.set('clip', clip.id)
      await navigator.clipboard.writeText(url.href)
      setNotice('Clip link copied. Meeting access is required.')
    } catch { setError('Could not copy the clip link.') }
  }

  const download = async (clip: SavedClip) => {
    setExporting(true)
    setError('')
    setNotice('')
    const label = tracks.find(option => option.id === track)?.label ?? 'Combined'
    const filename = `${clip.title} - ${label}`.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 120) + '.webm'
    try {
      await recordingsApi.downloadClip(meetingId, clip.id, track, filename)
    } catch { setError('Could not download the clip. Try again.') }
    finally { setExporting(false) }
  }

  const excerpt = valid ? transcript?.filter((line, index) =>
    line.atMs < range.endMs && (line.endMs ?? transcript[index + 1]?.atMs ?? line.atMs + 1) > range.startMs) : undefined
  return (
    <section className="bs-recording-clips" aria-label="Recap clips">
      <div className="bs-recording-clip-actions">
        <Key size="sm" aria-pressed={drawing} onClick={onDraw}>{drawing ? 'Cancel range selection' : 'Select on waveform'}</Key>
        <Key size="sm" disabled={!valid} onClick={() => onPreview(range)}>Preview clip</Key>
      </div>
      {drawing && <p className="bs-recording-clip-help" role="status">Drag across the Combined waveform to select a range.</p>}
      <div className="bs-recording-clip-times">
        {(['startMs', 'endMs'] as const).map((edge, index) => {
          const label = index === 0 ? 'Start' : 'End'
          return <div key={edge}>
            <label>{label} (seconds)
              <input className="bs-input" type="number" min={0} max={durationMs / 1000} step={0.001}
                value={Number.isFinite(range[edge]) ? range[edge] / 1000 : ''}
                onChange={event => onRange({ ...range, [edge]: Math.round(event.currentTarget.valueAsNumber * 1000) })} />
            </label>
            <Key size="sm" onClick={() => onRange({ ...range, [edge]: Math.min(durationMs, Math.round(position)) })}>
              Set {label.toLowerCase()} at playhead
            </Key>
          </div>
        })}
      </div>
      <form className="bs-recording-clip-actions" onSubmit={event => {
        event.preventDefault()
        if (valid && title.trim() && !saving) void save()
      }}>
        <label>Clip name <input className="bs-input" value={title} maxLength={120} onChange={event => setTitle(event.currentTarget.value)} /></label>
        <Key type="submit" size="sm" disabled={!valid || !title.trim() || saving || Boolean(active && title.trim() === active.title)}>
          {saving ? 'Saving clip…' : 'Save clip'}
        </Key>
      </form>
      {active && <div className="bs-recording-clip-actions">
        <Key size="sm" onClick={() => void copyLink(active)}>Copy clip link</Key>
        <label>Download source
          <select className="bs-key" value={track} onChange={event => {
            const selectedTrack = tracks.find(option => option.id === event.currentTarget.value)
            if (selectedTrack) setTrack(selectedTrack.id)
          }}>
            {tracks.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <Key size="sm" disabled={exporting} onClick={() => void download(active)}>{exporting ? 'Preparing clip…' : 'Download clip'}</Key>
      </div>}
      {excerpt && excerpt.length > 0 && <details open={Boolean(sharedClipId)}>
        <summary>Clip transcript</summary>
        <ol className="bs-recording-clip-transcript">
          {excerpt.map(line => <li key={line.eventId ?? `${line.atMs}-${line.speaker}`}>{formatClock(line.atMs)} · <strong>{line.speaker}</strong> {line.text}</li>)}
        </ol>
      </details>}
      {clips.length > 0 && <ul className="bs-recording-clip-list" aria-label="Saved clips">
        {clips.map(clip => <li key={clip.id}>
          <Key size="sm" aria-pressed={active?.id === clip.id} onClick={() => openClip(clip)}>{clip.title}</Key>
          <span>{formatClock(clip.startMs)}–{formatClock(clip.endMs)}</span>
        </li>)}
      </ul>}
      {notice && <p className="bs-recording-clip-help" role="status">{notice}</p>}
      {listError && <p className="bs-recording-error" role="alert">{listError}</p>}
      {error && <p className="bs-recording-error" role="alert">{error}</p>}
    </section>
  )
}
