import React, { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gsap } from 'gsap/gsap-core.js'
import AnimatedLoadingLogo from '../components/AnimatedLoadingLogo'
import { applyReduceMotion } from '../components/bench/motion'

let reduced, onVisibility, onPreference, hiddenDescriptor
const originalPause = Object.getOwnPropertyDescriptor(SVGSVGElement.prototype, 'pauseAnimations')
const originalPlay = Object.getOwnPropertyDescriptor(SVGSVGElement.prototype, 'unpauseAnimations')
beforeEach(() => {
  reduced = false
  hiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden')
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
  applyReduceMotion(false)
  window.localStorage.removeItem('entomate.loading.previous')
  if (originalPause) Object.defineProperty(SVGSVGElement.prototype, 'pauseAnimations', originalPause)
  else delete SVGSVGElement.prototype.pauseAnimations
  if (originalPlay) Object.defineProperty(SVGSVGElement.prototype, 'unpauseAnimations', originalPlay)
  else delete SVGSVGElement.prototype.unpauseAnimations
  if (hiddenDescriptor) Object.defineProperty(document, 'hidden', hiddenDescriptor)
  else delete document.hidden
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function timelineFor(target) {
  return gsap.globalTimeline.getChildren(false, false, true).find((candidate) =>
    candidate.getChildren().some((tween) => tween.targets?.().includes(target)),
  )
}

describe('shared animated application logo', () => {
  it('always uses Relay Orbits through Strict Mode and loader remounts, ignoring old rotation history', () => {
    window.localStorage.setItem('entomate.loading.previous', 'bloom')
    const first = render(<StrictMode><AnimatedLoadingLogo /></StrictMode>)
    expect(first.container.querySelector('[data-loading-logo]')).toHaveAttribute('data-loading-logo', 'relay-orbits')
    first.rerender(<StrictMode><AnimatedLoadingLogo /></StrictMode>)
    first.unmount()
    const second = render(<AnimatedLoadingLogo />)
    expect(second.container.querySelector('[data-loading-logo]')).toHaveAttribute('data-loading-logo', 'relay-orbits')
    expect(second.container.querySelector('svg [data-hull]')).toBeInTheDocument()
    expect(window.localStorage.getItem('entomate.loading.previous')).toBe('bloom')
  })

  it('animates only when visible and pauses offscreen or when the document is hidden', () => {
    const { container } = render(<AnimatedLoadingLogo />)
    const timeline = timelineFor(container.querySelector('[data-outbound]'))
    expect(timeline.paused()).toBe(true)
    act(() => onVisibility([{ isIntersecting: true }]))
    expect(timeline.paused()).toBe(false)
    act(() => onVisibility([{ isIntersecting: false }]))
    expect(timeline.paused()).toBe(true)
    act(() => onVisibility([{ isIntersecting: true }]))
    expect(timeline.paused()).toBe(false)
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    fireEvent(document, new Event('visibilitychange'))
    expect(timeline.paused()).toBe(true)
  })

  it('keeps the same SVG when the user pauses and resumes', () => {
    const { container } = render(<AnimatedLoadingLogo />)
    const svg = container.querySelector('svg')
    fireEvent.click(screen.getByRole('button', { name: 'Pause loading animation' }))
    expect(screen.getByRole('button', { name: 'Play loading animation' })).toBeInTheDocument()
    expect(container.querySelector('svg')).toBe(svg)
    fireEvent.click(screen.getByRole('button', { name: 'Play loading animation' }))
    act(() => onVisibility([{ isIntersecting: true }]))
    expect(timelineFor(svg.querySelector('[data-outbound]')).paused()).toBe(false)
    expect(container.querySelector('svg')).toBe(svg)
  })

  it('starts still for reduced motion, allows opt-in, and honors a later preference change', () => {
    reduced = true
    const { container } = render(<AnimatedLoadingLogo />)
    const signal = container.querySelector('[data-outbound]')
    act(() => onVisibility([{ isIntersecting: true }]))
    expect(timelineFor(signal)).toBeUndefined()
    fireEvent.click(screen.getByRole('button', { name: 'Play loading animation' }))
    act(() => onVisibility([{ isIntersecting: true }]))
    expect(container.querySelector('svg')).toHaveClass('motion-opt-in')
    expect(timelineFor(signal).paused()).toBe(false)
    reduced = false
    act(() => onPreference())
    reduced = true
    act(() => onPreference())
    expect(container.querySelector('svg')).not.toHaveClass('motion-opt-in')
    expect(screen.getByRole('button', { name: 'Play loading animation' })).toBeInTheDocument()
  })

  it('switches an already-open loader to a still mark when the in-app setting changes', async () => {
    const { container } = render(<AnimatedLoadingLogo />)
    const signal = container.querySelector('[data-outbound]')
    act(() => onVisibility([{ isIntersecting: true }]))
    expect(timelineFor(signal).paused()).toBe(false)
    applyReduceMotion(true)
    await waitFor(() => expect(container.querySelector('svg')).toHaveClass('motion-still'))
    expect(timelineFor(signal)).toBeUndefined()
    expect(screen.getByRole('button', { name: 'Play loading animation' })).toBeInTheDocument()
  })

  it('plays the authored vector animation without native SVG animation controls', () => {
    delete SVGSVGElement.prototype.pauseAnimations
    const { container } = render(<AnimatedLoadingLogo />)
    act(() => onVisibility([{ isIntersecting: true }]))
    expect(timelineFor(container.querySelector('[data-outbound]')).paused()).toBe(false)
    expect(screen.getByRole('button', { name: 'Pause loading animation' })).toBeInTheDocument()
  })

  it('falls back to the compact brand mark if the illustrated image fails', () => {
    const { container } = render(<AnimatedLoadingLogo logoId="aperture" />)
    fireEvent.error(container.querySelector('svg image'))
    expect(container.querySelector('img')).toHaveAttribute('src', '/favicon.svg')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('plays the Relay Orbits handoff when visible and restores the mark on pause', () => {
    reduced = true
    const { container } = render(<AnimatedLoadingLogo />)
    const hull = container.querySelector('[data-hull]')
    const outbound = container.querySelector('[data-outbound]')
    const restingPath = hull.getAttribute('d')
    expect(timelineFor(outbound)).toBeUndefined()

    fireEvent.click(screen.getByRole('button', { name: 'Play loading animation' }))
    const timeline = timelineFor(outbound)
    expect(timeline.paused()).toBe(true)
    act(() => onVisibility([{ isIntersecting: true }]))
    expect(timeline.paused()).toBe(false)
    timeline.seek('release+=0.25')
    expect(hull.getAttribute('d')).not.toBe(restingPath)
    expect(Number(outbound.getAttribute('opacity'))).toBeGreaterThan(0)

    act(() => onVisibility([{ isIntersecting: false }]))
    expect(timeline.paused()).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Pause loading animation' }))
    expect(hull).toHaveAttribute('d', restingPath)
    expect(outbound).toHaveAttribute('opacity', '0')
  })

  it('moves Relay’s tethers with the nodes and restores the connected geometry on pause', () => {
    const { container } = render(<AnimatedLoadingLogo logoId="relay" />)
    const node = container.querySelector('[data-node="left"]')
    const wire = container.querySelector('[data-wire="left"]')
    const current = container.querySelector('[data-current="top"]')
    const restingTransform = node.getAttribute('transform')
    const restingWire = wire.getAttribute('d')
    const timeline = timelineFor(current)
    timeline.seek('exchange+=0.35', false)

    const transform = node.getAttribute('transform')
    expect(transform).not.toBe(restingTransform)
    expect(wire.getAttribute('d')).toMatch(`M${transform.match(/translate\(([^)]+)\)/)[1]}C`)
    expect(Number(current.getAttribute('opacity'))).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Pause loading animation' }))
    expect(node).toHaveAttribute('transform', restingTransform)
    expect(wire).toHaveAttribute('d', restingWire)
    expect(current).toHaveAttribute('opacity', '0')
  })

  it.each([
    ['trinity', '[data-field-veins]', '[data-wave-edge]', 'ignition+=0.6'],
    ['slipstream', '[data-ribbon-shell]', '[data-center-flare]', 'capture+=0.19'],
  ])('restores the authored %s mark when playback pauses', (logoId, shapeSelector, lightSelector, beat) => {
    const { container } = render(<AnimatedLoadingLogo logoId={logoId} />)
    const shape = container.querySelector(shapeSelector)
    const light = container.querySelector(lightSelector)
    const rest = shape.getAttribute('d')
    timelineFor(light).seek(beat, false)
    expect(shape.getAttribute('d')).not.toBe(rest)
    expect(Number(light.getAttribute('opacity'))).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Pause loading animation' }))
    expect(shape).toHaveAttribute('d', rest)
    expect(light).toHaveAttribute('opacity', '0')
  })

  it('routes light through Circuit E and its branches over the resting mark', () => {
    delete SVGSVGElement.prototype.pauseAnimations
    const { container } = render(<AnimatedLoadingLogo logoId="circuit-e" />)
    const base = container.querySelector('[data-circuit-base]')
    const restingMark = base.innerHTML
    const fluid = container.querySelector('[data-circuit-fluid]')
    const front = fluid.querySelector('[data-circuit-front]')
    const restingFront = front.getAttribute('d')
    const branch = container.querySelector('[data-circuit-branch] path')
    const restingDash = branch.getAttribute('stroke-dashoffset')
    const timeline = timelineFor(fluid)
    timeline.seek(0.61, false)

    expect(Number(fluid.getAttribute('opacity'))).toBeGreaterThan(0)
    expect(front.getAttribute('d')).not.toBe(restingFront)
    expect(branch.getAttribute('stroke-dashoffset')).not.toBe(restingDash)
    expect(base.innerHTML).toBe(restingMark)

    fireEvent.click(screen.getByRole('button', { name: 'Pause loading animation' }))
    expect(fluid).toHaveAttribute('opacity', '0')
    expect(front).toHaveAttribute('d', restingFront)
    expect(branch).toHaveAttribute('stroke-dashoffset', restingDash)
    expect(base.innerHTML).toBe(restingMark)
  })

  it('restores Circuit Crown’s wire mesh and crown when motion is paused', () => {
    reduced = true
    const { container } = render(<AnimatedLoadingLogo logoId="circuit-spire" />)
    const mesh = container.querySelector('[data-crown-mesh="left"]')
    const crown = container.querySelector('[data-crown-lift]')
    const wisp = container.querySelector('[data-crown-wisp]')
    const rest = mesh.getAttribute('d')
    const restingWisp = wisp.getAttribute('d')
    expect(timelineFor(crown)).toBeUndefined()

    fireEvent.click(screen.getByRole('button', { name: 'Play loading animation' }))
    timelineFor(crown).seek('transfer+=0.5', false)
    expect(mesh.getAttribute('d')).not.toBe(rest)
    expect(crown.getAttribute('transform')).not.toBe('translate(0 0)')
    expect(wisp.getAttribute('d')).not.toBe(restingWisp)

    fireEvent.click(screen.getByRole('button', { name: 'Pause loading animation' }))
    expect(mesh).toHaveAttribute('d', rest)
    expect(crown).toHaveAttribute('transform', 'translate(0 0)')
    expect(wisp).toHaveAttribute('d', restingWisp)
  })

  it('keeps the Node Hands filament attached to the moving thumb nodes', () => {
    const { container } = render(<AnimatedLoadingLogo logoId="catalyst-core" />)
    const svg = container.querySelector('svg')
    const hand = svg.querySelector('[data-node-hand="left"]')
    const filament = svg.querySelector('[data-node-filament]')
    const bridge = svg.querySelector('[data-node-bridge]')
    const restingPath = filament.getAttribute('d')
    const timeline = timelineFor(bridge)
    timeline.seek(1.15, false)

    const angle = Number(hand.getAttribute('transform').match(/rotate\(([^ ]+)/)[1]) * Math.PI / 180
    const [, x, y] = filament.getAttribute('d').match(/^M([\d.]+) ([\d.]+)/)
    expect(Number(x)).toBeCloseTo(242 + 76 * Math.cos(angle) + 400 * Math.sin(angle), 3)
    expect(Number(y)).toBeCloseTo(700 + 76 * Math.sin(angle) - 400 * Math.cos(angle), 3)
    expect(Number(bridge.getAttribute('opacity'))).toBeGreaterThan(0.8)

    fireEvent.click(screen.getByRole('button', { name: 'Pause loading animation' }))
    expect(hand).toHaveAttribute('transform', 'rotate(0 242 700)')
    expect(bridge).toHaveAttribute('opacity', '0')
    expect(filament).toHaveAttribute('d', restingPath)
  })

  it('moves Facet Hands independently and clears the reflected light on pause', () => {
    const { container } = render(<AnimatedLoadingLogo logoId="routed-signal" />)
    const svg = container.querySelector('svg')
    const left = svg.querySelector('[data-facet-hand="left"]')
    const right = svg.querySelector('[data-facet-hand="right"]')
    const finger = left.querySelector('[data-facet-finger]')
    const caustic = left.querySelector('[data-facet-caustic]')
    const handRest = left.getAttribute('transform')
    const fingerRest = finger.getAttribute('transform')
    const lightRest = caustic.getAttribute('transform')
    const timeline = timelineFor(caustic)
    timeline.seek('refraction')

    expect(left.getAttribute('transform')).not.toBe(handRest)
    expect(right.getAttribute('transform')).not.toBe(left.getAttribute('transform'))
    expect(finger.getAttribute('transform')).not.toBe(fingerRest)
    expect(caustic.getAttribute('transform')).not.toBe(lightRest)
    expect(Number(caustic.getAttribute('opacity'))).toBeGreaterThan(0.7)

    fireEvent.click(screen.getByRole('button', { name: 'Pause loading animation' }))
    expect(left).toHaveAttribute('transform', handRest)
    expect(finger).toHaveAttribute('transform', fingerRest)
    expect(caustic).toHaveAttribute('transform', lightRest)
    expect(caustic).toHaveAttribute('opacity', '0')
  })

  it('lights Rift’s bridge and restores the resting mark on pause', () => {
    const { container } = render(<AnimatedLoadingLogo logoId="flow-field" />)
    const svg = container.querySelector('svg')
    const bridge = svg.querySelector('[data-rift-crossing]')
    const mist = svg.querySelector('[data-rift-mist]')
    const stream = svg.querySelector('[data-rift-stream]')
    const bridgeAtRest = bridge.getAttribute('transform')
    const streamAtRest = stream.getAttribute('d')

    timelineFor(bridge).seek('crossing+=0.45')
    expect(bridge.getAttribute('transform')).not.toBe(bridgeAtRest)
    expect(stream.getAttribute('d')).not.toBe(streamAtRest)
    expect(Number(mist.getAttribute('opacity'))).toBeGreaterThan(0.7)

    fireEvent.click(screen.getByRole('button', { name: 'Pause loading animation' }))
    expect(bridge).toHaveAttribute('transform', bridgeAtRest)
    expect(stream).toHaveAttribute('d', streamAtRest)
    expect(mist).toHaveAttribute('opacity', '0')
  })

  it('projects Neural Core fibres into separate depth planes and clears them on pause', () => {
    const { container } = render(<AnimatedLoadingLogo logoId="neural-core" size={1024} />)
    const svg = container.querySelector('svg')
    const node = svg.querySelector('[data-neural-node]')
    const rear = svg.querySelector('[data-neural-rear] [data-neural-fibre]')
    const front = svg.querySelector('[data-neural-front] [data-neural-fibre]')
    const timeline = timelineFor(node)
    timeline.seek(1.15, false)
    expect(rear.querySelector('[data-neural-band]').getAttribute('d')).toMatch(/^M.+Z/)
    timeline.seek(1.99, false)
    expect(front.querySelector('[data-neural-band]').getAttribute('d')).toMatch(/^M.+Z/)

    fireEvent.click(screen.getByRole('button', { name: 'Pause loading animation' }))
    expect(rear).toHaveAttribute('opacity', '0')
    expect(front).toHaveAttribute('opacity', '0')
    expect(svg.querySelector('image')).toHaveAttribute('href', '/brand/neural-core-1024.webp')
  })

  it.each(['orbit', 'orbital-network', 'constellation', 'ignition', 'aperture', 'bloom', 'ribbon-catalyst', 'signal-cascade'])('keeps the resting %s artwork with reduced motion or without WebGL', (logoId) => {
    reduced = true
    const createContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    vi.stubGlobal('Image', class {
      naturalWidth = 1024
      naturalHeight = 1024
      set src(_) { this.onload() }
    })
    const { container } = render(<AnimatedLoadingLogo logoId={logoId} size={1024} />)
    const artwork = container.querySelector('svg image')
    expect(artwork).toHaveAttribute('href', `/brand/${logoId}-1024.webp`)
    expect(createContext).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Play loading animation' }))
    act(() => onVisibility([{ isIntersecting: true }]))
    expect(createContext).toHaveBeenCalledWith('webgl', expect.any(Object))
    expect(container.querySelector('svg image')).toBe(artwork)
    expect(container.querySelector('canvas')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
