import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HERO_CLIPS, nextHeroClip } from '../components/heroRotation'

beforeEach(() => window.localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('landing hero rotation', () => {
  it('randomizes the first direction, then visits every requested clip before repeating', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.4)
    const cycle = Array.from({ length: 5 }, () => nextHeroClip())
    expect(cycle[0]).toBe('bridge')
    expect(new Set(cycle)).toEqual(new Set(HERO_CLIPS))
    expect(nextHeroClip()).toBe(cycle[0])
  })

  it('advances from a previous page load rather than repeating it', () => {
    window.localStorage.setItem('entomate.hero.previous', 'hands')
    expect(nextHeroClip()).toBe('bridge')
  })

  it('recovers from a stale direction', () => {
    window.localStorage.setItem('entomate.hero.previous', 'old-clip')
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(nextHeroClip()).toBe('workflow')
  })

  it('still renders a requested clip when browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    expect(nextHeroClip()).toBe('factors')
  })
})
