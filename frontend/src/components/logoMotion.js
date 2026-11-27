// SVG motion for the legacy logo systems (v2, 2026-11-22).
//
// Each mark moves its own parts: regions of the artwork are cut out of the
// still image and turned, slid, extended or charged in place, with
// anticipation, overshoot and short trails (implied motion), instead of
// lights travelling over a still picture. Native SVG (SMIL) so the loader can
// pause it; with reduced motion, or paused, the still mark shows whole.
//
// Coordinates are in the artwork's 1000-unit box (the 1300px canvas).

export const LOGO_MOTIONS = {
  'circuit-e': { name: 'Sequential execution', note: 'Each ring node fires, its stub and route draw, and its bar strikes on, top to bottom; then all of it retracts.', type: 'circuit' },
  'circuit-spire': { name: 'Crown handover', note: 'Wireframe hands rise and draw in edge by edge, the circuit crown routes up between the fingers, then the Circuit E builds below.', type: 'spire' },
  'catalyst-core': { name: 'Fingertip relay', note: 'The wire hands rise turned in and open out, the fingertip nodes glow in turn, and the three bars of the E strike on between them.', type: 'core' },
  'routed-signal': { name: 'Open hands', note: 'The low-poly hands rise turned in and open out, the fingertips light amber, and the three bars of the E strike on between them.', type: 'routes' },
  ignition: { name: 'Agent ignition', note: 'The core compresses, then fires: the spire stretches, the ring blows outward and a shock wave leaves.', type: 'ignition' },
  aperture: { name: 'Aperture calibration', note: 'The crescent dial clicks round in three calibrated steps while the core turns against it.', type: 'aperture' },
  bloom: { name: 'Living bloom', note: 'The bloom turns a quarter at a time, winding back and swinging past before it settles and charges.', type: 'bloom' },
  'flow-field': { name: 'Vortex flow', note: 'Each vortex eye whips round in turn against its neighbours, and its loop charges as it spins.', type: 'vortices' },
  'neural-core': { name: 'Neural exchange', note: 'The core charges and pushes a pulse out through the loops, which turn around it.', type: 'neural' },
  'ribbon-catalyst': { name: 'Ribbon circulation', note: 'The torus winds back, then turns a third with a surge and eases to rest.', type: 'torus' },
  'signal-cascade': { name: 'Signal cascade', note: 'The rings themselves ripple outward from the core while the outer orbit carries its node round.', type: 'cascade' },
}

const EASE = {
  io: '.65 0 .35 1', // ease in-out
  out: '.16 1 .3 1', // fast start, long settle
  in: '.7 0 .84 0', // wind-up
  lin: '0 0 1 1',
  snap: '.2 .9 .1 1', // quick lock-in (SMIL splines must stay within 0-1)
}

let logoMotionInstance = 0

/**
 * @param {string} id logo system id
 * @param {string} href artwork URL
 * @param {number} [duration=6] loop length in seconds
 * @param {string} [title]
 */
