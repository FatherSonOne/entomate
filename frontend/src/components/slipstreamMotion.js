import { gsap } from 'gsap/gsap-core.js'

// The center stays anchored while the outer turns flex with the current.
function loadedCurve(path, centerX, centerY) {
  return path.replace(/(\d+) (\d+)/g, (_, x, y) => {
    const px = Number(x)
    const py = Number(y)
    const distance = Math.min(1, Math.hypot(px - centerX, py - centerY) / 215)
    const freedom = distance * distance * (3 - 2 * distance)
    const horizontal = (px - 430) / 360
    const vertical = (py - 680) / 260
    const weight = Math.exp(-horizontal * horizontal - vertical * vertical) * freedom
    return `${Math.round(px - 12 * weight)} ${Math.round(py + 28 * weight)}`
  })
}

export function createSlipstreamTimeline(svg) {
  const ribbon = svg.querySelectorAll('[data-ribbon-shell], [data-ribbon-face], [data-ribbon-ridge], [data-ribbon-seam], [data-ribbon-tip], [data-ribbon-flow], [data-ribbon-grain]')
  const flow = svg.querySelector('[data-ribbon-flow]')
  const grain = svg.querySelector('[data-ribbon-grain]')
  const flare = svg.querySelector('[data-center-flare]')
  const centerX = Number(flare.getAttribute('cx'))
  const centerY = Number(flare.getAttribute('cy'))
  const timeline = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.3 })
  timeline.addLabel('capture', 1.74)

  for (const path of ribbon) {
    const rest = path.getAttribute('d')
    timeline
      .to(path, { attr: { d: loadedCurve(rest, centerX, centerY) }, duration: 1.22, ease: 'sine.inOut' }, 0.28)
      .to(path, { attr: { d: rest }, duration: 1.6, ease: 'sine.inOut' }, 1.5)
  }

  timeline
    .to(flow, { attr: { opacity: 0.99 }, duration: 0.3, ease: 'sine.out' }, 0)
    .to(flow, { attr: { 'stroke-dashoffset': -1 }, duration: 1.87, ease: 'sine.inOut' }, 0)
    .to(flow, { attr: { opacity: 0 }, duration: 0.24, ease: 'sine.in' }, 1.78)
    .to(grain, { attr: { opacity: 0.85 }, duration: 0.42, ease: 'sine.in' }, 0.24)
    .to(grain, { attr: { 'stroke-dashoffset': -0.92 }, duration: 2.38, ease: 'sine.inOut' }, 0.24)
    .to(grain, { attr: { opacity: 0 }, duration: 0.73, ease: 'sine.out' }, 1.86)
    .to(flare, { attr: { opacity: 0.83 }, duration: 0.23, ease: 'sine.out' }, 'capture')
    .to(flare, { attr: { opacity: 0, r: 74 }, duration: 0.78, ease: 'sine.out' }, 1.97)

  return timeline
}
