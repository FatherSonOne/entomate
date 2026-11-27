import { gsap } from 'gsap/gsap-core.js'

const WRIST_X = 242
const WRIST_Y = 700
const THUMB_X = 318
const THUMB_Y = 300

// The opposite hand is a mirror of this thumb. Every pose keeps both ends
// of the filament attached as the wrists lean in and pull apart.
function filament(lean, bend, drift) {
  const angle = lean * Math.PI / 180
  const dx = THUMB_X - WRIST_X
  const dy = THUMB_Y - WRIST_Y
  const x = WRIST_X + dx * Math.cos(angle) - dy * Math.sin(angle)
  const y = WRIST_Y + dx * Math.sin(angle) + dy * Math.cos(angle)
  const length = 800 - 2 * x
  return `M${x} ${y}C${x + length * 0.20} ${y + bend} ${x + length * 0.34} ${y + bend + drift} 400 ${y + bend * 0.66}S${800 - x - length * 0.22} ${y + bend * 0.75 - drift} ${800 - x} ${y}`
}

const SPENT_VAPOR = [
  'M371 290C347 313 386 343 394 352S426 383 414 411S388 450 421 493',
  'M373 294C350 313 386 343 396 353S428 383 416 414S392 449 422 495',
  'M439 288C460 308 415 338 408 351S393 373 399 401S428 449 402 485',
]

export function createNodeHandsTimeline(svg) {
  const timeline = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.22 })
  const hands = svg.querySelectorAll('[data-node-hand]')
  const strands = svg.querySelectorAll('[data-node-filament]')
  const echo = svg.querySelector('[data-node-echo]')
  const duration = 3.62
  timeline.addLabel('handoff', 1.05)

  function pose(lean, bend, drift, at, span) {
    const optics = { duration: span, ease: 'sine.inOut' }
    timeline
      .to(hands, { attr: { transform: `rotate(${lean} ${WRIST_X} ${WRIST_Y})` }, ...optics }, at)
      .to(strands, { attr: { d: filament(lean, bend, drift) }, ...optics }, at)
      .to(echo, { attr: { d: filament(lean, bend * 0.54, 8 - drift * 0.73) }, ...optics }, at)
  }

  function light(tip, at, strength) {
    timeline
      .to(tip, { attr: { opacity: strength }, duration: 0.15, ease: 'sine.out' }, at)
      .to(tip, { attr: { opacity: 0 }, duration: 0.59, ease: 'power2.out' }, at + 0.15)
  }

  function transfer(path, at, reverse) {
    const offset = reverse ? 0.34 : -1
    if (reverse) timeline.set(path, { attr: { 'stroke-dashoffset': -1 } }, at)
    timeline
      .to(path, { attr: { 'stroke-dashoffset': offset }, duration: 0.42, ease: 'sine.inOut' }, at)
      .to(path, { attr: { opacity: 0.94 }, duration: 0.1, ease: 'sine.out' }, at)
      .to(path, { attr: { opacity: 0 }, duration: 0.18, ease: 'sine.in' }, at + 0.24)
  }

  const [left, right] = Array.from(hands, (hand) => ({
    tips: [...hand.querySelectorAll('[data-node-tip]')],
    feeds: [...hand.querySelectorAll('[data-node-feed]')],
  }))
  left.tips.forEach((tip, i) => light(tip, 0.04 + 0.285 * i, i === 3 ? 0.95 : 0.69))
  left.feeds.forEach((feed, i) => transfer(feed, 0.1 + 0.285 * i, false))
  right.tips.reverse().forEach((tip, i) => light(tip, 1.61 + 0.255 * i, i === 0 ? 0.99 : 0.72))
  right.feeds.reverse().forEach((feed, i) => transfer(feed, 1.68 + 0.255 * i, true))

  pose(3.4, -49, 12, 0.24, 0.91)
  pose(3.7, -63, -21, 1.15, 0.51)
  pose(-0.7, -23, 18, 1.66, 0.91)
  pose(0, -17, 5, 2.57, duration - 2.57)

  const bridge = svg.querySelector('[data-node-bridge]')
  const glow = svg.querySelector('[data-node-transfer-light]')
  timeline
    .to(bridge, { attr: { opacity: 0.97 }, duration: 0.33, ease: 'sine.out' }, 0.91)
    .to(glow, { attr: { x1: 431, x2: 578 }, duration: 0.78, ease: 'sine.inOut' }, 'handoff')
    .to(bridge, { attr: { opacity: 0 }, duration: 0.69, ease: 'sine.inOut' }, 1.78)

  const reflection = svg.querySelector('[data-node-reflection]')
  const barLight = svg.querySelector('[data-node-bar-light]')
  const mist = svg.querySelector('[data-node-vapors]')
  timeline
    .to(reflection, { attr: { opacity: 0.83 }, duration: 0.31, ease: 'sine.out' }, 1.34)
    .to(barLight, { attr: { y1: 456, y2: 561 }, duration: 1.09, ease: 'sine.inOut' }, 1.34)
    .to(reflection, { attr: { opacity: 0 }, duration: 0.46, ease: 'sine.inOut' }, 2.11)
    .to(mist, { attr: { opacity: 0.8 }, duration: 0.49, ease: 'sine.inOut' }, 1.27)
    .to(mist.children, { attr: { d: (i) => SPENT_VAPOR[i] }, duration: 1.66, stagger: 0.042, ease: 'sine.inOut' }, 1.34)
    .to(mist, { attr: { opacity: 0 }, duration: 1.12, ease: 'sine.inOut' }, 1.92)

  svg.querySelectorAll('[data-node-dust] circle').forEach((dot, i) => {
    const x = Number(dot.getAttribute('cx'))
    const y = Number(dot.getAttribute('cy'))
    const start = 1.18 + i * 0.031
    const drift = 0.95 + (i % 5) * 0.11
    timeline
      .to(dot, { attr: { cx: 400 + (x - 400) * 1.38 + 13 * Math.sin(i * 0.91), cy: y + 81 + (i * 19) % 91 }, duration: drift, ease: 'sine.inOut' }, start)
      .to(dot, { attr: { opacity: 0.38 + (i % 4) * 0.15 }, duration: 0.23, ease: 'sine.out' }, start)
      .to(dot, { attr: { opacity: 0 }, duration: 0.56, ease: 'sine.in' }, start + drift * 0.51)
  })
  return timeline
}
