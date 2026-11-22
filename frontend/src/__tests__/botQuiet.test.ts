import { describe, test, expect } from 'vitest'
import { QUIET_WARN_MS, quietWarning } from '../services/botView'

const T0 = Date.parse('2026-11-22T15:00:00Z')
const iso = (ms: number): string => new Date(ms).toISOString()
const base = { startedAt: iso(T0), lastLineAt: null, watchingSince: iso(T0 - 3600_000), captionsOn: true, paused: false }

describe('quietWarning', () => {
  test('warns after two minutes with no captions while recording', () => {
    expect(quietWarning(base, T0 + QUIET_WARN_MS - 1)).toBeNull()
    expect(quietWarning(base, T0 + 3 * 60_000)).toMatch(/Nothing heard for 3 minutes/)
  })
  test('a caption line resets the clock; a restart of the server too', () => {
    expect(quietWarning({ ...base, lastLineAt: iso(T0 + 5 * 60_000) }, T0 + 6 * 60_000)).toBeNull()
    expect(quietWarning({ ...base, watchingSince: iso(T0 + 5 * 60_000) }, T0 + 6 * 60_000)).toBeNull()
  })
  test('never warns while not recording, or when captions are off', () => {
    expect(quietWarning({ ...base, paused: true }, T0 + 10 * 60_000)).toBeNull()
    expect(quietWarning({ ...base, captionsOn: false }, T0 + 10 * 60_000)).toBeNull()
    expect(quietWarning({ ...base, captionsOn: null }, T0 + 10 * 60_000)).toBeNull()
  })
})
