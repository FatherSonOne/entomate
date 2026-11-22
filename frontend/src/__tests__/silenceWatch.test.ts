import { describe, test, expect } from 'vitest'
import { SILENCE_WARN_MS, SilenceWatch, levelOf, silenceMessage } from '../services/silenceWatch'

describe('silenceWatch', () => {
  test('levelOf: 128 is silence, a full swing is loud', () => {
    expect(levelOf(new Uint8Array(64).fill(128))).toBe(0)
    expect(levelOf(Uint8Array.from({ length: 64 }, (_, i) => (i % 2 ? 0 : 255)))).toBeGreaterThan(0.9)
    expect(levelOf([])).toBe(0)
  })

  test('counts unbroken silence from the start, and sound resets it', () => {
    const w = new SilenceWatch(0)
    expect(w.push(0, 10_000)).toBe(10_000)
    expect(w.push(0.2, 11_000)).toBe(0)
    expect(w.push(0, 12_000)).toBe(0)
    expect(w.push(0, 40_000)).toBe(28_000)
  })

  test('warns only after the threshold, with advice for the mode', () => {
    expect(silenceMessage(SILENCE_WARN_MS - 1, 'mic')).toBeNull()
    expect(silenceMessage(25_000, 'mic')).toMatch(/No sound for 25 seconds.*microphone/)
    expect(silenceMessage(185_000, 'tab')).toMatch(/No sound for 3 minutes.*tab is shared/)
  })
})
