import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LogoSystemPicker from '../components/settings/LogoSystemPicker'
import { __resetLogoForTests, LOGO_KEY } from '../services/logoSystem'

beforeEach(() => {
  window.localStorage.removeItem(LOGO_KEY)
  __resetLogoForTests()
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} })
})
afterEach(() => {
  cleanup()
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

  it('nests no buttons inside the cards', () => {
    const { container } = render(<LogoSystemPicker />)
    expect(container.querySelector('.lp-card button')).toBeNull()
  })
})
