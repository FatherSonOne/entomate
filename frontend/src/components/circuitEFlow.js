import { gsap } from 'gsap/gsap-core.js'

export function createCircuitEFlowTimeline(svg) {
  const timeline = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.25 })

  function charge(node, at, intensity) {
    timeline
      .to(node, { attr: { opacity: intensity }, duration: 0.14, ease: 'sine.out' }, at)
      .to(node, { attr: { opacity: 0 }, duration: 0.62, ease: 'power2.out' }, at + 0.14)
  }

  function send(trace, at, duration) {
    timeline
      .to(trace.children, { attr: { 'stroke-dashoffset': -1 }, duration, ease: 'sine.inOut' }, at)
      .to(trace, { attr: { opacity: 1 }, duration: 0.09, ease: 'sine.out' }, at)
      .to(trace, { attr: { opacity: 0 }, duration: 0.17, ease: 'sine.in' }, at + duration - 0.17)
  }

  svg.querySelectorAll('[data-circuit-lane]').forEach((lane, i) => {
    const at = 0.02 + i * 0.43
    const fluid = lane.querySelector('[data-circuit-fluid]')
    const front = fluid.querySelector('[data-circuit-front]')
    const rim = fluid.querySelector('[data-circuit-rim]')
    const stream = fluid.querySelector('[data-circuit-stream]')
    const restingFront = front.getAttribute('d')
    const restingRim = rim.getAttribute('d')
    const curl = 'C21 -18 -20 -8 2 3S27 21 -12 30'
    const swell = 'C-6 -20 26 -14 13 -1S-22 17 5 30'
    const end = Number(lane.dataset.barEnd)
    const branch = lane.querySelector('[data-circuit-branch]')
    charge(lane.querySelector('[data-circuit-source]'), at, 0.9)
    send(lane.querySelector('[data-circuit-feed]'), at + 0.04, 0.41)
    if (branch) {
      send(branch, at + 0.12, 0.77)
      charge(lane.querySelector('[data-circuit-terminal]'), at + 0.75, 0.96)
    }

    const inlet = at + 0.29
    timeline
      .to(fluid, { attr: { opacity: 0.96 }, duration: 0.18, ease: 'sine.out' }, inlet)
      .to(fluid, { attr: { transform: `translate(${end + 112} 0)` }, duration: 1.56, ease: 'sine.inOut' }, inlet)
      .to(front, { attr: { d: `M-112 -30H-14${swell}H-112Z` }, duration: 0.39, ease: 'sine.inOut' }, inlet)
      .to(rim, { attr: { d: `M-14 -30${swell}` }, duration: 0.39, ease: 'sine.inOut' }, inlet)
      .to(front, { attr: { d: `M-112 -30H-14${curl}H-112Z` }, duration: 0.52, ease: 'sine.inOut' }, inlet + 0.39)
      .to(rim, { attr: { d: `M-14 -30${curl}` }, duration: 0.52, ease: 'sine.inOut' }, inlet + 0.39)
      .to(stream, { attr: { d: 'M-91 12C-59 17 -42 -1 -9 10M-76 -10C-54 -3 -36 -18 -17 -11M-49 1C-30 9 -17 6 -8 -3' }, duration: 0.83, ease: 'sine.inOut' }, inlet + 0.13)
      .to(front, { attr: { d: restingFront }, duration: 0.6, ease: 'sine.inOut' }, inlet + 0.91)
      .to(rim, { attr: { d: restingRim }, duration: 0.6, ease: 'sine.inOut' }, inlet + 0.91)
      .to(fluid, { attr: { opacity: 0 }, duration: 0.34, ease: 'sine.in' }, inlet + 1.22)
  })

  return timeline
}
