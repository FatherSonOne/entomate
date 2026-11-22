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
  it('plays the loading motion in the picked card only, and moves it on a new pick', () => {
    const { container } = render(<LogoSystemPicker />)
    const live = () => [...container.querySelectorAll('.lp-card [data-loading-logo]')].map((el) => el.getAttribute('data-loading-logo'))
    expect(live()).toEqual(['relay-orbits'])
    fireEvent.click(card('Aperture'))
    expect(live()).toEqual(['aperture'])
    expect(card('Aperture').getAttribute('aria-checked')).toBe('true')
  })

  it('nests no buttons inside the cards', () => {
    const { container } = render(<LogoSystemPicker />)
    expect(container.querySelector('.lp-card button')).toBeNull()
  })
})
