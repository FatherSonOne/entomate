const BARS = 160
const MAX_BYTES = 48 * 1024 * 1024
const MAX_DURATION_MS = 3 * 60 * 60 * 1000

async function recordingBytes(source: string | Blob, signal: AbortSignal): Promise<ArrayBuffer> {
  if (typeof source !== 'string') {
    if (source.size > MAX_BYTES) throw new Error('Recording is too large to visualize')
    return source.arrayBuffer()
  }

  const response = await fetch(source, { signal, credentials: 'omit' })
  if (!response.ok || !response.body || Number(response.headers.get('Content-Length')) > MAX_BYTES) {
    await response.body?.cancel()
    throw new Error('Recording could not be read for visualization')
  }
  const reader = response.body.getReader()
  const parts: Uint8Array<ArrayBuffer>[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > MAX_BYTES) {
        await reader.cancel()
        throw new Error('Recording is too large to visualize')
      }
      parts.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return new Blob(parts).arrayBuffer()
}

/** Draw one peak per time bucket from every channel of the actual recording. */
export async function readRecordingWaveform(
  source: string | Blob,
  durationMs: number,
  signal: AbortSignal,
): Promise<string> {
  if (typeof OfflineAudioContext === 'undefined' || durationMs > MAX_DURATION_MS) {
    throw new Error('Waveform unavailable')
  }
  const bytes = await recordingBytes(source, signal)
  signal.throwIfAborted()
  // Resample at speech bandwidth to keep decoded recordings small.
  const audio = await new OfflineAudioContext(1, 1, 8000).decodeAudioData(bytes)
  signal.throwIfAborted()
  const bars = Math.min(BARS, audio.length)
  const peaks = new Float32Array(bars)
  for (let channel = 0; channel < audio.numberOfChannels; channel++) {
    const samples = audio.getChannelData(channel)
    for (let bar = 0; bar < bars; bar++) {
      const start = Math.floor(bar * samples.length / bars)
      const end = Math.floor((bar + 1) * samples.length / bars)
      let peak = peaks[bar]!
      for (let i = start; i < end; i++) peak = Math.max(peak, Math.abs(samples[i]!))
      peaks[bar] = peak
    }
  }

  return waveformFromPeaks(peaks)
}

export function waveformFromPeaks(peaks: ArrayLike<number>): string {
  const levels = Array.from(peaks)
  const gain = Math.max(0.025, ...levels)
  const bars = levels.length
  const pitch = 1000 / bars
  const width = (pitch * 0.62).toFixed(2)
  return levels.map((peak, index) => {
    const height = Math.sqrt(peak / gain) * 35
    if (height < 0.2) return ''
    const x = ((index + 0.19) * pitch).toFixed(2)
    return `M${x},${(40 - height).toFixed(2)}h${width}v${(2 * height).toFixed(2)}h-${width}Z`
  }).join('')
}
