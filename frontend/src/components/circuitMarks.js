// Vector redraws of the four circuit marks (Circuit E, Circuit Spire,
// Catalyst Core, Routed Signal), 2026-11-22. Three finishes share one geometry
// and one choreography: engraved (hairline + hatching), machined (matte
// graphite solids) and drafted (ink lines over construction lines). Crimson is
// kept for the one thing that is live at any moment; nothing glows.
//
// renderCircuitMark(id, finish, duration) returns an SVG string in the same
// 1000-unit box as the illustrated marks. The still mark (.mark-static) shows
// when paused or with reduced motion; the animated copy is .motion-layer.

export const CIRCUIT_MARK_IDS = ['circuit-e', 'circuit-spire', 'catalyst-core', 'routed-signal']
export const CIRCUIT_FINISHES = ['engraved', 'machined', 'drafted']

const EASE = { io: '.65 0 .35 1', out: '.16 1 .3 1', in: '.7 0 .84 0', lin: '0 0 1 1' }
/* Engraved and Machined are neutral with a crimson live point. Drafted carries
   the original marks' warm colour as flat ink: vermilion line, copper weight,
   oxblood construction, cream cores, amber for what is live. */
const PALETTES = {
  neutral: { BG: '#060606', INK: '#E9E9E4', MUT: '#6E6E69', CRIMSON: '#FF2D6B', COPPER: '#E9E9E4', DEEP: '#060606', CREAM: '#E9E9E4' },
  drafted: { BG: '#060606', INK: '#E8573C', MUT: '#6E2B21', CRIMSON: '#FFB347', COPPER: '#D98C5F', DEEP: '#2B0B07', CREAM: '#F6D8B7' },
}

let instance = 0

