/**
 * "Nothing is coming in" watch for the browser recorder.
 *
 * A muted microphone, the wrong input device or a tab shared without its sound all
 * record happily: the timer runs and pieces upload, and the meeting comes back as
 * "No speech was heard" an hour later. This reads the level of the mixed audio and
 * says so while there is still time to fix it.
 */

/** Below this RMS level (about -42 dBFS) the input counts as silent. */
export const SILENCE_LEVEL = 0.008
/** How long the input must stay silent before the recorder warns. */
export const SILENCE_WARN_MS = 20_000

/** RMS level, 0 to 1, of analyser time-domain bytes (128 is silence). */
export function levelOf(samples: ArrayLike<number>): number {
  if (!samples.length) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    const v = ((samples[i] ?? 128) - 128) / 128
    sum += v * v
  }
  return Math.sqrt(sum / samples.length)
}

/** Tracks how long the input has been silent. Feed it a level now and then. */
export class SilenceWatch {
  private quietSince: number | null

  constructor(startedAt: number) {
    this.quietSince = startedAt
  }

  /** @returns ms of unbroken silence up to `now` (0 while there is sound). */
  push(level: number, now: number): number {
    if (level >= SILENCE_LEVEL) {
      this.quietSince = null
      return 0
    }
    if (this.quietSince === null) this.quietSince = now
    return now - this.quietSince
  }
}

/** The warning to show, or null while sound is coming in. */
export function silenceMessage(silentMs: number, mode: 'mic' | 'camera' | 'tab'): string | null {
  if (silentMs < SILENCE_WARN_MS) return null
  const secs = Math.floor(silentMs / 1000)
  const span = secs >= 120 ? `${Math.floor(secs / 60)} minutes` : `${secs} seconds`
  return mode === 'tab'
    ? `No sound for ${span}. Check that the call's tab is shared with its sound and that the call isn't muted. Nothing useful is being recorded right now.`
    : `No sound for ${span}. Check that your microphone isn't muted and that the right one is chosen in Settings. Nothing useful is being recorded right now.`
}
