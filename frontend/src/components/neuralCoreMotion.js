import { gsap } from 'gsap/gsap-core.js'

const CENTER = [486, 492]
const CAMERA = 960
const DURATION = 4.48
const CORE_NODES = [[423, 393], [450, 425], [546, 425], [586, 423], [499, 475], [453, 559], [558, 559], [581, 587]]

// Control points are recorded in the resting illustration's screen space,
// with depth relative to the lattice. Unproject them before moving the fibres.
const FIBRES = [
  { at: 0.52, span: 2.10, tint: '#58edf1', crest: '#ebffff', knots: [
    [462, 432, -35], [381, 408, -55], [313, 321, -96], [401, 233, -108],
    [481, 140, -118], [603, 124, -97], [699, 210, -54],
    [768, 269, -4], [777, 371, 59], [706, 406, 79],
    [637, 449, 63], [568, 409, 18], [538, 452, 12],
  ] },
  { at: 0.83, span: 2.14, tint: '#ff597d', crest: '#ffe1d0', knots: [
    [551, 434, -28], [650, 369, -61], [769, 387, -91], [846, 470, -65],
    [940, 568, 18], [895, 684, 71], [788, 716, 97],
    [677, 752, 68], [615, 689, 18], [566, 588, -12],
  ] },
  { at: 1.14, span: 2.17, tint: '#67ebf0', crest: '#dffff8', knots: [
    [532, 591, 34], [625, 578, 61], [674, 686, 91], [619, 763, 119],
    [555, 851, 111], [438, 845, 49], [359, 769, -22],
    [279, 699, -84], [289, 576, -99], [428, 511, -31],
  ] },
  { at: 1.46, span: 2.10, tint: '#fc7794', crest: '#fff2c7', knots: [
    [436, 507, 22], [363, 564, 72], [234, 569, 76], [156, 488, 49],
    [57, 391, -29], [189, 304, -88], [303, 324, -106],
    [367, 331, -76], [417, 361, -25], [458, 408, 9],
  ] },
]

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value))
const ease = (t) => t * t * (3 - 2 * t)
const format = (value) => value.toFixed(1)

function fibrePoints(knots) {
  const world = knots.map(([x, y, z]) => [(x - CENTER[0]) * (1 - z / CAMERA), (y - CENTER[1]) * (1 - z / CAMERA), z])
  const points = []
  let length = 0
  for (let i = 0; i < world.length - 1; i += 3) {
    const [a, b, c, d] = world.slice(i, i + 4)
    for (let j = i === 0 ? 0 : 1; j <= 22; j++) {
      const t = j / 22
      const u = 1 - t
      const point = a.map((v, k) => u ** 3 * v + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t ** 3 * d[k])
      const last = points.at(-1)
      if (last) length += Math.hypot(point[0] - last[0], point[1] - last[1], point[2] - last[2])
      points.push([...point, length])
    }
  }
  return points.map(([x, y, z, traveled]) => [x, y, z, traveled / length])
}

function project(points, s, time, order) {
  const progress = clamp(s)
  const right = points.findIndex((point) => point[3] >= progress)
  const b = points[right]
  const a = points[Math.max(0, right - 1)]
  const t = right <= 0 ? 0 : (progress - a[3]) / (b[3] - a[3])
  const x = a[0] + (b[0] - a[0]) * t
  const y = a[1] + (b[1] - a[1]) * t
  const envelope = Math.sin(Math.PI * progress)
  const curl = Math.sin(progress * 10 - time * 5.5 + order * 1.5) * envelope
  const z = a[2] + (b[2] - a[2]) * t + curl * 42
  const scale = CAMERA / (CAMERA - z)
  return { x: CENTER[0] + (x + curl * 10) * scale, y: CENTER[1] + (y - curl * 9) * scale, z, scale }
}

function ribbon(points, head, time, order) {
  const start = clamp(head - 0.33)
  const end = clamp(head)
  const samples = Array.from({ length: 23 }, (_, i) => {
    const s = start + (end - start) * i / 22
    return { ...project(points, s, time, order), s }
  })
  const layers = [[], []]
  let previousLayer
  for (const [i, point] of samples.entries()) {
    const a = samples[Math.max(0, i - 1)]
    const b = samples[Math.min(samples.length - 1, i + 1)]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const along = clamp((head - point.s) / 0.33)
    const width = (1.1 + Math.sin(along * Math.PI) * (8.5 + 2.5 * Math.sin(time * 8.2 - point.s * 19)))
      * point.scale / Math.max(0.001, Math.hypot(dx, dy))
    const band = [`${format(point.x - dy * width)} ${format(point.y + dx * width)}`,
      `${format(point.x + dy * width)} ${format(point.y - dx * width)}`,
      `${format(point.x)} ${format(point.y)}`]
    const layer = point.z < 0 ? 0 : 1
    if (layer !== previousLayer) {
      if (previousLayer !== undefined) layers[previousLayer].at(-1).push(band)
      layers[layer].push([])
      previousLayer = layer
    }
    layers[layer].at(-1).push(band)
  }
  return layers.map((sections) => ({
    body: sections.map((s) => `M${s.map((p) => p[0]).join('L')}L${s.map((p) => p[1]).reverse().join('L')}Z`).join(''),
    line: sections.map((s) => `M${s.map((p) => p[2]).join('L')}`).join(''),
  }))
}

