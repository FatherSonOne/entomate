import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LOADING_LOGOS, nextLoadingLogo } from '../components/loadingLogoRotation'
import { LOGO_MOTIONS } from '../components/logoMotion'

beforeEach(() => window.localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('application loading logo rotation', () => {
  it('visits all 17 animated directions before repeating', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.25)
    const cycle = Array.from({ length: 17 }, () => nextLoadingLogo())
    expect(cycle[0]).toBe('bloom')
    expect(new Set(cycle)).toEqual(new Set(Object.keys(LOGO_MOTIONS)))
    expect(new Set(cycle).size).toBe(17)
    expect(nextLoadingLogo()).toBe(cycle[0])
  })

  it('advances from the previous app load and wraps the last direction', () => {
    window.localStorage.setItem('entomate.loading.previous', 'circuit-e')
    expect(nextLoadingLogo()).toBe('catalyst-core')
    window.localStorage.setItem('entomate.loading.previous', 'ribbon-catalyst')
    expect(nextLoadingLogo()).toBe('relay')
  })

  it('recovers from a stale stored direction', () => {
    window.localStorage.setItem('entomate.loading.previous', 'removed-logo')
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(nextLoadingLogo()).toBe('relay')
  })

  it('still loads an eligible logo when storage access is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    expect(nextLoadingLogo()).toBe('ribbon-catalyst')
  })

  it('keeps the next distinct logo if persisting the selection fails', () => {
    window.localStorage.setItem('entomate.loading.previous', 'bloom')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    expect(nextLoadingLogo()).toBe('circuit-spire')
  })
})
