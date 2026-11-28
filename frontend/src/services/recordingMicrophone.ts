import { pickAudioMime, recorderOptions } from './meetingRecorderService'

export const MIC_MODES = {
  'noise-reduction': 'Noise reduction',
  original: 'Original mic',
} as const

export type MicMode = keyof typeof MIC_MODES
export const MIC_CHECK_MS = 5000

export const MIC_CHECK_LEVELS = {
  good: ['Good level', 'Keep speaking at this distance.'],
  quiet: ['Too quiet', 'Move closer to the microphone or raise its input level.'],
  clipping: ['Near clipping', 'Move farther from the microphone or lower its input level.'],
  silent: ['No signal', 'Check the microphone’s mute switch or pick another input.'],
} as const

export type MicCheckLevel = keyof typeof MIC_CHECK_LEVELS

export async function measureMicCheck(sample: Blob): Promise<MicCheckLevel | null> {
  try {
    const decoder = new OfflineAudioContext(1, 1, 48_000)
    const audio = await decoder.decodeAudioData(await sample.arrayBuffer())
    const windowSamples = Math.round(audio.sampleRate / 10)
    let loudest = 0
    // Use 100 ms windows so pauses between words don't make speech look quiet.
    for (let channel = 0; channel < audio.numberOfChannels; channel++) {
      const data = audio.getChannelData(channel)
      for (let start = 0; start < data.length; start += windowSamples) {
        const end = Math.min(start + windowSamples, data.length)
        let squares = 0
        for (let i = start; i < end; i++) {
          const value = data[i]
          if (Math.abs(value) >= 0.97) return 'clipping'
          squares += value * value
        }
        loudest = Math.max(loudest, Math.sqrt(squares / (end - start)))
      }
    }
    if (loudest < 0.003) return 'silent'
    return loudest < 0.02 ? 'quiet' : 'good'
  } catch {
    // Some browsers can play their recording format but can't decode it through Web Audio.
    return null
  }
}

export function microphoneConstraints(mode: MicMode, deviceId?: string): MediaTrackConstraints {
  return {
    echoCancellation: true,
    noiseSuppression: mode === 'noise-reduction',
    ...(deviceId && deviceId !== 'default' ? { deviceId: { exact: deviceId } } : {}),
  }
}

export function reportedMicMode(track: MediaStreamTrack): MicMode | null {
  const reduction = track.getSettings?.().noiseSuppression
  return typeof reduction === 'boolean' ? reduction ? 'noise-reduction' : 'original' : null
}

export async function applyMicMode(track: MediaStreamTrack, mode: MicMode): Promise<MicMode | null> {
  await track.applyConstraints({
    ...track.getConstraints?.(),
    noiseSuppression: { exact: mode === 'noise-reduction' },
  })
  return reportedMicMode(track)
}

export async function captureMicCheck(mode: MicMode, deviceId: string | undefined, signal: AbortSignal) {
  const mimeType = typeof MediaRecorder === 'undefined' ? null : pickAudioMime(type => MediaRecorder.isTypeSupported(type))
  if (!mimeType || !navigator.mediaDevices?.getUserMedia) throw new Error('This browser cannot record a mic check.')
  const stream = await navigator.mediaDevices.getUserMedia({ audio: microphoneConstraints(mode, deviceId) })
  let recorder: MediaRecorder | undefined
  let timer: number | undefined
  let clearListeners: (() => void) | undefined
  try {
    signal.throwIfAborted()
    const track = stream.getAudioTracks()[0]
    if (!track || track.readyState !== 'live') throw new Error('The microphone did not provide audio.')
    const check = new MediaRecorder(stream, recorderOptions('audio', mimeType))
    recorder = check
    const parts: Blob[] = []
    const sample = await new Promise<Blob>((resolve, reject) => {
      const abort = () => reject(signal.reason)
      const ended = () => reject(new Error('The microphone disconnected during the mic check.'))
      const fail = () => reject(new Error('The mic check could not be recorded.'))
      check.ondataavailable = ({ data }) => { if (data.size) parts.push(data) }
      const stop = () => {
        if (parts.length) resolve(new Blob(parts, { type: check.mimeType || mimeType }))
        else reject(new Error('The microphone did not provide a sample.'))
      }
      signal.addEventListener('abort', abort, { once: true })
      track.addEventListener('ended', ended, { once: true })
      check.addEventListener('error', fail, { once: true })
      check.addEventListener('stop', stop, { once: true })
      clearListeners = () => {
        signal.removeEventListener('abort', abort)
        track.removeEventListener('ended', ended)
        check.removeEventListener('error', fail)
        check.removeEventListener('stop', stop)
        check.ondataavailable = null
      }
      check.start()
      timer = window.setTimeout(() => { if (check.state !== 'inactive') check.stop() }, MIC_CHECK_MS)
    })
    return { sample, label: track.label, mode: reportedMicMode(track) }
  } finally {
    if (timer !== undefined) window.clearTimeout(timer)
    clearListeners?.()
    try {
      if (recorder && recorder.state !== 'inactive') recorder.stop()
    } finally {
      stream.getTracks().forEach(track => track.stop())
    }
  }
}
