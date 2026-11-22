import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BrandMotion from '../components/BrandMotion'
import EnhancedLoadingScreen from '../components/EnhancedLoadingScreen'
import { LOGO_KEY, __resetLogoForTests, setLogo } from '../services/logoSystem'

vi.mock('../contexts/LoadingContext', () => ({
  useLoading: () => ({ progress: 63, currentStageLabel: 'Syncing services...' }),
}))

let reduced, onVisibility
beforeEach(() => {
  reduced = false
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: reduced, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })))
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback) { onVisibility = callback }
    observe() {}
    disconnect() {}
  })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.removeItem(LOGO_KEY); __resetLogoForTests() })

describe('Entomate brand motion', () => {
  it('defers video download until visible and pauses offscreen', () => {
    const { container } = render(<BrandMotion />)
    const video = container.querySelector('video')
    expect(video.getAttribute('src')).toBeNull()
    act(() => onVisibility([{ isIntersecting: true }]))
    expect(video.getAttribute('src')).toBe('/brand-lab/assets/motion/hands.mp4')
    expect(video.play).toHaveBeenCalledOnce()
    act(() => onVisibility([{ isIntersecting: false }]))
    expect(video.pause).toHaveBeenCalled()
  })

  it('shows a static poster without downloading video for reduced motion', () => {
    reduced = true
    const { container } = render(<BrandMotion clip="glyphs" />)
    act(() => onVisibility([{ isIntersecting: true }]))
    expect(container.querySelector('video').getAttribute('src')).toBeNull()
    expect(container.querySelector('img').src).toContain('glyphs.jpg')
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Play background animation' })).toBeInTheDocument()
  })

  it('lets the user opt into motion and pause it again', () => {
    reduced = true
    render(<BrandMotion />)
    act(() => onVisibility([{ isIntersecting: true }]))
    fireEvent.click(screen.getByRole('button', { name: 'Play background animation' }))
    act(() => onVisibility([{ isIntersecting: true }]))
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Pause background animation' }))
    expect(screen.getByRole('button', { name: 'Play background animation' })).toBeInTheDocument()
  })

  it('falls back to the still when media fails', () => {
    const { container } = render(<BrandMotion />)
    const video = container.querySelector('video')
    fireEvent.loadedData(video)
    expect(container.firstChild.className).toContain('brand-motion-ready')
    fireEvent.error(video)
    expect(container.firstChild.className).not.toContain('brand-motion-ready')
    expect(container.querySelector('img')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('preserves the real loading context progress and stage', () => {
    const { container } = render(<EnhancedLoadingScreen autoAnimate={false} />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading: Syncing services...')
    expect(screen.getByText('63%')).toBeInTheDocument()
    expect(container.querySelector('.en-signal-loader-track span')).toHaveStyle({ width: '63%' })
    expect(container.querySelector('video')).not.toBeInTheDocument()
    expect(container.querySelector('.en-app-loading-logo-art svg image').getAttribute('href'))
      .toBe('/brand/relay-orbits-1024.webp')
    expect(container.querySelector('.en-signal-loader-wordmark svg')).toHaveAttribute('aria-label', 'Entomate')
  })

  it('shows the logo system picked in Appearance and no invented percent', () => {
    setLogo('aperture')
    const { container } = render(<EnhancedLoadingScreen stage="page" />)
    expect(container.querySelector('[data-logo]')).toHaveAttribute('data-logo', 'aperture')
    expect(container.querySelector('svg image').getAttribute('href')).toBe('/brand/aperture-1024.webp')
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading: Loading')
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument()
  })

  it('previews a given logo and closes on Escape', () => {
    const onClose = vi.fn()
    render(<EnhancedLoadingScreen stage="preview" logoId="bloom" onClose={onClose} />)
    expect(screen.getByRole('dialog', { name: 'Bloom loading screen preview' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
