import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_LOGO, LOGO_FAMILIES, LOGO_KEY, LOGO_SYSTEMS, __resetLogoForTests, getLogo, isLogoId,
  logoAsset, logoById, logosInFamily, setLogo,
} from '../services/logoSystem'
import { LOGO_MOTIONS } from '../components/logoMotion'

afterEach(() => {
  localStorage.removeItem(LOGO_KEY)
  __resetLogoForTests()
})

describe('logo systems', () => {
  it('lists 17 systems, each with a loading motion', () => {
    expect(LOGO_SYSTEMS).toHaveLength(17)
    for (const l of LOGO_SYSTEMS) expect(LOGO_MOTIONS[l.id as keyof typeof LOGO_MOTIONS]).toBeDefined()
  })

  it('puts every system in exactly one family', () => {
    const total = LOGO_FAMILIES.reduce((n, f) => n + logosInFamily(f.id).length, 0)
    expect(total).toBe(LOGO_SYSTEMS.length)
  })

  it('defaults to Relay Orbits and ignores unknown saved values', () => {
    expect(getLogo()).toBe(DEFAULT_LOGO)
    localStorage.setItem(LOGO_KEY, 'not-a-logo')
    __resetLogoForTests()
    expect(getLogo()).toBe(DEFAULT_LOGO)
  })

  it('saves a valid pick and refuses an invalid one', () => {
    setLogo('aperture')
    expect(getLogo()).toBe('aperture')
    expect(localStorage.getItem(LOGO_KEY)).toBe('aperture')
    setLogo('nope')
    expect(getLogo()).toBe('aperture')
  })

  it('builds asset paths and falls back for unknown ids', () => {
    expect(logoAsset('bloom', 'small')).toBe('/brand/bloom-small.webp')
    expect(logoAsset('nope', 512)).toBe(`/brand/${DEFAULT_LOGO}-512.webp`)
    expect(logoById('nope').id).toBe(DEFAULT_LOGO)
    expect(isLogoId('trinity')).toBe(true)
  })
})
