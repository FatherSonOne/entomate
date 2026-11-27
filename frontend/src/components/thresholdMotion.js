import { gsap } from 'gsap/gsap-core.js'

const PRESSURE_FRONT = 'M534 210C456 323 586 421 562 500C533 585 471 674 548 790'
const FIELD_UNDER_LOAD = 'M526 498C586 470 656 352 731 303M526 500C607 500 686 414 791 422M526 504C630 468 729 565 802 524M526 506C630 523 721 630 748 664M526 512C611 572 628 680 682 739'

export function createThresholdTimeline(svg) {
  const veins = svg.querySelector('[data-field-veins]')
  const face = veins.getAttribute('d')
  const wave = [...svg.querySelectorAll('[data-wave-halo], [data-wave-edge]')]
  const seam = svg.querySelector('[data-seam-flow]')
  const core = svg.querySelector('[data-core-flare]')
  const gate = svg.querySelector('[data-gate-flare]')
  const timeline = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.29 })
  timeline.addLabel('ignition', 0.97)

  // The three arrivals converge on the seam before the membrane responds.
  for (const [index, input] of [...svg.querySelectorAll('[data-input]')].entries()) {
    const start = index * 0.11
    timeline
      .to(input, { attr: { opacity: 0.94 }, duration: 0.19, ease: 'sine.out' }, start)
      .to(input, { attr: { 'stroke-dashoffset': -1 }, duration: 0.8, ease: 'sine.in' }, start)
      .to(input, { attr: { opacity: 0 }, duration: 0.18, ease: 'sine.in' }, start + 0.63)
  }

  timeline
    .to(seam, { attr: { opacity: 0.94, 'stroke-dashoffset': -1 }, duration: 1.08, ease: 'power1.inOut' }, 'ignition-=0.12')
    .to(seam, { attr: { opacity: 0 }, duration: 0.4 }, 1.78)
    .to(core, { attr: { opacity: 0.86 }, duration: 0.23, ease: 'sine.out' }, 'ignition')
    .to(core, { attr: { opacity: 0, r: 111 }, duration: 1.03, ease: 'sine.out' }, 1.2)
    .to(gate, { attr: { opacity: 0.74 }, duration: 0.28 }, 'ignition')
    .to(gate, { attr: { cx: 753, rx: 140, ry: 139, opacity: 0 }, duration: 1.63, ease: 'sine.inOut' }, 1.25)
    .to(veins, { attr: { d: FIELD_UNDER_LOAD, 'stroke-opacity': 1 }, duration: 1.02, ease: 'sine.inOut' }, 'ignition')
    .to(veins, { attr: { d: face, 'stroke-opacity': 0.73 }, duration: 1.39, ease: 'sine.inOut' }, 1.99)
    .to(wave, { attr: { d: PRESSURE_FRONT, transform: 'translate(306 0)' }, duration: 1.83, ease: 'power1.inOut' }, 'ignition')
    .to(wave[0], { attr: { opacity: 0.29 }, duration: 0.38 }, 'ignition')
    .to(wave[1], { attr: { opacity: 0.82 }, duration: 0.37 }, 'ignition')
    .to(wave, { attr: { opacity: 0 }, duration: 0.62, ease: 'sine.in' }, 2.09)

  return timeline
}
