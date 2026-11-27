import { gsap } from 'gsap/gsap-core.js'

const FINGER_FAN = [-6.4, -3.2, 2.4, 6.1]
const VAPOR_CURL = [
  'M69 307C12 281 47 245 51 205S79 143 140 124S212 123 232 75',
  'M71 306C16 280 49 244 54 205S81 145 142 126S215 122 234 77',
  'M75 303C27 283 54 247 58 210S88 154 147 134S215 127 237 84',
]
const VAPOR_RELEASE = [
  'M49 259C3 242 31 216 49 184S101 158 131 118S169 73 225 49',
  'M51 258C7 238 35 215 53 183S103 159 134 119S173 75 227 50',
  'M54 257C15 240 40 219 58 187S112 159 140 124S175 77 227 58',
]

export function createFacetHandsTimeline(svg) {
  const timeline = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.24 })
  timeline.addLabel('refraction', 0.72)
  svg.querySelectorAll('[data-facet-hand]').forEach((hand, side) => {
    const start = 0.03 + side * 0.14
    const caustic = hand.querySelector('[data-facet-caustic]')
    const base = hand.getAttribute('transform')
    const lean = side === 0 ? -6.2 : -5.1

    timeline
      .to(hand, { attr: { transform: `rotate(${lean} 214 550)` }, duration: 1.24, ease: 'sine.inOut' }, start)
      .to(hand, { attr: { transform: 'rotate(-2.2 214 550)' }, duration: 0.94, ease: 'sine.inOut' }, start + 1.35)
      .to(hand, { attr: { transform: base }, duration: 1.05, ease: 'sine.inOut' }, start + 2.29)
      .to(caustic, { attr: { opacity: 1 }, duration: 0.29, ease: 'sine.out' }, start)
      .to(caustic, { attr: { transform: 'translate(16 -26)' }, duration: 1.49, ease: 'sine.inOut' }, start)
      .to(caustic, { attr: { opacity: 0 }, duration: 0.44, ease: 'sine.in' }, start + 1.22)

    hand.querySelectorAll('[data-facet-finger]').forEach((finger, i) => {
      const rest = finger.getAttribute('transform')
      const opening = start + 0.16 + i * 0.083
      timeline
        .to(finger, { attr: { transform: rest.replace('rotate(0 ', `rotate(${FINGER_FAN[i]} `) }, duration: 1.01, ease: 'sine.inOut' }, opening)
        .to(finger, { attr: { transform: rest }, duration: 1.36, ease: 'sine.inOut' }, opening + 1.38)
    })
  })

  svg.querySelectorAll('[data-facet-vapor]').forEach((wake, side) => {
    const at = 0.91 + side * 0.19
    const strokes = wake.querySelectorAll('[data-facet-vapor-path]')
    timeline
      .to(wake, { attr: { opacity: 0.98 }, duration: 0.51, ease: 'sine.inOut' }, at)
      .to(strokes, { attr: { d: (i) => VAPOR_CURL[i] }, duration: 0.94, ease: 'sine.inOut', stagger: 0.032 }, at)
      .to(strokes, { attr: { d: (i) => VAPOR_RELEASE[i] }, duration: 0.94, ease: 'sine.inOut', stagger: 0.048 }, at + 0.96)
      .to(wake, { attr: { opacity: 0 }, duration: 1.21, ease: 'sine.inOut' }, at + 0.99)
  })

  const glint = svg.querySelector('[data-facet-bar-sweep]')
  timeline.to(glint, { attr: { x1: 438, x2: 550 }, duration: 1.04, ease: 'sine.inOut' }, 1.51)
  svg.querySelectorAll('[data-facet-reflection]').forEach((bar, i) => {
    const at = 1.61 + i * 0.065
    timeline
      .to(bar, { attr: { opacity: 0.78 }, duration: 0.38, ease: 'sine.out' }, at)
      .to(bar, { attr: { opacity: 0 }, duration: 0.5, ease: 'sine.inOut' }, at + 0.42)
  })

  svg.querySelectorAll('[data-facet-dust] circle').forEach((dot, i) => {
    const x = Number(dot.getAttribute('cx'))
    const y = Number(dot.getAttribute('cy'))
    const start = 0.98 + (i * 13 % 17) * 0.038 + (x > 352 ? 0.17 : 0)
    const drift = 1.05 + (i % 5) * 0.12
    const spread = x < 352 ? -1 : 1
    timeline
      .to(dot, { attr: { cx: x + spread * (17 + i * 15 % 57) }, duration: drift, ease: 'sine.out' }, start)
      .to(dot, { attr: { cy: y - 47 - i * 13 % 79 }, duration: drift, ease: 'sine.inOut' }, start)
      .to(dot, { attr: { opacity: 0.42 + (i % 4) * 0.12 }, duration: 0.22, ease: 'sine.out' }, start)
      .to(dot, { attr: { opacity: 0 }, duration: drift * 0.49, ease: 'sine.in' }, start + drift * 0.51)
  })
  return timeline
}
