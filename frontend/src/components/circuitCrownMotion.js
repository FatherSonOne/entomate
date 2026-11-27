import { gsap } from 'gsap/gsap-core.js'

const LIFTED_WISPS = [
  'M399 194C418 187 440 176 433 156C426 136 390 138 398 119C408 97 460 116 469 64',
  'M402 191C420 184 446 173 437 153C428 133 396 137 401 117C413 98 462 115 471 67',
  'M404 188C424 182 444 174 440 158C434 138 400 141 405 122C417 101 461 116 471 73',
]

const RELEASED_WISPS = [
  'M412 179C444 166 463 149 452 132C438 115 421 127 426 103C431 81 480 98 483 37',
  'M415 177C446 163 466 151 455 131C441 112 425 125 429 101C435 78 483 97 485 41',
  'M418 174C448 162 469 153 460 133C449 115 430 125 435 103C442 83 487 93 487 47',
]

export function createCircuitCrownTimeline(svg) {
  const timeline = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.24 })
  timeline.addLabel('transfer', 0.96)

  svg.querySelectorAll('[data-crown-hand]').forEach((hand, i) => {
    const side = hand.dataset.crownHand
    const mesh = svg.querySelector(`[data-crown-mesh="${side}"]`)
    const heat = svg.querySelector(`[data-crown-heat="${side}"]`)
    const current = hand.querySelector('[data-crown-current]')
    const rest = mesh.getAttribute('d')
    const start = 0.04 + i * 0.12

    timeline
      .to(current, { attr: { opacity: 1 }, duration: 0.26, ease: 'sine.out' }, start)
      .to(heat, { attr: { y1: -49, y2: 201 }, duration: 1.19, ease: 'sine.inOut' }, start)
      .to(current, { attr: { opacity: 0 }, duration: 0.72, ease: 'sine.inOut' }, start + 1.02)
      .to(mesh, { attr: { d: mesh.dataset.reach }, duration: 0.78, ease: 'sine.inOut' }, start + 0.13)
      .to(hand, { attr: { transform: 'rotate(3.3 140 625)' }, duration: 0.86, ease: 'sine.inOut' }, start + 0.15)
      .to(mesh, { attr: { d: mesh.dataset.release }, duration: 0.8, ease: 'sine.inOut' }, start + 1.23)
      .to(hand, { attr: { transform: 'rotate(-1.1 140 625)' }, duration: 0.9, ease: 'sine.inOut' }, start + 1.18)
      .to(mesh, { attr: { d: rest }, duration: 1.18, ease: 'sine.inOut' }, start + 2.03)
      .to(hand, { attr: { transform: 'rotate(0 140 625)' }, duration: 1.04, ease: 'sine.inOut' }, start + 2.08)
  })

  const crown = svg.querySelector('[data-crown-lift]')
  const aura = crown.querySelector('[data-crown-aura]')
  const spokes = crown.querySelector('[data-crown-spokes]')
  timeline
    .to(crown, { attr: { transform: 'translate(0 -28)' }, duration: 0.91, ease: 'sine.inOut' }, 'transfer')
    .to(aura, { attr: { opacity: 0.98, r: 73 }, duration: 0.74, ease: 'sine.out' }, 'transfer+=0.09')
    .to(spokes, { attr: { opacity: 0.96 }, duration: 0.2, ease: 'sine.out' }, 'transfer+=0.13')
    .to(spokes.children, { attr: { 'stroke-dashoffset': -1 }, duration: 0.66, stagger: 0.064, ease: 'sine.inOut' }, 'transfer+=0.14')
    .to(spokes, { attr: { opacity: 0 }, duration: 0.29, ease: 'sine.in' }, 'transfer+=0.83')
    .to(aura, { attr: { opacity: 0, r: 89 }, duration: 1.16, ease: 'sine.inOut' }, 'transfer+=0.91')
    .to(crown, { attr: { transform: 'translate(0 0)' }, duration: 1.29, ease: 'sine.inOut' }, 2.13)

  crown.querySelectorAll('[data-crown-node]').forEach((node, i) => {
    const charge = 1.45 + [0.27, 0.12, 0.19, 0, 0.06][i]
    timeline
      .to(node, { attr: { opacity: 0.98 }, duration: 0.2, ease: 'sine.out' }, charge)
      .to(node, { attr: { opacity: 0 }, duration: 0.78, ease: 'sine.inOut' }, charge + 0.2)
  })

  const vapor = svg.querySelector('[data-crown-vapor]')
  const wisps = vapor.querySelectorAll('[data-crown-wisp]')
  timeline
    .to(vapor, { attr: { opacity: 0.91 }, duration: 0.58, ease: 'sine.inOut' }, 0.73)
    .to(wisps, { attr: { d: (i) => LIFTED_WISPS[i % 3] }, duration: 0.92, stagger: 0.037, ease: 'sine.inOut' }, 0.78)
    .to(wisps, { attr: { d: (i) => RELEASED_WISPS[i % 3] }, duration: 0.98, stagger: 0.037, ease: 'sine.inOut' }, 1.89)
    .to(vapor, { attr: { opacity: 0 }, duration: 0.98, ease: 'sine.inOut' }, 1.83)

  svg.querySelectorAll('[data-crown-dust]').forEach((dot, i) => {
    const x = Number(dot.getAttribute('cx'))
    const y = Number(dot.getAttribute('cy'))
    const drift = 1.18 + ((i * 7) % 15) / 50
    const start = 0.73 + ((i * 19) % 23) / 40
    timeline
      .to(dot, { attr: { cy: y - 121 - (i * 13) % 74 }, duration: drift, ease: 'sine.in' }, start)
      .to(dot, { attr: { cx: 500 + (x - 500) * 0.59 + ((i * 9) % 41) - 20 }, duration: drift, ease: 'sine.inOut' }, start)
      .to(dot, { attr: { opacity: 0.36 + (i % 4) * 0.13 }, duration: drift * 0.32, ease: 'sine.out' }, start)
      .to(dot, { attr: { opacity: 0 }, duration: drift * 0.52, ease: 'sine.in' }, start + drift * 0.48)
  })
  return timeline
}
