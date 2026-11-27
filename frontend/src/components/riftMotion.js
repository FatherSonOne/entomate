import { gsap } from 'gsap/gsap-core.js'

function bendStream(path, side, pressure) {
  return path.replace(/(\d+) (\d+)/g, (_, px, py) => {
    const x = Number(px)
    const y = Number(py)
    const reach = Math.sin((y - 125) / 530 * Math.PI)
    const curve = Math.sin((y - 142) / 76 + pressure * 0.63)
    return `${Math.round(x + side * reach * (12 + 11 * curve) * pressure)} ${Math.round(y + reach * curve * 12 * pressure)}`
  })
}

const RISING_MIST = [
  'M419 491C442 461 383 439 393 408S426 365 399 335S364 296 385 258',
  'M418 492C440 461 381 440 391 408S424 364 398 335S365 296 384 258',
  'M422 489C449 464 389 439 400 410S436 367 406 340S371 301 392 265',
]
const SPENT_MIST = [
  'M429 458C457 446 389 420 405 384S385 337 383 314S426 287 404 247',
  'M426 458C452 446 387 419 402 384S381 337 382 313S424 286 402 248',
  'M437 453C460 440 393 416 411 383S392 340 390 316S430 285 410 247',
]

export function createRiftTimeline(svg) {
  const timeline = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.26 })
  timeline.addLabel('crossing', 1.10)

  svg.querySelectorAll('[data-rift-surge]').forEach((surge, i) => {
    const side = i === 0 ? 1 : -1
    const at = 0.045 + i * 0.23
    const name = surge.dataset.riftSurge
    const bank = svg.querySelector(`[data-rift-bank="${name}"]`)
    const streams = [...surge.querySelectorAll('[data-rift-stream]')]
    const paths = streams.map((path) => path.getAttribute('d'))
    timeline
      .to(surge, { attr: { opacity: 0.98 }, duration: 0.26, ease: 'sine.out' }, at)
      .to(streams, { attr: { 'stroke-dashoffset': -1 }, duration: 2.18, stagger: 0.037, ease: 'sine.inOut' }, at)
      .to(streams, { attr: { d: (index) => bendStream(paths[index], side, 1) }, duration: 0.95, ease: 'sine.inOut' }, at)
      .to(bank, { attr: { transform: `translate(${side * 9} ${side * -5})` }, duration: 0.95, ease: 'sine.inOut' }, at)
      .to(streams, { attr: { d: (index) => bendStream(paths[index], side, -0.54) }, duration: 0.89, ease: 'sine.inOut' }, at + 0.95)
      .to(bank, { attr: { transform: 'translate(0 0)' }, duration: 1.34, ease: 'sine.inOut' }, at + 0.95)
      .to(surge, { attr: { opacity: 0 }, duration: 0.51, ease: 'sine.inOut' }, at + 1.74)
  })

  const glow = svg.querySelector('[data-rift-crossing]')
  const mist = svg.querySelector('[data-rift-mist]')
  const plumes = mist.querySelectorAll('[data-rift-plume]')
  timeline
    .to(glow, { attr: { opacity: 0.98 }, duration: 0.24, ease: 'sine.out' }, 'crossing')
    .to(glow, { attr: { transform: 'translate(489 408)' }, duration: 1.03, ease: 'sine.inOut' }, 'crossing')
    .to(glow, { attr: { opacity: 0 }, duration: 0.44, ease: 'sine.in' }, 'crossing+=0.76')
    .to(mist, { attr: { opacity: 0.88 }, duration: 0.63, ease: 'sine.inOut' }, 'crossing-=0.18')
    .to(plumes, { attr: { d: (i) => RISING_MIST[i] }, duration: 0.95, stagger: 0.045, ease: 'sine.inOut' }, 'crossing-=0.14')
    .to(plumes, { attr: { d: (i) => SPENT_MIST[i] }, duration: 1.13, stagger: 0.048, ease: 'sine.inOut' }, 'crossing+=0.84')
    .to(mist, { attr: { opacity: 0 }, duration: 1.24, ease: 'sine.inOut' }, 'crossing+=1.16')

  svg.querySelectorAll('[data-rift-dust] circle').forEach((grain, i) => {
    const x = Number(grain.getAttribute('cx'))
    const y = Number(grain.getAttribute('cy'))
    const at = 1.17 + i * 0.065
    const lift = 1.02 + (i % 4) * 0.13
    timeline
      .to(grain, { attr: { cx: x + Math.sin(i * 0.86) * 27 }, duration: lift, ease: 'sine.inOut' }, at)
      .to(grain, { attr: { cy: y - 65 - i * 19 % 74 }, duration: lift, ease: 'sine.in' }, at)
      .to(grain, { attr: { opacity: 0.44 + (i % 4) * 0.13 }, duration: 0.22, ease: 'sine.out' }, at)
      .to(grain, { attr: { opacity: 0 }, duration: lift * 0.51, ease: 'sine.in' }, at + lift * 0.49)
  })

  svg.querySelectorAll('[data-rift-grains] circle').forEach((grain, i) => {
    const x = Number(grain.getAttribute('cx'))
    const y = Number(grain.getAttribute('cy'))
    const side = x < 400 ? -1 : 1
    const at = 0.38 + (i % 6) * 0.13 + (side > 0 ? 0.39 : 0)
    const drift = 0.86 + (i % 4) * 0.14
    timeline
      .to(grain, { attr: { cx: x + side * (17 + i * 7 % 26) }, duration: drift, ease: 'sine.out' }, at)
      .to(grain, { attr: { cy: y + side * (22 + i * 17 % 37) }, duration: drift, ease: 'sine.inOut' }, at)
      .to(grain, { attr: { opacity: 0.48 + (i % 3) * 0.12 }, duration: 0.2, ease: 'sine.out' }, at)
      .to(grain, { attr: { opacity: 0 }, duration: drift * 0.62, ease: 'sine.in' }, at + drift * 0.38)
  })
  return timeline
}