export function renderNeuralCoreLoading(art, key) {
  const id = `neural-loom-${key}`
  const plane = (rear) => FIBRES.map(({ tint, crest }, i) => `<g data-neural-fibre="${i}" opacity="0">
    <path data-neural-haze="" d="" fill="none" stroke="${tint}" stroke-width="19" stroke-opacity=".51" stroke-linecap="round" filter="url(#${id}-blur)"/>
    <path data-neural-band="" d="" fill="${tint}" fill-opacity=".33"/>
    <path data-neural-edge="" d="" fill="none" stroke="${crest}" stroke-width="${rear ? 2 : 3.4}" stroke-opacity=".86" stroke-linecap="round"/>
    <circle data-neural-head="" fill="${crest}" r="0"/>
    ${Array.from({ length: 7 }, () => `<circle data-neural-mote="" fill="${crest}" opacity="0" r="0"/>`).join('')}
  </g>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" role="img" aria-label="Neural Core">
    <defs>
      <filter id="${id}-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
      <mask id="${id}-lattice" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000">
        <rect width="1000" height="1000" fill="white"/><rect x="396" y="364" width="200" height="244" rx="20" fill="black"/>
      </mask>
      <radialGradient id="${id}-node"><stop stop-color="#fff5ca"/><stop offset=".19" stop-color="#ffcd79" stop-opacity=".86"/><stop offset="1" stop-color="#f88245" stop-opacity="0"/></radialGradient>
    </defs>
    <image href="${art}" width="1000" height="1000"/>
    <g data-neural-rear="" mask="url(#${id}-lattice)">${plane(true)}</g>
    <g data-neural-front="">${plane(false)}</g>
    ${CORE_NODES.map(([cx, cy]) => `<circle data-neural-node="" cx="${cx}" cy="${cy}" r="30" fill="url(#${id}-node)" opacity="0"/>`).join('')}
  </svg>`
}

export function createNeuralCoreTimeline(svg) {
  const clock = { time: 0 }
  const makeLayer = (side) => Array.from(svg.querySelectorAll(`[data-neural-${side}] [data-neural-fibre]`), (group) => ({
    group,
    band: group.querySelector('[data-neural-band]'),
    edge: group.querySelector('[data-neural-edge]'),
    haze: group.querySelector('[data-neural-haze]'),
    head: group.querySelector('[data-neural-head]'),
    motes: [...group.querySelectorAll('[data-neural-mote]')],
  }))
  const rear = makeLayer('rear')
  const front = makeLayer('front')
  const fibres = FIBRES.map(({ knots, ...fibre }, i) => ({ ...fibre, points: fibrePoints(knots), layers: [rear[i], front[i]] }))

  function paint() {
    fibres.forEach(({ at, span, points, layers }, i) => {
      const t = (clock.time - at) / span
      const alpha = ease(clamp(t * 9)) * ease(clamp((1 - t) * 6))
      if (alpha <= 0) {
        layers.forEach(({ group }) => group.setAttribute('opacity', '0'))
        return
      }
      const head = t * 1.33
      const tip = project(points, clamp(head), clock.time, i)
      const strips = ribbon(points, head, clock.time, i)
      layers.forEach(({ group, band, haze, edge, head: orb, motes }, depth) => {
        group.setAttribute('opacity', (alpha * (depth ? 1 : 0.63)).toFixed(3))
        band.setAttribute('d', strips[depth].body)
        haze.setAttribute('d', strips[depth].line)
        edge.setAttribute('d', strips[depth].line)
        orb.setAttribute('cx', format(tip.x))
        orb.setAttribute('cy', format(tip.y))
        orb.setAttribute('r', head < 1 && Number(tip.z >= 0) === depth ? format(4.6 * tip.scale) : '0')
        motes.forEach((mote, j) => {
          const s = head - 0.048 - j * 0.039
          const p = project(points, clamp(s), clock.time, i)
          const spread = Math.sin(clock.time * 5.7 + j * 2.35) * (8 + j * 2.8)
          const glow = s > 0 && s < 1 && Number(p.z >= 0) === depth ? (0.85 - j * 0.081) : 0
          mote.setAttribute('cx', format(p.x + spread))
          mote.setAttribute('cy', format(p.y + Math.cos(clock.time * 4 + j) * (6 + j * 1.4)))
          mote.setAttribute('r', format((1.8 + j % 3 * 0.6) * p.scale))
          mote.setAttribute('opacity', glow.toFixed(3))
        })
      })
    })
  }

  const timeline = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.18 })
  timeline.to(clock, { time: DURATION, duration: DURATION, ease: 'none', onUpdate: paint }, 0)
  svg.querySelectorAll('[data-neural-node]').forEach((node, i) => {
    const at = 0.04 + i * 0.079
    timeline
      .to(node, { attr: { opacity: 0.81 }, duration: 0.14, ease: 'sine.out' }, at)
      .to(node, { attr: { opacity: 0 }, duration: 0.57, ease: 'sine.inOut' }, at + 0.14)
      .to(node, { attr: { opacity: 0.52 }, duration: 0.27, ease: 'sine.out' }, 3.41 + i * 0.057)
      .to(node, { attr: { opacity: 0 }, duration: 0.40, ease: 'sine.inOut' }, 3.68 + i * 0.057)
  })
  return {
    play: () => timeline.play(),
    pause: () => timeline.pause(),
    revert() {
      timeline.revert()
      clock.time = 0
      paint()
    },
  }
}
