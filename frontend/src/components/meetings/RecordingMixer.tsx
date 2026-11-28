import React, { useEffect, useRef, useState } from 'react'
import { Key } from '../bench'
import { recordingsApi } from '../../services/api'
import type { RoomParticipantTrack } from '../../services/recordingAudioTracks'

type Gains = Partial<Record<RoomParticipantTrack, number>>
interface SavedMix { gains: Gains }
const signature = (gains: Gains) => JSON.stringify(Object.entries(gains).sort())

export function useRecordingMix(meetingId: string, enabled: boolean, onPreview: (blob: Blob) => void) {
  const [loaded, setLoaded] = useState(false)
  const [gains, setGains] = useState<Gains>({})
  const [saved, setSaved] = useState<SavedMix | null>(null)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const cache = useRef<{ key: string; audio: Blob } | null>(null)
  const latest = useRef(onPreview)
  latest.current = onPreview

  useEffect(() => {
    if (!enabled || loaded) return
    const controller = new AbortController()
    void recordingsApi.recordingMix(meetingId, controller.signal).then(result => {
      if (controller.signal.aborted) return
      const { mix } = result as unknown as { mix: SavedMix | null }
      setSaved(mix)
      setGains(mix?.gains ?? {})
      setLoaded(true)
    }).catch(() => {
      if (!controller.signal.aborted) setError('Mix settings could not be loaded. Reopen the mixer to try again.')
    })
    return () => controller.abort()
  }, [enabled, loaded, meetingId])

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label)
    setError('')
    setNotice('')
    try { await action() }
    catch { setError('The mixer could not complete this action. Try again shortly.') }
    finally { setBusy('') }
  }
  const preview = () => run('Preparing adjusted preview…', async () => {
    const key = signature(gains)
    if (cache.current?.key !== key) {
      const audio = await recordingsApi.previewRecordingMix(meetingId, gains) as unknown as Blob
      if (!(audio instanceof Blob) || !audio.size) throw new Error('Empty preview')
      cache.current = { key, audio }
    }
    latest.current(cache.current.audio)
  })
  const balance = () => run('Measuring participant loudness…', async () => {
    const result = await recordingsApi.balanceRecordingMix(meetingId) as unknown as { gains: Gains }
    setGains(result.gains)
    setNotice('Suggested volumes applied. Preview the adjusted mix to listen.')
  })
  const save = () => run('Saving adjusted mix…', async () => {
    const result = await recordingsApi.saveRecordingMix(meetingId, gains) as unknown as { mix: SavedMix }
    setSaved(result.mix)
    setNotice('Adjusted mix saved.')
  })

  return {
    gains, saved, loaded, busy, notice, error,
    needsPreview: cache.current?.key !== signature(gains),
    setGain: (track: RoomParticipantTrack, gain: number) => {
      setGains(current => ({ ...current, [track]: gain }))
      setNotice('')
    },
    preview, balance, save,
    download: () => run('Preparing mix download…', () => recordingsApi.downloadRecordingMix(meetingId)),
  }
}

export function RecordingMixer({
  mixer, source, onCombined,
}: {
  mixer: ReturnType<typeof useRecordingMix>
  source: 'combined' | 'adjusted' | 'participant'
  onCombined: () => void
}) {
  const blocked = !mixer.loaded || Boolean(mixer.busy)
  return (
    <section className="bs-recording-clips" aria-label="Recap mixer">
      <div className="bs-recording-clip-actions">
        <Key size="sm" disabled={blocked} onClick={() => void mixer.balance()}>Balance voices</Key>
        <div className="bs-recording-clip-actions" role="group" aria-label="Compare mixes">
          <Key size="sm" aria-pressed={source === 'combined'} onClick={onCombined}>Original Combined</Key>
          <Key size="sm" aria-pressed={source === 'adjusted'} disabled={blocked} onClick={() => void mixer.preview()}>
            {source === 'adjusted' && mixer.needsPreview ? 'Refresh adjusted preview' : 'Preview adjusted mix'}
          </Key>
        </div>
        <Key size="sm" disabled={blocked} onClick={() => void mixer.save()}>Save adjusted mix</Key>
        {mixer.saved && <Key size="sm" disabled={Boolean(mixer.busy)} onClick={() => void mixer.download()}>Download saved mix</Key>}
      </div>
      <p className="bs-recording-clip-help">Adjust each participant’s volume on the timeline, then preview the mix.</p>
      {(mixer.busy || mixer.notice || (!mixer.loaded && !mixer.error)) && <p className="bs-recording-clip-help" role="status">
        {mixer.busy || mixer.notice || 'Loading mix settings…'}
      </p>}
      {mixer.error && <p className="bs-recording-error" role="alert">{mixer.error}</p>}
    </section>
  )
}
