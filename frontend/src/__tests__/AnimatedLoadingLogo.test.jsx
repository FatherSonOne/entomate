import React, { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AnimatedLoadingLogo from '../components/AnimatedLoadingLogo'

let reduced, onVisibility, onPreference, pause, play, hiddenDescriptor
const originalPause = Object.getOwnPropertyDescriptor(SVGSVGElement.prototype, 'pauseAnimations')
const originalPlay = Object.getOwnPropertyDescriptor(SVGSVGElement.prototype, 'unpauseAnimations')
beforeEach(() => {
  reduced = false
  hiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden')
  pause = vi.fn()
  play = vi.fn()
  Object.defineProperty(SVGSVGElement.prototype, 'pauseAnimations', { configurable: true, value: pause })
  Object.defineProperty(SVGSVGElement.prototype, 'unpauseAnimations', { configurable: true, value: play })
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: reduced,
    addEventListener: vi.fn((_, callback) => { onPreference = callback }),
    removeEventListener: vi.fn(),
  })))
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback) { onVisibility = callback }
    observe() {}
    disconnect() {}
  })
})
afterEach(() => {
  cleanup()
  window.localStorage.removeItem('entomate.loading.previous')
  if (originalPause) Object.defineProperty(SVGSVGElement.prototype, 'pauseAnimations', originalPause)
  else delete SVGSVGElement.prototype.pauseAnimations
  if (originalPlay) Object.defineProperty(SVGSVGElement.prototype, 'unpauseAnimations', originalPlay)
  else delete SVGSVGElement.prototype.unpauseAnimations
  if (hiddenDescriptor) Object.defineProperty(document, 'hidden', hiddenDescriptor)
  else delete document.hidden
  vi.unstubAllGlobals()
})

describe('shared animated application logo', () => {
  it('always uses Relay Orbits through Strict Mode and loader remounts, ignoring old rotation history', () => {
    window.localStorage.setItem('entomate.loading.previous', 'bloom')
    const first = render(<StrictMode><AnimatedLoadingLogo /></StrictMode>)
    expect(first.container.querySelector('[data-loading-logo]')).toHaveAttribute('data-loading-logo', 'relay-orbits')
    first.rerender(<StrictMode><AnimatedLoadingLogo /></StrictMode>)
    first.unmount()
    const second = render(<AnimatedLoadingLogo />)
    expect(second.container.querySelector('[data-loading-logo]')).toHaveAttribute('data-loading-logo', 'relay-orbits')
    expect(second.container.querySelector('svg image')).toHaveAttribute('href', '/brand/relay-orbits-512.webp')
    expect(window.localStorage.getItem('entomate.loading.previous')).toBe('bloom')
  })

  it('animates only when visible and pauses offscreen or when the document is hidden', () => {
    render(<AnimatedLoadingLogo />)
    expect(play).not.toHaveBeenCalled()
    act(() => onVisibility([{ isIntersecting: true }]))
    expect(play).toHaveBeenCalledOnce()
    act(() => onVisibility([{ isIntersecting: false }]))
    expect(pause).toHaveBeenCalled()
    act(() => onVisibility([{ isIntersecting: true }]))
    const before = pause.mock.calls.length
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    fireEvent(document, new Event('visibilitychange'))
    expect(pause.mock.calls.length).toBeGreaterThan(before)
  })

  it('keeps the same SVG when the user pauses and resumes', () => {
    const { container } = render(<AnimatedLoadingLogo />)
    const svg = container.querySelector('svg')
    fireEvent.click(screen.getByRole('button', { name: 'Pause loading animation' }))
    expect(screen.getByRole('button', { name: 'Play loading animation' })).toBeInTheDocument()
    expect(container.querySelector('svg')).toBe(svg)
    fireEvent.click(screen.getByRole('button', { name: 'Play loading animation' }))
    act(() => onVisibility([{ isIntersecting: true }]))
    expect(play).toHaveBeenCalled()
    expect(container.querySelector('svg')).toBe(svg)
  })

  it('starts still for reduced motion, allows opt-in, and honors a later preference change', () => {
    reduced = true
    const { container } = render(<AnimatedLoadingLogo />)
    act(() => onVisibility([{ isIntersecting: true }]))
    expect(play).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Play loading animation' }))
    act(() => onVisibility([{ isIntersecting: true }]))
    expect(container.querySelector('svg')).toHaveClass('motion-opt-in')
    expect(play).toHaveBeenCalled()
    act(() => onPreference({ matches: true }))
    expect(container.querySelector('svg')).not.toHaveClass('motion-opt-in')
    expect(screen.getByRole('button', { name: 'Play loading animation' })).toBeInTheDocument()
  })

  it('keeps a still mark if the browser cannot control SVG animation', () => {
    delete SVGSVGElement.prototype.pauseAnimations
    const { container } = render(<AnimatedLoadingLogo />)
    expect(container.querySelector('.en-app-loading-still svg')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('falls back to the compact brand mark if the illustrated image fails', () => {
    const { container } = render(<AnimatedLoadingLogo />)
    fireEvent.error(container.querySelector('svg image'))
    expect(container.querySelector('img')).toHaveAttribute('src', '/favicon.svg')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