export function renderLogoMotion(id, href, duration = 6, title = id) {
  const uid = 'en-motion-' + id + '-' + (++logoMotionInstance)
  const D = duration
  const kind = LOGO_MOTIONS[id].type
  const defs = [
    `<image id="${uid}-art" href="${href}" x="0" y="0" width="1000" height="1000" preserveAspectRatio="xMidYMid meet"/>`,
    `<filter id="${uid}-hot" x="-10%" y="-10%" width="120%" height="120%"><feComponentTransfer><feFuncR type="linear" slope="2.4"/><feFuncG type="linear" slope="2.4"/><feFuncB type="linear" slope="2.4"/></feComponentTransfer><feGaussianBlur stdDeviation="2"/></filter>`,
    `<filter id="${uid}-trail" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="4"/></filter>`,
    `<filter id="${uid}-core" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>`,
    `<filter id="${uid}-smear" x="-20%" y="-5%" width="140%" height="110%"><feGaussianBlur stdDeviation="14 1"/></filter>`,
  ]
  const cuts = []
  let n = 0
  const art = `<use href="#${uid}-art"/>`

  /* ── shapes (return SVG markup in the 1000 box) ─────────────────────── */
  const circle = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`
  const ring = (cx, cy, ro, ri) => `<path fill-rule="evenodd" clip-rule="evenodd" d="M${cx - ro} ${cy}a${ro} ${ro} 0 1 0 ${2 * ro} 0a${ro} ${ro} 0 1 0 ${-2 * ro} 0ZM${cx - ri} ${cy}a${ri} ${ri} 0 1 0 ${2 * ri} 0a${ri} ${ri} 0 1 0 ${-2 * ri} 0Z"/>`
  const rect = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`
  const ellipse = (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`
  const ALL = rect(0, 0, 1000, 1000)

  const clipOf = (shape) => {
    const cid = `${uid}-c${n++}`
    defs.push(`<clipPath id="${cid}">${shape}</clipPath>`)
    return `clip-path="url(#${cid})"`
  }

  /* ── keyframes: [[t 0-1, value, ease into this frame]] ──────────────── */
  const begin = (phase = 0, lag = 0) => `${(lag - phase * D).toFixed(3)}s`
  const timing = (frames) => {
    const keyTimes = frames.map(([t]) => t).join(';')
    const keySplines = frames.slice(1).map(([, , e]) => EASE[e || 'io']).join(';')
    return `keyTimes="${keyTimes}" calcMode="spline" keySplines="${keySplines}"`
  }
  const tf = (type, frames, fmt, phase, lag) =>
    `<animateTransform attributeName="transform" type="${type}" values="${frames.map(([, v]) => fmt(v)).join(';')}" ${timing(frames)} dur="${D}s" begin="${begin(phase, lag)}" repeatCount="indefinite"/>`
  const attr = (name, frames, phase, lag) =>
    `<animate attributeName="${name}" values="${frames.map(([, v]) => v).join(';')}" ${timing(frames)} dur="${D}s" begin="${begin(phase, lag)}" repeatCount="indefinite"/>`

  /**
   * One moving part of the artwork.
   * shape   region of the art (null = the whole mark)
   * cx, cy  pivot for rotate and scale
   * rot     degrees; scale (number or "sx sy"); move ("dx dy")
   * reveal  { x, y, w, h, axis: 'x'|'y'|'-y', frames: share 0-1 } a wipe in world space
   * fade    opacity frames for the part
   * hot     opacity frames for a charged (brightened) copy on top
   * trail   [from, to] window in which a blurred echo follows the part
   * cut     take the region out of the still image (default true)
   * phase   start offset as a share of the loop
   */
  function part(o) {
    const { shape = null, cx = 500, cy = 500, rot, scale, move, reveal, fade, hot, trail, cut = true, phase = 0, smear = false } = o
    if (cut) cuts.push(shape || ALL)
    const clip = shape ? clipOf(shape) : null
    let revealId = null
    if (reveal) {
      revealId = `${uid}-r${n++}`
      const { x, y, w, h, axis = 'x', frames } = reveal
      const sized = frames.map(([t, s, e]) => [t, axis === 'x' ? (w * s).toFixed(1) : (h * s).toFixed(1), e])
      const moved = axis === '-y' ? frames.map(([t, s, e]) => [t, (y + h * (1 - s)).toFixed(1), e]) : null
      defs.push(`<clipPath id="${revealId}"><rect x="${x}" y="${y}" width="${axis === 'x' ? 0 : w}" height="${axis === 'x' ? h : 0}">${attr(axis === 'x' ? 'width' : 'height', sized, phase)}${moved ? attr('y', moved, phase) : ''}</rect></clipPath>`)
    }
    const build = (img, lag) => {
      let g = clip ? `<g ${clip}>${img}</g>` : img
      if (scale) g = `<g transform="translate(${cx} ${cy})"><g>${tf('scale', scale, (v) => v, phase, lag)}<g transform="translate(${-cx} ${-cy})">${g}</g></g></g>`
      if (rot) g = `<g>${tf('rotate', rot, (v) => `${v} ${cx} ${cy}`, phase, lag)}${g}</g>`
      if (move) g = `<g>${tf('translate', move, (v) => v, phase, lag)}${g}</g>`
      if (revealId) g = `<g clip-path="url(#${revealId})">${g}</g>`
      return g
    }
    const layer = (inner, opacity, style = '') =>
      `<g class="motion-layer" opacity="${opacity ? opacity[0][1] : 1}"${style}>${opacity ? attr('opacity', opacity, phase) : ''}${inner}</g>`
    let out = ''
    if (trail) {
      const [a, b] = trail
      const on = [[0, 0], [a, 0], [a + (b - a) * 0.3, 0.5, 'out'], [b, 0, 'io'], [1, 0]]
        .filter((f, i, arr) => i === 0 || f[0] > arr[i - 1][0])
      out += layer(build(`<use href="#${uid}-art" filter="url(#${uid}-${smear ? 'smear' : 'trail'})"/>`, D * 0.045), on)
    }
    out += layer(build(art, 0), fade)
    if (hot) out += layer(build(`<use href="#${uid}-art" filter="url(#${uid}-hot)"/>`, 0), hot, ' style="mix-blend-mode:screen"')
    return out
  }

  /** A charged copy of a band that rides a rising edge (y = top of the band at each frame). */
  const edge = (frames, height, glow) => {
    const cid = `${uid}-e${n++}`
    defs.push(`<clipPath id="${cid}"><rect x="0" y="1000" width="1000" height="${height}">${attr('y', frames, 0)}</rect></clipPath>`)
    return `<g class="motion-layer" opacity="0" style="mix-blend-mode:screen">${attr('opacity', glow, 0)}<g clip-path="url(#${cid})"><use href="#${uid}-art" filter="url(#${uid}-hot)"/></g></g>`
  }

  /** A charged copy of a region, no movement (the region stays in the still image). */
  const charge = (shape, frames, phase = 0) => part({ shape, hot: frames, cut: false, fade: [[0, 0], [1, 0]], phase })
  /** The whole mark (or a region) expanding and fading: a wave made of the art itself. */
  const once = (frames) => frames.filter((f, i) => i === frames.length - 1 || f[0] < frames[i + 1][0])
  const wave = (shape, cx, cy, to, phase = 0, peak = 0.45, win = [0, 0.55]) => part({
    shape, cx, cy, cut: false, phase,
    scale: once([[0, 1], [win[0], 1], [win[1], to, 'out'], [1, to]]),
    fade: once([[0, 0], [win[0], peak], [win[1], 0, 'out'], [1, 0]]),
  })

  /**
   * A living centre: the still middle of a mark gets a soft, slowly turning
   * blur that breathes, and its own image ripples outward from it, so the
   * eye never rests on the artwork's flat, low-detail core. Soft-edged, so
   * no circle outline shows; drawn over everything else.
   */
  function centre(cx, cy, r, dir = 1, phase = 0) {
    const sid = `${uid}-s${n++}`
    defs.push(`<radialGradient id="${sid}-g" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse"><stop offset=".45" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`
      + `<mask id="${sid}" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000"><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${sid}-g)"/></mask>`
      + `<clipPath id="${sid}-c"><circle cx="${cx}" cy="${cy}" r="${r * 1.1}"/></clipPath>`)
    const region = `<g clip-path="url(#${sid}-c)">${art}</g>`
    const spin = tf('rotate', [[0, 0], [1, 360 * dir, 'lin']], (v) => `${v} ${cx} ${cy}`, phase, 0)
    const breathe = `<g class="motion-layer" opacity=".4">${attr('opacity', [[0, 0.35], [0.5, 0.85, 'io'], [1, 0.35, 'io']], phase)}`
      + `<g mask="url(#${sid})"><g>${spin}<g filter="url(#${uid}-core)">${region}</g></g></g></g>`
    const ripple = (p) => `<g class="motion-layer" opacity="0">${attr('opacity', [[0, 0.55], [1, 0, 'out']], phase + p)}`
      + `<g transform="translate(${cx} ${cy})"><g>${tf('scale', [[0, 0.92], [1, 1.5, 'out']], (v) => v, phase + p, 0)}<g transform="translate(${-cx} ${-cy})">`
      + `<g mask="url(#${sid})"><g filter="url(#${uid}-trail)">${region}</g></g></g></g></g></g>`
    return breathe + ripple(0) + ripple(0.5)
  }

  let moving = ''
  if (kind === 'circuit') {
    // Circuit E: each node fires and its bar shoots out from the spine; then all retract.
    const bars = [[292, 112, 625, 148, 200, 182], [292, 402, 583, 148, 200, 600], [292, 742, 623, 156, 200, 820]]
    moving = bars.map(([x, y, w, h, nx, ny], i) => {
      const s = 0.06 + i * 0.1
      return part({ shape: rect(x, y, w, h), trail: [s + 0.02, s + 0.14], smear: true,
        reveal: { x, y: y - 10, w: w + 10, h: h + 20, axis: 'x',
          frames: [[0, 0], [s, 0], [s + 0.12, 1, 'out'], [0.8 + i * 0.03, 1], [0.9 + i * 0.03, 0, 'in'], [1, 0]] } })
        + charge(circle(nx, ny, 70), [[0, 0], [s - 0.03, 0], [s, 1, 'out'], [s + 0.14, 0, 'io'], [1, 0]])
    }).join('')
  } else if (kind === 'spire') {
    // Circuit Spire: builds upward from the root behind a charged edge, then drains.
    const up = [[0, 0], [0.04, 0], [0.48, 1, 'io'], [0.78, 1], [0.96, 0, 'in'], [1, 0]]
    moving = part({ shape: null, reveal: { x: 0, y: 0, w: 1000, h: 1000, axis: '-y', frames: up } })
      + edge(up.map(([t, sh, e]) => [t, (1000 * (1 - sh) - 40).toFixed(1), e]), 80, [[0, 0], [0.04, 0.9], [0.46, 0.9], [0.52, 0, 'out'], [0.78, 0], [0.8, 0.7], [0.96, 0.7], [1, 0]])
      + charge(rect(440, 0, 120, 1000), [[0, 0], [0.48, 0], [0.54, 0.6, 'out'], [0.7, 0, 'io'], [1, 0]])
  } else if (kind === 'core') {
    // Catalyst Core: rings spin apart and snap back into line; the core flares on each lock.
    const lock = (dir) => [[0, 0], [0.06, 0], [0.1, -8 * dir, 'io'], [0.36, 186 * dir, 'out'], [0.42, 180 * dir, 'snap'],
      [0.56, 180 * dir], [0.6, 172 * dir, 'io'], [0.86, 366 * dir, 'out'], [0.92, 360 * dir, 'snap'], [1, 360 * dir]]
    moving = part({ shape: ring(500, 500, 405, 300), cx: 500, cy: 500, rot: lock(1), trail: [0.1, 0.4] })
      + part({ shape: ring(500, 500, 300, 196), cx: 500, cy: 500, rot: lock(-1), trail: [0.1, 0.4] })
      + charge(circle(500, 500, 196), [[0, 0], [0.38, 0], [0.42, 0.9, 'out'], [0.54, 0, 'io'], [0.88, 0], [0.92, 0.9, 'out'], [1, 0, 'io']])
  } else if (kind === 'routes') {
    // Routed Signal: routes draw out to their terminals, which pop; the charge rolls in.
    const routes = [[90, 232, 680, 76, 812, 272, 0.05], [90, 372, 820, 68, 0, 0, 0.11], [90, 552, 610, 76, 732, 592, 0.17], [90, 732, 680, 76, 812, 772, 0.23]]
    moving = routes.map(([x, y, w, h, tx, ty, s]) => part({ shape: rect(x, y, w, h),
      reveal: { x, y, w, h, axis: 'x', frames: [[0, 0], [s, 0], [s + 0.14, 1, 'out'], [0.84, 1], [0.94, 0, 'in'], [1, 0]] } })
      + (tx ? part({ shape: circle(tx, ty, 84), cx: tx, cy: ty,
        scale: [[0, 0.001], [s + 0.12, 0.001], [s + 0.17, 1.16, 'out'], [s + 0.22, 1, 'io'], [0.86, 1], [0.95, 0.001, 'in'], [1, 0.001]] }) : '')).join('')
      + part({ shape: rect(818, 496, 90, 134), reveal: { x: 818, y: 496, w: 90, h: 134, axis: 'x', frames: [[0, 0], [0.4, 0], [0.48, 1, 'out'], [0.84, 1], [0.92, 0, 'in'], [1, 0]] } })
      + part({ shape: circle(496, 476, 50), trail: [0.26, 0.44], smear: true,
        move: [[0, '-380 0'], [0.26, '-380 0'], [0.4, '14 0', 'out'], [0.46, '0 0', 'io'], [0.84, '0 0'], [0.92, '0 0'], [1, '-380 0', 'in']],
        fade: [[0, 0], [0.26, 0], [0.28, 1, 'out'], [0.86, 1], [0.95, 0, 'io'], [1, 0]] })
  } else if (kind === 'ignition') {
    // Ignition: the core compresses, then fires; the spire stretches, the ring blows outward, a shock wave leaves.
    moving = part({ shape: ring(500, 500, 222, 112), cx: 500, cy: 500, trail: [0.33, 0.5],
      scale: [[0, 1], [0.3, 0.94, 'in'], [0.36, 1.09, 'out'], [0.47, 0.985, 'io'], [0.56, 1, 'io'], [1, 1]] })
      + part({ shape: rect(455, 60, 110, 880), cx: 500, cy: 500,
        scale: [[0, 1], [0.3, '1 .9', 'in'], [0.36, '1 1.1', 'out'], [0.48, '1 .98', 'io'], [0.56, 1, 'io'], [1, 1]] })
      + part({ shape: circle(500, 500, 112), cx: 500, cy: 500,
        scale: [[0, 1], [0.3, 0.84, 'in'], [0.35, 1.14, 'out'], [0.46, 0.97, 'io'], [0.54, 1, 'io'], [1, 1]],
        hot: [[0, 0], [0.3, 0.7, 'in'], [0.36, 1, 'out'], [0.6, 0, 'io'], [1, 0]] })
      + wave(null, 500, 500, 1.3, 0, 0.5, [0.34, 0.7])
  } else if (kind === 'aperture') {
    // Aperture: the crescent dial clicks round in three calibrated steps; the core turns against it.
    const clicks = [0, 1, 2].flatMap((i) => [[i / 3 + 0.06, i * 120], [i / 3 + 0.1, i * 120 - 6, 'io'], [i / 3 + 0.22, i * 120 + 125, 'out'], [i / 3 + 0.28, i * 120 + 120, 'io']])
    moving = part({ shape: ring(500, 500, 480, 300), cx: 500, cy: 500, rot: [[0, 0], ...clicks, [1, 360]], trail: [0.1, 0.22] })
      + part({ shape: circle(340, 496, 120), cx: 340, cy: 496, rot: [[0, 0], [1, -360, 'lin']] })
      + [0, 1, 2].map((i) => charge(circle(340, 496, 60), [[0, 0], [0.2, 0], [0.23, 0.8, 'out'], [0.32, 0, 'io'], [1, 0]], -i / 3)).join('')
  } else if (kind === 'bloom') {
    // Bloom: four quarter-turns a loop; each winds back, swings past and settles, and the lobe that lands on top charges.
    const turns = [0, 1, 2, 3].flatMap((i) => [[i / 4 + 0.04, i * 90], [i / 4 + 0.08, i * 90 - 5, 'io'], [i / 4 + 0.19, i * 90 + 96, 'out'], [i / 4 + 0.24, i * 90 + 90, 'io']])
    const swell = [0, 1, 2, 3].flatMap((i) => [[i / 4 + 0.08, 1], [i / 4 + 0.14, 1.04, 'out'], [i / 4 + 0.24, 1, 'io']])
    moving = part({ shape: null, cx: 500, cy: 500, rot: [[0, 0], ...turns, [1, 360]], scale: [[0, 1], ...swell, [1, 1]], trail: [0.08, 0.2] })
      + [0, 1, 2, 3].map((i) => charge(circle(500, 500, 210), [[0, 0], [0.17, 0], [0.2, 0.6, 'out'], [0.3, 0, 'io'], [1, 0]], -i / 4)).join('')
  } else if (kind === 'vortices') {
    // Flow Field: each vortex's eye whips round in turn against its neighbours, and its loop charges as it spins.
    const v = [[362, 352, 1, 0], [632, 360, -1, 0.25], [650, 650, 1, 0.5], [362, 642, -1, 0.75]]
    moving = v.map(([x, y, d, p]) => part({ shape: circle(x, y, 92), cx: x, cy: y, phase: -p, trail: [0.06, 0.3], cut: true,
        rot: [[0, 0], [0.06, -16 * d, 'io'], [0.28, 372 * d, 'out'], [0.36, 360 * d, 'io'], [1, 360 * d]] })
        + charge(circle(x, y, 150), [[0, 0], [0.08, 0], [0.16, 0.55, 'out'], [0.4, 0, 'io'], [1, 0]], -p)).join('')
  } else if (kind === 'neural') {
    // Neural Core: the core charges and pushes a pulse out through the loops, which turn around it.
    moving = part({ shape: ring(482, 482, 440, 205), cx: 482, cy: 482, rot: [[0, 0], [0.4, 8, 'in'], [0.62, 128, 'out'], [1, 120, 'io']], trail: [0.42, 0.64] })
      + part({ shape: circle(482, 482, 205), cx: 482, cy: 482,
        scale: [[0, 1], [0.36, 0.95, 'in'], [0.42, 1.06, 'out'], [0.6, 1, 'io'], [1, 1]],
        hot: [[0, 0], [0.36, 0.6, 'in'], [0.42, 0.9, 'out'], [0.62, 0, 'io'], [1, 0]] })
      + wave(circle(482, 482, 205), 482, 482, 2.1, 0, 0.55, [0.4, 0.78])
  } else if (kind === 'torus') {
    // Ribbon Catalyst: the torus turns with a surge; its inner circuit counter-rotates.
    moving = part({ shape: circle(490, 500, 462), cx: 490, cy: 500, trail: [0.1, 0.55],
      rot: [[0, 0], [0.1, -6, 'io'], [0.55, 128, 'out'], [1, 120, 'io']] })
  } else if (kind === 'cascade') {
    // Signal Cascade: the rings ripple outward from the core; the outer orbit carries its node.
    moving = [0, 1 / 3, 2 / 3].map((p) => wave(circle(500, 500, 300), 500, 500, 1.6, p, 0.5, [0, 0.62])).join('')
      + part({ shape: ring(500, 500, 360, 225), cx: 500, cy: 500, rot: [[0, 0], [1, 120, 'lin']] })
      + part({ shape: circle(500, 500, 132), cx: 500, cy: 500, rot: [[0, 0], [0.4, -8, 'in'], [0.58, 130, 'out'], [1, 120, 'io']],
        hot: [[0, 0], [0.5, 0], [0.56, 0.9, 'out'], [0.8, 0, 'io'], [1, 0]] })
  }

  // Marks with a still middle: give it a living centre (cx, cy, r, turn direction)
  const CENTRES = {
    'orbital-network': [[500, 500, 70, 1]],
    constellation: [[500, 500, 130, -1]],
    'catalyst-core': [[500, 500, 150, 1]],
    ignition: [[500, 500, 100, 1]],
    aperture: [[340, 496, 110, -1]],
    bloom: [[500, 500, 150, 1]],
    'flow-field': [[362, 352, 70, 1], [632, 360, 70, -1], [650, 650, 70, 1], [362, 642, 70, -1]],
    'neural-core': [[482, 482, 175, 1]],
    'signal-cascade': [[500, 500, 125, -1]],
  }
  moving += (CENTRES[id] || []).map(([x, y, r, d], i) => centre(x, y, r, d, i * 0.17)).join('')

  const mask = cuts.length
    ? `<mask id="${uid}-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000"><rect width="1000" height="1000" fill="#fff"/><g fill="#000">${cuts.join('')}</g></mask>`
    : ''
  const base = cuts.length ? `<use href="#${uid}-art" class="motion-cut" mask="url(#${uid}-cut)"/>` : art
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" class="logo-loop" role="img" aria-label="${title} loading animation" data-logo="${id}"><title>${title} — ${LOGO_MOTIONS[id].name}</title><style>@media(prefers-reduced-motion:reduce){svg:not(.motion-opt-in) .motion-layer{display:none}svg:not(.motion-opt-in) .motion-cut{mask:none}}.motion-still .motion-layer{display:none}.motion-still .motion-cut{mask:none}</style><defs>${defs.join('')}${mask}</defs>${base}${moving}</svg>`
}
