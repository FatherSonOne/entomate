import React from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LogoSystemPicker from '../components/settings/LogoSystemPicker'
import { __resetLogoForTests, logoAsset, LOGO_KEY, LOGO_SYSTEMS } from '../services/logoSystem'

beforeEach(() => {
  window.localStorage.removeItem(LOGO_KEY)
  __resetLogoForTests()
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} })
})
afterEach(() => {
  cleanup()
  delete document.documentElement.dataset.motion
  window.localStorage.removeItem(LOGO_KEY)
  vi.unstubAllGlobals()
})

const card = (name) => screen.getAllByRole('radio').find((el) => el.textContent.includes(name) && el.textContent.startsWith(name))

describe('logo system picker', () => {
  it('plays the motion in the picked card until a pick docks the side panel, which follows each pick', () => {
    const { container } = render(<LogoSystemPicker />)
    const inCards = () => [...container.querySelectorAll('.lp-card [data-loading-logo]')].map((el) => el.getAttribute('data-loading-logo'))
    const inPanel = () => document.querySelector('.lp-panel [data-loading-logo]')?.getAttribute('data-loading-logo')
    expect(inCards()).toEqual(['relay-orbits'])
    fireEvent.click(card('Aperture'))
    expect(card('Aperture').getAttribute('aria-checked')).toBe('true')
    expect(inPanel()).toBe('aperture')
    expect(inCards()).toEqual([])
    expect(document.querySelector('.bs-scrim')).toBeNull()
    fireEvent.click(card('Bloom'))
    expect(inPanel()).toBe('bloom')
  })

  it('stays closed on later picks once closed by hand', () => {
    render(<LogoSystemPicker />)
    fireEvent.click(card('Aperture'))
    fireEvent.click(screen.getByRole('button', { name: 'Hide preview' }))
    fireEvent.click(card('Bloom'))
    expect(screen.getByRole('button', { name: 'Show preview' })).toBeTruthy()
  })

  it.each([
    ['constellation', 'Constellation', 'Triangulation'],
    ['trinity', 'Threshold', 'Gate ignition'],
    ['slipstream', 'Slipstream', 'Current capture'],
  ])('opens the %s full-screen preview with the chosen artwork', (id, name, motion) => {
    render(<LogoSystemPicker />)
    const choice = card(name)
    fireEvent.click(choice)
    expect(choice).toHaveAttribute('aria-checked', 'true')
    expect(document.querySelector('.lp-bar img[data-brand-mark]')).toHaveAttribute('src', logoAsset(id, 'small'))
    fireEvent.click(screen.getByRole('button', { name: 'Full-screen preview' }))
    const preview = screen.getByRole('dialog', { name: new RegExp(name) })
    expect(preview).toHaveTextContent(motion)
    expect(preview.querySelector('[data-loading-logo] svg')).toHaveAttribute('aria-label', name)
    expect(document.querySelector('.lp-panel [data-loading-logo]')).toBeNull()
  })

  it('nests no buttons inside the cards', () => {
    const { container } = render(<LogoSystemPicker />)
    expect(container.querySelector('.lp-card button')).toBeNull()
  })

  it('compares every still mark and live animation without changing the active logo', () => {
    render(<LogoSystemPicker />)
    fireEvent.click(screen.getByRole('button', { name: 'Preview all 18' }))
    const gallery = screen.getByRole('region', { name: 'Logo and animation gallery' })
    for (const logo of LOGO_SYSTEMS) {
      const card = within(gallery).getByRole('heading', { name: logo.name }).closest('li')
      expect(card.querySelector('img')).toHaveAttribute('src', logoAsset(logo.id, 256))
      expect(card.querySelector('[data-loading-logo]')).toHaveAttribute('data-loading-logo', logo.id)
    }

    fireEvent.click(within(gallery).getByRole('button', { name: 'Pause Aperture loading animation' }))
    expect(within(gallery).getByRole('button', { name: 'Play Aperture loading animation' })).toBeInTheDocument()
    expect(within(gallery).getByRole('button', { name: 'Pause Bloom loading animation' })).toBeInTheDocument()
    fireEvent.click(within(gallery).getByRole('button', { name: 'Pause all' }))
    expect(within(gallery).getAllByRole('button', { name: /Play .* loading animation/ })).toHaveLength(18)
    fireEvent.click(within(gallery).getByRole('button', { name: 'Play all' }))
    expect(within(gallery).getAllByRole('button', { name: /Pause .* loading animation/ })).toHaveLength(18)
    expect(window.localStorage.getItem(LOGO_KEY)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Close gallery' }))
    expect(gallery).not.toBeInTheDocument()
  })

  it('starts still with reduced motion and plays a loop only after opt-in', () => {
    document.documentElement.dataset.motion = 'reduce'
    render(<LogoSystemPicker />)
    fireEvent.click(screen.getByRole('button', { name: 'Preview all 18' }))
    const gallery = screen.getByRole('region', { name: 'Logo and animation gallery' })
    expect(within(gallery).getByRole('button', { name: 'Play all' })).toBeInTheDocument()
    expect(within(gallery).getAllByRole('button', { name: /Play .* loading animation/ })).toHaveLength(18)
    fireEvent.click(within(gallery).getByRole('button', { name: 'Play Relay loading animation' }))
    expect(gallery.querySelector('[data-loading-logo="relay"] svg')).toHaveClass('motion-opt-in')
    expect(within(gallery).getByRole('button', { name: 'Play Relay Orbits loading animation' })).toBeInTheDocument()
  })
})