export function renderCircuitMark(id, finish = 'engraved', duration = 6, title = id) {
  const uid = `en-cm-${id}-${finish}-${++instance}`
  const { BG, INK, MUT, CRIMSON, COPPER, DEEP, CREAM } = PALETTES[finish] || PALETTES.neutral
  const D = duration
  const defs = []

  /* ── timing ─────────────────────────────────────────────────────────── */
  const timing = (f) => `keyTimes="${f.map(([t]) => t).join(';')}" calcMode="spline" keySplines="${f.slice(1).map(([, , e]) => EASE[e || 'io']).join(';')}"`
  const loop = `dur="${D}s" repeatCount="indefinite"`
  const a = (attr, f) => `<animate attributeName="${attr}" values="${f.map(([, v]) => v).join(';')}" ${timing(f)} ${loop}/>`
  const at = (type, f, fmt = (v) => v) => `<animateTransform attributeName="transform" type="${type}" values="${f.map(([, v]) => fmt(v)).join(';')}" ${timing(f)} ${loop} additive="sum"/>`
  const once = (f) => f.filter((x, i) => i === f.length - 1 || x[0] < f[i + 1][0])
  /** visible-in-between frames for 0→1→0 style values */
  const pulse = (on, off, lo, hi, s0, s1, e0, e1) => once([[0, lo], [s0, lo], [s1, hi, on], [e0, hi], [e1, lo, off], [1, lo]])

  const scaleAt = (cx, cy, f, inner) => `<g transform="translate(${cx} ${cy})"><g>${at('scale', f)}<g transform="translate(${-cx} ${-cy})">${inner}</g></g></g>`
  const rotateAt = (cx, cy, f, inner) => `<g>${at('rotate', f, (v) => `${v} ${cx} ${cy}`)}${inner}</g>`
  const moveBy = (f, inner) => `<g>${at('translate', f)}${inner}</g>`
  const revealX = (x, y, w, h, f, inner) => {
    const cid = `${uid}-r${defs.length}`
    defs.push(`<clipPath id="${cid}"><rect x="${x}" y="${y}" width="0" height="${h}">${a('width', f.map(([t, s, e]) => [t, (w * s).toFixed(1), e]))}</rect></clipPath>`)
    return `<g clip-path="url(#${cid})">${inner}</g>`
  }
  const fade = (f, inner) => `<g opacity="${f[0][1]}">${a('opacity', f)}${inner}</g>`

  /* ── finishes ───────────────────────────────────────────────────────── */
  defs.push(
    `<pattern id="${uid}-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="10" stroke="${MUT}" stroke-width="1.4"/></pattern>`,
    `<linearGradient id="${uid}-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4C4C50"/><stop offset=".45" stop-color="#2C2C2F"/><stop offset="1" stop-color="#1B1B1D"/></linearGradient>`,
    `<radialGradient id="${uid}-cap" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#55555A"/><stop offset="1" stop-color="#1C1C1E"/></radialGradient>`,
  )
  const F = {
    engraved: {
      body: (x, y, w, h, r = 6) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#${uid}-hatch)" stroke="${INK}" stroke-width="2.5"/>`,
      trace: (d, extra = '', inner = '') => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"${extra}>${inner}</path>`,
      heavy: (d, extra = '', inner = '') => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"${extra}>${inner}</path>`,
      node: (cx, cy, r, core) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${BG}" stroke="${INK}" stroke-width="2.5"/><circle cx="${cx}" cy="${cy}" r="${r * 0.62}" fill="none" stroke="${MUT}" stroke-width="1.5"/>${core}`,
      coreFill: INK,
      pad: (cx, cy, r = 8) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${BG}" stroke="${INK}" stroke-width="2.5"/>`,
      ring: (cx, cy, r, kind) => kind === 'dash'
        ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="46 16"/>`
        : kind === 'fine' ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${MUT}" stroke-width="1.5"/>`
          : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${INK}" stroke-width="2.5"/>`,
      band: (cx, cy, r, w) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#${uid}-hatch)" stroke-width="${w}"/><circle cx="${cx}" cy="${cy}" r="${r + w / 2}" fill="none" stroke="${INK}" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="${r - w / 2}" fill="none" stroke="${INK}" stroke-width="2"/>`,
      guide: () => '',
    },
    machined: {
      body: (x, y, w, h, r = 6) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#${uid}-metal)"/><rect x="${x + r}" y="${y + 1}" width="${Math.max(0, w - 2 * r)}" height="2.5" fill="#8C8C90" opacity=".55"/>`,
      trace: (d, extra = '', inner = '') => `<path d="${d}" fill="none" stroke="#3E3E42" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"${extra}>${inner}</path>`,
      heavy: (d, extra = '', inner = '') => `<path d="${d}" fill="none" stroke="#45454A" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"${extra}>${inner}</path>`,
      node: (cx, cy, r, core) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${uid}-cap)" stroke="#5C5C61" stroke-width="2"/>${core}`,
      coreFill: '#9A9A94',
      pad: (cx, cy, r = 9) => `<circle cx="${cx}" cy="${cy}" r="${r + 2}" fill="#6A6A6E"/>`,
      ring: (cx, cy, r, kind) => kind === 'dash'
        ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#36363A" stroke-width="18" stroke-dasharray="64 18"/>`
        : kind === 'fine' ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#5A5A5E" stroke-width="3"/>`
          : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#2E2E31" stroke-width="22"/><circle cx="${cx}" cy="${cy}" r="${r - 10}" fill="none" stroke="#77777B" stroke-width="1.5" opacity=".6"/>`,
      band: (cx, cy, r, w) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#2A2A2D" stroke-width="${w}"/><circle cx="${cx}" cy="${cy}" r="${r + w / 2 - 2}" fill="none" stroke="#6A6A6E" stroke-width="2" opacity=".7"/>`,
      guide: () => '',
    },
    drafted: {
      body: (x, y, w, h, r = 6) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${DEEP}" stroke="${INK}" stroke-width="2.5"/><line x1="${x + 14}" y1="${y + h / 2}" x2="${x + w - 14}" y2="${y + h / 2}" stroke="${COPPER}" stroke-width="1.6" stroke-dasharray="10 8"/>`,
      trace: (d, extra = '', inner = '') => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="square" stroke-linejoin="miter"${extra}>${inner}</path>`,
      heavy: (d, extra = '', inner = '') => `<path d="${d}" fill="none" stroke="${COPPER}" stroke-width="4.5" stroke-linecap="square" stroke-linejoin="miter"${extra}>${inner}</path>`,
      node: (cx, cy, r, core) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${DEEP}" stroke="${INK}" stroke-width="2.5"/><path d="M${cx - r - 14} ${cy}H${cx + r + 14}M${cx} ${cy - r - 14}V${cy + r + 14}" stroke="${MUT}" stroke-width="1.2"/>${core}`,
      coreFill: CREAM,
      pad: (cx, cy, r = 8) => `<rect x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" fill="${BG}" stroke="${COPPER}" stroke-width="2.5"/>`,
      ring: (cx, cy, r, kind) => kind === 'dash'
        ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${COPPER}" stroke-width="1.8" stroke-dasharray="6 9"/>`
        : kind === 'fine' ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${MUT}" stroke-width="1.4"/>`
          : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${INK}" stroke-width="2.5"/>`,
      band: (cx, cy, r, w) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${DEEP}" stroke-width="${w}"/><circle cx="${cx}" cy="${cy}" r="${r + w / 2}" fill="none" stroke="${INK}" stroke-width="2.5"/><circle cx="${cx}" cy="${cy}" r="${r - w / 2}" fill="none" stroke="${COPPER}" stroke-width="2"/>`,
      guide: (d) => `<path d="${d}" fill="none" stroke="${MUT}" stroke-width="1" stroke-dasharray="4 7" opacity=".9"/>`,
    },
  }[finish]

  /** A node whose centre lights crimson over [on, off] (shares of the loop). */
  const node = (cx, cy, r, live) => {
    const fill = live
      ? `<circle cx="${cx}" cy="${cy}" r="${r * 0.34}" fill="${F.coreFill}">${a('fill', once([[0, F.coreFill], [live[0], F.coreFill], [live[0] + 0.02, CRIMSON, 'out'], [live[1], CRIMSON], [live[1] + 0.06, F.coreFill, 'io'], [1, F.coreFill]]))}</circle>`
      : `<circle cx="${cx}" cy="${cy}" r="${r * 0.34}" fill="${F.coreFill}"/>`
    return F.node(cx, cy, r, fill)
  }
  /** A path that draws itself over [s, s+d] and erases over [e, e+d2]. */
  const drawn = (d, s, dur, e, edur, heavy = false, reverseErase = false) => {
    const f = once([[0, 1], [s, 1], [s + dur, 0, 'out'], [e, 0], [e + edur, reverseErase ? -1 : 1, 'in'], [1, reverseErase ? -1 : 1]])
    return (heavy ? F.heavy : F.trace)(d, ' pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"', a('stroke-dashoffset', f))
  }
  const popAt = (cx, cy, s, e, inner) => scaleAt(cx, cy, once([[0, 0.001], [s, 0.001], [s + 0.05, 1.14, 'out'], [s + 0.1, 1, 'io'], [e, 1], [e + 0.07, 0.001, 'in'], [1, 0.001]]), inner)

  let still = ''
  let moving = ''
  const both = (s, m) => { still += s; moving += m }

  if (id === 'circuit-e') {
    // Spine with three nodes; each node fires and its bar slides out from behind the spine.
    const bars = [[141, 618], [456, 558], [771, 618]]
    const nodes = [185, 500, 815]
    const spine = F.body(168, 150, 64, 700, 32)
    both(F.guide('M200 60V940M110 185H900M110 500H900M110 815H900'), F.guide('M200 60V940M110 185H900M110 500H900M110 815H900'))
    const traceD = 'M224 345H330L370 385H560'
    still += bars.map(([y, w]) => F.body(262, y, w, 88, 4)).join('') + spine + F.trace(traceD) + F.pad(560, 385)
      + nodes.map((y) => node(200, y, 58)).join('') + node(200, 345, 24)
    moving += bars.map(([y, w], i) => {
      const s = 0.06 + i * 0.1
      const out = 0.8 + i * 0.03
      const slide = once([[0, '-60 0'], [s, '-60 0'], [s + 0.11, '10 0', 'out'], [s + 0.17, '0 0', 'io'], [out, '0 0'], [out + 0.1, '-60 0', 'in'], [1, '-60 0']])
      return revealX(234, y - 6, w + 60, 100, once([[0, 0], [s, 0], [s + 0.11, 1, 'out'], [out, 1], [out + 0.1, 0, 'in'], [1, 0]]), moveBy(slide, F.body(262, y, w, 88, 4)))
    }).join('')
      + spine + drawn(traceD, 0.36, 0.12, 0.8, 0.08) + popAt(560, 385, 0.46, 0.8, F.pad(560, 385))
      + nodes.map((y, i) => node(200, y, 58, [0.04 + i * 0.1, 0.16 + i * 0.1])).join('') + node(200, 345, 24, [0.36, 0.5])
  } else if (id === 'circuit-spire') {
    // A routing trunk builds upward from its root; branches sprout as the edge passes them, then it drains.
    const trunk = 'M500 940V760L470 730V560L530 500V320L500 290V70'
    const tx = (y) => (y > 745 ? 500 : y > 530 ? 470 : y > 305 ? 530 : 500)
    const br = [[860, -1, 170], [800, 1, 200], [700, -1, 240], [655, 1, 150], [600, -1, 130], [540, 1, 250], [470, -1, 210], [420, 1, 170], [380, -1, 150], [300, 1, 210], [230, -1, 120], [180, 1, 120]]
    const branch = ([y, d, len]) => {
      const x = tx(y), k = len * 0.6
      return { d: `M${x} ${y}H${x + d * k}L${x + d * (k + 22)} ${y - 22}H${x + d * len}`, end: [x + d * len, y - 22] }
    }
    const parts = [[612, 362, 30], [392, 598, 28], [604, 664, 24]]
    both(F.guide('M500 30V970M300 940H700'), F.guide('M500 30V970M300 940H700'))
    still += F.heavy(trunk) + br.map((b) => { const { d, end } = branch(b); return F.trace(d) + F.pad(end[0], end[1], 7) }).join('')
      + parts.map(([x, y, r]) => node(x, y, r)).join('') + F.pad(500, 940, 11) + F.pad(500, 70, 9)
    const edge = (y) => 0.04 + 0.41 * (940 - y) / 870
    moving += drawn(trunk, 0.04, 0.41, 0.82, 0.12, true, true)
      + br.map((b) => {
        const { d, end } = branch(b)
        const s = edge(b[0])
        return drawn(d, s, 0.08, 0.8, 0.1) + popAt(end[0], end[1], s + 0.07, 0.8, F.pad(end[0], end[1], 7))
      }).join('')
      + parts.map(([x, y, r]) => popAt(x, y, edge(y) + 0.04, 0.8, node(x, y, r, [edge(y) + 0.04, edge(y) + 0.14]))).join('')
      + popAt(500, 940, 0.02, 0.86, F.pad(500, 940, 11)) + popAt(500, 70, 0.44, 0.84, F.pad(500, 70, 9))
      // the live edge: a crimson head that rides the trunk as it builds
      + fade(once([[0, 0], [0.04, 1], [0.44, 1], [0.48, 0, 'out'], [1, 0]]),
        `<circle r="9" fill="${CRIMSON}"><animateMotion path="${trunk}" keyPoints="0;0;1;1" keyTimes="0;.04;.45;1" calcMode="spline" keySplines="0 0 1 1;.65 0 .35 1;0 0 1 1" ${loop}/></circle>`)
  } else if (id === 'catalyst-core') {
    // Rings spin apart and lock back into line with the fixed keys; the core fires on each lock.
    const keys = 'M140 440H330M670 440H860M140 560H330M670 560H860'
    const outer = F.ring(500, 500, 388) + F.ring(500, 500, 330, 'dash')
      + `<g>${[0, 180].map((deg) => `<rect x="${500 + 330 - 26}" y="${500 - 22}" width="52" height="44" rx="4" transform="rotate(${deg} 500 500)" fill="${finish === 'machined' ? '#55555A' : BG}" stroke="${finish === 'machined' ? 'none' : INK}" stroke-width="2.5"/>`).join('')}</g>`
    const inner = F.band(500, 500, 232, 34) + [45, 135, 225, 315].map((deg) => `<rect x="${500 + 232 - 8}" y="${500 - 8}" width="16" height="16" transform="rotate(${deg} 500 500)" fill="${F.coreFill}"/>`).join('')
    const legs = 'M395 610V560H426M605 610V560H574'
    const lockF = (dir) => once([[0, 0], [0.06, 0], [0.1, -8 * dir, 'io'], [0.36, 186 * dir, 'out'], [0.42, 180 * dir, 'io'], [0.56, 180 * dir], [0.6, 172 * dir, 'io'], [0.86, 366 * dir, 'out'], [0.92, 360 * dir, 'io'], [1, 360 * dir]])
    both(F.guide('M500 60V940M60 500H940'), F.guide('M500 60V940M60 500H940'))
    still += F.trace(keys) + outer + inner + F.trace(legs) + node(395, 650, 40) + node(605, 650, 40) + node(500, 500, 95)
    const lit = [[0.4, 0.5], [0.9, 0.98]]
    const coreNode = (cx, cy, r) => F.node(cx, cy, r, `<circle cx="${cx}" cy="${cy}" r="${r * 0.34}" fill="${F.coreFill}">${a('fill', once([[0, F.coreFill], [lit[0][0], F.coreFill], [lit[0][0] + 0.02, CRIMSON, 'out'], [lit[0][1], CRIMSON], [lit[0][1] + 0.05, F.coreFill, 'io'], [lit[1][0], F.coreFill], [lit[1][0] + 0.02, CRIMSON, 'out'], [lit[1][1], CRIMSON], [1, F.coreFill, 'io']]))}</circle>`)
    moving += F.trace(keys) + rotateAt(500, 500, lockF(1), outer) + rotateAt(500, 500, lockF(-0.5), inner) + F.trace(legs)
      + coreNode(395, 650, 40) + coreNode(605, 650, 40)
      + scaleAt(500, 500, once([[0, 1], [0.38, 0.94, 'in'], [0.43, 1.06, 'out'], [0.5, 1, 'io'], [0.88, 0.94, 'in'], [0.93, 1.06, 'out'], [1, 1, 'io']]), coreNode(500, 500, 95))
  } else if (id === 'routed-signal') {
    // Routes draw out to their terminals, which pop on arrival; the charge rolls in and settles.
    const routes = [[270, 748, 810, 0.05], [590, 668, 730, 0.17], [770, 748, 810, 0.23]]
    const bus = 'M120 400H880'
    const hook = 'M826 536V600L796 630'
    both(F.guide('M120 160V860M60 480H940'), F.guide('M120 160V860M60 480H940'))
    const term = (cx, cy) => node(cx, cy, 62)
    still += F.heavy(bus) + routes.map(([y, x2, cx]) => F.trace(`M120 ${y}H${x2}`) + term(cx, y)).join('') + F.trace(hook)
      + `<circle cx="500" cy="480" r="20" fill="${F.coreFill}"/>`
    moving += drawn(bus, 0.11, 0.16, 0.84, 0.1, true)
      + routes.map(([y, x2, cx, s]) => drawn(`M120 ${y}H${x2}`, s, 0.14, 0.84, 0.1)
        + popAt(cx, y, s + 0.13, 0.86, F.node(cx, y, 62, `<circle cx="${cx}" cy="${y}" r="${62 * 0.34}" fill="${F.coreFill}">${a('fill', once([[0, F.coreFill], [s + 0.13, CRIMSON], [s + 0.24, F.coreFill, 'io'], [1, F.coreFill]]))}</circle>`))).join('')
      + drawn(hook, 0.4, 0.08, 0.84, 0.08)
      + fade(once([[0, 0], [0.26, 0], [0.28, 1, 'out'], [0.86, 1], [0.94, 0, 'io'], [1, 0]]),
        moveBy(once([[0, '-380 0'], [0.26, '-380 0'], [0.39, '16 0', 'out'], [0.45, '0 0', 'io'], [1, '0 0']]),
          scaleAt(500, 480, once([[0, 1], [0.26, '1.5 .75'], [0.39, '.85 1.15', 'out'], [0.45, 1, 'io'], [1, 1]]),
            `<circle cx="500" cy="480" r="20" fill="${CRIMSON}">${a('fill', once([[0, CRIMSON], [0.5, CRIMSON], [0.6, F.coreFill, 'io'], [1, F.coreFill]]))}</circle>`)))
  }

  const css = '.mark-static{display:none}.motion-still .mark-static{display:inline}.motion-still .motion-layer{display:none}'
    + '@media(prefers-reduced-motion:reduce){svg:not(.motion-opt-in) .mark-static{display:inline}svg:not(.motion-opt-in) .motion-layer{display:none}}'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" class="logo-loop" role="img" aria-label="${title} loading animation" data-logo="${id}" data-finish="${finish}"><title>${title}</title><style>${css}</style><defs>${defs.join('')}</defs><g class="mark-static">${still}</g><g class="motion-layer">${moving}</g></svg>`
}

/** The still mark only, for exporting icons and cards. */
export function renderCircuitStill(id, finish = 'engraved') {
  return renderCircuitMark(id, finish, 6, id).replace('class="logo-loop"', 'class="logo-loop motion-still"')
}

/** The finish the app ships. */
export const CIRCUIT_FINISH = 'drafted'
