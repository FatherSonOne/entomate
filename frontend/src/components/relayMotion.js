import { gsap } from 'gsap/gsap-core.js'

// The front and back of the ribbon share endpoints as it changes pitch.
const RIBBON_BACK = 'M184 733C120 690 215 515 386 377C559 237 748 178 811 227'
const RIBBON_FRONT = 'M811 227C874 276 790 454 623 595C457 736 244 774 184 733'

const round = (value) => Number(value.toFixed(3))

export function createRelayTimeline(svg) {
  const housing = svg.querySelector('[data-housing]')
  const guides = [...svg.querySelectorAll('[data-guide]')]
  const nodes = [...svg.querySelectorAll('[data-node]')].map((node) => {
    const side = node.dataset.node
    return {
      node,
      direction: side === 'left' ? 1 : -1,
      wires: [svg.querySelector(`[data-wire="${side}"]`), svg.querySelector(`[data-wire-shadow="${side}"]`)],
    }
  })
  const pose = { grip: 0, sweep: 0 }

  // Move the two ends of each tether with the node and its port. Independent
  // grip and sweep curves give the nodes different approach and return arcs.
  function paint() {
    const { grip, sweep } = pose
    const width = 1 - 0.245 * grip
    const height = 1 + 0.13 * grip
    housing.setAttribute('transform', `translate(500 500) scale(${round(width)} ${round(height)}) translate(-500 -500)`)
    guides.forEach((guide) => guide.setAttribute('transform', `rotate(${round(-12 * sweep)} 500 500)`))
    for (const { node, direction, wires } of nodes) {
      const lift = 65 * sweep * direction
      const x = 500 + direction * (-372 + 104 * grip)
      const y = 500 - lift
      const port = 500 - 268 * width * direction
      node.setAttribute('transform', `translate(${round(x)} ${round(y)}) scale(${round(1 + 0.055 * grip)} ${round(1 - 0.075 * grip)})`)
      const bend = `M${round(x)} ${round(y)}C${round(x + direction * (40 - 13 * grip))} ${round(y - 0.62 * lift)} ${round(port - direction * (33 - 9 * grip))} ${round(500 + 0.45 * lift)} ${round(port)} 500`
      wires.forEach((wire) => wire.setAttribute('d', bend))
    }
  }

  const timeline = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.28, onUpdate: paint })
  timeline
    .addLabel('gather', 0.35)
    .addLabel('exchange', 0.91)
    .addLabel('release', 1.83)
    .to(pose, { grip: -0.12, duration: 0.35, ease: 'sine.inOut' }, 0)
    .to(pose, { grip: 1, duration: 0.95, ease: 'power2.inOut' }, 'gather')
    .to(pose, { grip: 0.88, duration: 0.53, ease: 'sine.inOut' }, 1.3)
    .to(pose, { grip: -0.23, duration: 0.65, ease: 'power2.out' }, 'release')
    .to(pose, { grip: 0.035, duration: 0.42, ease: 'sine.inOut' }, 2.48)
    .to(pose, { grip: 0, duration: 0.5, ease: 'sine.out' }, 2.9)
    .to(pose, { sweep: 0.98, duration: 1.01, ease: 'sine.inOut' }, 0.15)
    .to(pose, { sweep: 0.38, duration: 0.67, ease: 'sine.inOut' }, 1.16)
    .to(pose, { sweep: -0.71, duration: 0.7, ease: 'sine.inOut' }, 'release')
    .to(pose, { sweep: 0, duration: 0.87, ease: 'sine.inOut' }, 2.53)

  for (const [selector, lifted] of [
    ['[data-sash-back]', RIBBON_BACK],
    ['[data-sash-front]', RIBBON_FRONT],
    ['[data-sash-trim]', RIBBON_FRONT],
  ]) {
    const sash = svg.querySelector(selector)
    timeline
      .to(sash, { attr: { d: lifted }, duration: 1.2, ease: 'sine.inOut' }, 0.27)
      .to(sash, { attr: { d: sash.getAttribute('d') }, duration: 1.57, ease: 'sine.inOut' }, 1.47)
  }

  for (const [index, current] of [...svg.querySelectorAll('[data-current]')].entries()) {
    const start = timeline.labels.exchange + index * 0.095
    timeline
      .to(current, { attr: { opacity: 1 }, duration: 0.22, ease: 'sine.out' }, start)
      .to(current, { attr: { 'stroke-dashoffset': -1 }, duration: 1.04, ease: 'sine.inOut' }, start)
      .to(current, { attr: { opacity: 0 }, duration: 0.32, ease: 'sine.in' }, start + 0.72)
  }

  for (const [index, flare] of [...svg.querySelectorAll('[data-node-flare]')].entries()) {
    timeline
      .to(flare, { attr: { opacity: 0.55 }, duration: 0.31, ease: 'sine.inOut' }, 0.3 + index * 0.13)
      .to(flare, { attr: { opacity: 0 }, duration: 0.42, ease: 'sine.out' }, 0.61 + index * 0.13)
      .to(flare, { attr: { opacity: 0.83 }, duration: 0.2, ease: 'power1.out' }, 1.82 + (1 - index) * 0.095)
      .to(flare, { attr: { opacity: 0 }, duration: 0.58, ease: 'sine.out' }, 2.02 + (1 - index) * 0.095)
  }

  return {
    play: () => timeline.play(),
    pause: () => timeline.pause(),
    revert() {
      timeline.revert()
      pose.grip = 0
      pose.sweep = 0
      paint()
    },
  }
}
