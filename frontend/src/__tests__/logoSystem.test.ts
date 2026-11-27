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
  it('lists 18 systems, each with a loading motion', () => {
    expect(LOGO_SYSTEMS).toHaveLength(18)
    expect(LOGO_SYSTEMS.slice(0, 7).map((logo) => [logo.id, logo.motion])).toEqual([
      ['relay-orbits', 'Signal handoff'],
      ['relay', 'Resonant exchange'],
      ['orbit', 'Ribbon exchange'],
      ['orbital-network', 'Network convergence'],
      ['constellation', 'Triangulation'],
      ['trinity', 'Gate ignition'],
      ['slipstream', 'Current capture'],
    ])
    for (const logo of LOGO_SYSTEMS.slice(7)) expect(LOGO_MOTIONS[logo.id as keyof typeof LOGO_MOTIONS]).toBeDefined()
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
    expect(logoAsset('bloom', 1024)).toBe('/brand/bloom-1024.webp')
    expect(logoAsset('bloom', 'small')).toMatch(/bloom-compact[^?]*\.svg(?:\?.*)?$/)
    expect(logoAsset('flow-field', 1024)).toMatch(/rift[^?]*\.svg(?:\?.*)?$/)
    expect(logoAsset('flow-field', 'small')).toBe(`${logoAsset('flow-field', 1024)}#rift-mark-compact`)
    expect(logoAsset('nope', 512)).toBe(logoAsset(DEFAULT_LOGO, 512))
    expect(logoAsset(DEFAULT_LOGO, 512)).toMatch(/relay-orbits[^?]*\.svg(?:\?.*)?$/)
    expect(logoAsset(DEFAULT_LOGO, 'small')).toBe(`${logoAsset(DEFAULT_LOGO, 512)}#relay-orbits-compact`)
    expect(logoAsset('relay', 512)).toMatch(/relay[^?]*\.svg(?:\?.*)?$/)
    expect(logoAsset('relay', 'small')).toBe(`${logoAsset('relay', 512)}#relay-mark-compact`)
    expect(logoAsset('orbit', 512)).toBe('/brand/orbit-512.webp')
    expect(logoAsset('orbit', 'small')).toBe('/brand/orbit-small.webp')
    expect(logoAsset('orbital-network', 1024)).toBe('/brand/orbital-network-1024.webp')
    expect(logoAsset('orbital-network', 'small')).toMatch(/orbital-network-compact[^?]*\.svg(?:\?.*)?$/)
    expect(logoAsset('constellation', 1024)).toBe('/brand/constellation-1024.webp')
    expect(logoAsset('constellation', 'small')).toMatch(/constellation-compact[^?]*\.svg(?:\?.*)?$/)
    expect(logoAsset('trinity', 1024)).toMatch(/threshold[^?]*\.svg(?:\?.*)?$/)
    expect(logoAsset('trinity', 'small')).toMatch(/#threshold-compact$/)
    expect(logoAsset('slipstream', 1024)).toMatch(/slipstream[^?]*\.svg(?:\?.*)?$/)
    expect(logoAsset('slipstream', 'small')).toMatch(/#slipstream-compact$/)
    expect(logoAsset('catalyst-core', 512)).toMatch(/node-hands[^?]*\.svg(?:\?.*)?$/)
    expect(logoAsset('catalyst-core', 'small')).toBe(`${logoAsset('catalyst-core', 512)}#node-hands-compact`)
    expect(logoAsset('routed-signal', 512)).toMatch(/facet-hands[^?]*\.svg(?:\?.*)?$/)
    expect(logoAsset('routed-signal', 'small')).toBe(`${logoAsset('routed-signal', 512)}#facet-hands-compact`)
    expect(logoAsset('ignition', 1024)).toBe('/brand/ignition-1024.webp')
    expect(logoAsset('ignition', 'small')).toMatch(/ignition-compact[^?]*\.svg(?:\?.*)?$/)
    expect(logoAsset('aperture', 1024)).toBe('/brand/aperture-1024.webp')
    expect(logoAsset('aperture', 'small')).toMatch(/aperture-compact[^?]*\.svg(?:\?.*)?$/)
    expect(logoAsset('neural-core', 1024)).toBe('/brand/neural-core-1024.webp')
    expect(logoAsset('neural-core', 'small')).toMatch(/neural-core-compact[^?]*\.svg(?:\?.*)?$/)
    expect(logoAsset('ribbon-catalyst', 1024)).toBe('/brand/ribbon-catalyst-1024.webp')
    expect(logoAsset('ribbon-catalyst', 'small')).toMatch(/ribbon-catalyst-compact[^?]*\.svg(?:\?.*)?$/)
    expect(logoAsset('signal-cascade', 1024)).toBe('/brand/signal-cascade-1024.webp')
    expect(logoAsset('signal-cascade', 'small')).toMatch(/signal-cascade-compact[^?]*\.svg(?:\?.*)?$/)
    expect(logoById('nope').id).toBe(DEFAULT_LOGO)
    expect(isLogoId('trinity')).toBe(true)
  })

  it('loads Threshold for a saved Trinity selection', () => {
    localStorage.setItem(LOGO_KEY, 'trinity')
    __resetLogoForTests()
    expect(logoById(getLogo()).name).toBe('Threshold')
  })

  it('loads Rift for a saved Flow Field selection', () => {
    localStorage.setItem(LOGO_KEY, 'flow-field')
    __resetLogoForTests()
    expect(logoById(getLogo()).name).toBe('Rift')
  })
})
