// Vector redraws of the four circuit marks (Circuit E, Circuit Spire,
// Catalyst Core, Routed Signal), 2026-11-22. Four finishes share one geometry
// and one choreography. Neon (shipped) keeps the original marks' lit red
// tubes and glossy metal, drawn clean; engraved, machined and drafted are
// calmer alternates. One colour (CRIMSON in the palette) marks what is live.
//
// renderCircuitMark(id, finish, duration) returns an SVG string in the same
// 1000-unit box as the illustrated marks. The still mark (.mark-static) shows
// when paused or with reduced motion; the animated copy is .motion-layer.

export const CIRCUIT_MARK_IDS = ['circuit-e', 'circuit-spire', 'catalyst-core', 'routed-signal']
export const CIRCUIT_FINISHES = ['neon', 'engraved', 'machined', 'drafted']

const EASE = { io: '.65 0 .35 1', out: '.16 1 .3 1', in: '.7 0 .84 0', lin: '0 0 1 1' }
/* Engraved and Machined are neutral with a crimson live point. Drafted carries
   the original marks' warm colour as flat ink: vermilion line, copper weight,
   oxblood construction, cream cores, amber for what is live. */
const PALETTES = {
  neutral: { BG: '#060606', INK: '#E9E9E4', MUT: '#6E6E69', CRIMSON: '#FF2D6B', COPPER: '#E9E9E4', DEEP: '#060606', CREAM: '#E9E9E4' },
  // Neon: the original marks' lit-tube look, rebuilt clean. Red tubes with a hot core and a soft halo, glossy red metal, copper rims, teal pads on the spire, gold for what is live.
  neon: { BG: '#060606', INK: '#FF3B24', MUT: '#7A0E08', CRIMSON: '#FFD36B', COPPER: '#F08A50', DEEP: '#2A0403', CREAM: '#FF9A78' },
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
  if (finish === 'neon') defs.push(
    `<linearGradient id="${uid}-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF7A55"/><stop offset=".16" stop-color="#F0301C"/><stop offset=".55" stop-color="#A8130B"/><stop offset="1" stop-color="#4A0504"/></linearGradient>`,
    `<linearGradient id="${uid}-redv" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4A0504"/><stop offset=".4" stop-color="#C21A0F"/><stop offset=".62" stop-color="#FF5A3A"/><stop offset="1" stop-color="#6A0705"/></linearGradient>`,
    `<radialGradient id="${uid}-orb" cx=".36" cy=".3" r=".75"><stop offset="0" stop-color="#FFC4AA"/><stop offset=".22" stop-color="#FF4A2C"/><stop offset=".6" stop-color="#9E0F08"/><stop offset="1" stop-color="#2A0302"/></radialGradient>`,
  )
  const HALO = '#FF1E0A'
  const HOT = '#FFE2D4'
  const TEAL = '#46E0CC'
  /** A lit tube: soft halo, coloured body, hot core. `extra`/`inner` go on every layer so draw-on animations stay in step. */
  const tube = (d, w, extra = '', inner = '', color = INK) => [
    `<path data-halo="1" d="${d}" fill="none" stroke="${HALO}" stroke-opacity=".2" stroke-width="${w * 3.4}" stroke-linecap="round" stroke-linejoin="round"${extra}>${inner}</path>`,
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}>${inner}</path>`,
    `<path data-halo="1" d="${d}" fill="none" stroke="${HOT}" stroke-opacity=".8" stroke-width="${w * 0.32}" stroke-linecap="round" stroke-linejoin="round"${extra}>${inner}</path>`,
  ].join('')
  const ringTube = (cx, cy, r, w, dash = '', color = INK) => tube(`M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`, w, dash ? ` stroke-dasharray="${dash}"` : '', '', color)
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
    neon: {
      body: (x, y, w, h, r = 6) => (w > h
        ? `<rect data-halo="1" x="${x - 4}" y="${y - 4}" width="${w + 8}" height="${h + 8}" rx="${r + 4}" fill="none" stroke="${HALO}" stroke-opacity=".22" stroke-width="10"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#${uid}-red)" stroke="#FF6A48" stroke-width="2"/><rect x="${x + 10}" y="${y + 7}" width="${Math.max(0, w - 20)}" height="3" rx="1.5" fill="${HOT}" opacity=".75"/><rect x="${x + 10}" y="${y + h - 12}" width="${Math.max(0, w - 20)}" height="1.5" fill="#FF6A48" opacity=".5"/>`
        : `<rect data-halo="1" x="${x - 4}" y="${y - 4}" width="${w + 8}" height="${h + 8}" rx="${r + 4}" fill="none" stroke="${HALO}" stroke-opacity=".22" stroke-width="10"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#${uid}-redv)" stroke="#FF6A48" stroke-width="2"/><rect x="${x + w * 0.56}" y="${y + r}" width="3" height="${Math.max(0, h - 2 * r)}" fill="${HOT}" opacity=".6"/>`),
      trace: (d, extra = '', inner = '') => tube(d, 5, extra, inner),
      heavy: (d, extra = '', inner = '') => tube(d, 9, extra, inner, id === 'circuit-spire' ? COPPER : INK),
      node: (cx, cy, r, core) => `<circle data-halo="1" cx="${cx}" cy="${cy}" r="${r + 6}" fill="none" stroke="${HALO}" stroke-opacity=".25" stroke-width="14"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${uid}-orb)" stroke="${COPPER}" stroke-width="${Math.max(2.5, r * 0.09)}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.62}" fill="none" stroke="#FF6A48" stroke-opacity=".55" stroke-width="1.5"/>${core}<ellipse cx="${cx - r * 0.3}" cy="${cy - r * 0.36}" rx="${r * 0.22}" ry="${r * 0.12}" transform="rotate(-30 ${cx - r * 0.3} ${cy - r * 0.36})" fill="#FFF1EA" opacity=".7"/>`,
      coreFill: CREAM,
      pad: (cx, cy, r = 8) => `<circle data-halo="1" cx="${cx}" cy="${cy}" r="${r + 5}" fill="${id === 'circuit-spire' ? TEAL : HALO}" opacity=".18"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${BG}" stroke="${id === 'circuit-spire' ? TEAL : COPPER}" stroke-width="3"/>`,
      ring: (cx, cy, r, kind) => kind === 'dash' ? ringTube(cx, cy, r, 4, '38 18', '#E2281A')
        : kind === 'fine' ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${MUT}" stroke-width="2"/>`
          : ringTube(cx, cy, r, 7),
      band: (cx, cy, r, w) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${DEEP}" stroke-width="${w}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#7A0E08" stroke-width="${w * 0.3}" stroke-dasharray="3 9"/>` + ringTube(cx, cy, r + w / 2, 4) + ringTube(cx, cy, r - w / 2, 3, '', COPPER),
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
  const drawn = (d, s, dur, e, edur, heavy = false, reverseErase = false, ease = 'out') => {
    const f = once([[0, 1], [s, 1], [s + dur, 0, ease], [e, 0], [e + edur, reverseErase ? -1 : 1, 'in'], [1, reverseErase ? -1 : 1]])
    return (heavy ? F.heavy : F.trace)(d, ' pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"', a('stroke-dashoffset', f))
  }
  /** A ring of light that leaves a point at share t and fades as it grows. */
  const flash = (cx, cy, r0, r1, t, len = 0.12, w = 6) => `<circle cx="${cx}" cy="${cy}" r="${r0}" fill="none" stroke="${CRIMSON}" stroke-width="${w}" opacity="0">${a('r', once([[0, r0], [t, r0], [t + len, r1, 'out'], [1, r1]]))}${a('opacity', once([[0, 0], [t, 0], [t + 0.005, 0.85, 'lin'], [t + len, 0, 'out'], [1, 0]]))}</circle>`
  /** A neon strike: the tube stutters as it catches, then holds. */
  const strike = (t, inner) => fade(once([[0, 1], [t, 1], [t + 0.008, 0.3, 'lin'], [t + 0.018, 1, 'lin'], [t + 0.026, 0.55, 'lin'], [t + 0.04, 1, 'lin'], [1, 1]]), inner)
  /** The live point: a hot orb with a halo. */
  const orb = (r, extra = '') => `<g${extra}><circle r="${r * 2.4}" fill="${CRIMSON}" opacity=".18"/><circle r="${r * 1.5}" fill="${CRIMSON}" opacity=".35"/><circle r="${r}" fill="${CRIMSON}"/><circle r="${r * 0.45}" fill="#FFF6E0"/></g>`
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
      return strike(s + 0.11, revealX(234, y - 6, w + 60, 100, once([[0, 0], [s, 0], [s + 0.11, 1, 'out'], [out, 1], [out + 0.1, 0, 'in'], [1, 0]]), moveBy(slide, F.body(262, y, w, 88, 4))))
    }).join('')
      + spine + drawn(traceD, 0.36, 0.12, 0.8, 0.08) + popAt(560, 385, 0.46, 0.8, F.pad(560, 385))
      + nodes.map((y, i) => node(200, y, 58, [0.04 + i * 0.1, 0.16 + i * 0.1]) + flash(200, y, 58, 120, 0.05 + i * 0.1, 0.1, 4)).join('') + node(200, 345, 24, [0.36, 0.5])
      + flash(560, 385, 8, 60, 0.5, 0.1, 3)
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
    const trunkLen = 180 + 42.4 + 170 + 84.9 + 180 + 42.4 + 220
    const along = (y) => { // share of the trunk's length below height y
      const segs = [[940, 760, 180], [760, 730, 42.4], [730, 560, 170], [560, 500, 84.9], [500, 320, 180], [320, 290, 42.4], [290, 70, 220]]
      let run = 0
      for (const [y0, y1, len] of segs) { if (y <= y1) { run += len; continue } return (run + len * (y0 - y) / (y0 - y1)) / trunkLen }
      return 1
    }
    const edge = (y) => 0.04 + 0.41 * along(y)
    moving += drawn(trunk, 0.04, 0.41, 0.82, 0.12, true, true, 'lin')
      + br.map((b) => {
        const { d, end } = branch(b)
        const s = edge(b[0])
        return drawn(d, s, 0.08, 0.8, 0.1) + popAt(end[0], end[1], s + 0.07, 0.8, F.pad(end[0], end[1], 7))
      }).join('')
      + parts.map(([x, y, r]) => popAt(x, y, edge(y) + 0.04, 0.8, node(x, y, r, [edge(y) + 0.04, edge(y) + 0.14]))).join('')
      + popAt(500, 940, 0.02, 0.86, F.pad(500, 940, 11)) + popAt(500, 70, 0.44, 0.84, F.pad(500, 70, 9))
      // the live edge: a crimson head that rides the trunk as it builds
      + fade(once([[0, 0], [0.04, 1], [0.44, 1], [0.48, 0, 'out'], [1, 0]]),
        `<g>${orb(10)}<animateMotion path="${trunk}" keyPoints="0;0;1;1" keyTimes="0;.04;.45;1" calcMode="linear" ${loop}/></g>`)
      + flash(500, 70, 9, 150, 0.45, 0.14, 5) + flash(500, 70, 9, 90, 0.47, 0.1, 3)
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
      + flash(500, 500, 95, 440, 0.42, 0.16, 8) + flash(500, 500, 95, 440, 0.92, 0.08, 8)
      + scaleAt(500, 500, once([[0, 1], [0.38, 0.94, 'in'], [0.43, 1.06, 'out'], [0.5, 1, 'io'], [0.88, 0.94, 'in'], [0.93, 1.06, 'out'], [1, 1, 'io']]), coreNode(500, 500, 95))
  } else if (id === 'routed-signal') {
    // Routes draw out to their terminals, which pop on arrival; the charge rolls in and settles.
    const routes = [[270, 748, 810, 0.05], [590, 668, 730, 0.17], [770, 748, 810, 0.23]]
    const bus = 'M120 400H880'
    const hook = 'M826 536V600L796 630'
    both(F.guide('M120 160V860M60 480H940'), F.guide('M120 160V860M60 480H940'))
    const term = (cx, cy) => node(cx, cy, 62)
    still += F.heavy(bus) + routes.map(([y, x2, cx]) => F.trace(`M120 ${y}H${x2}`) + term(cx, y)).join('') + F.trace(hook)
      + orb(16, ' transform="translate(500 480)"')
    moving += drawn(bus, 0.11, 0.16, 0.84, 0.1, true)
      + routes.map(([y, x2, cx, s]) => drawn(`M120 ${y}H${x2}`, s, 0.14, 0.84, 0.1)
        + flash(cx, y, 62, 130, s + 0.13, 0.1, 4) + popAt(cx, y, s + 0.13, 0.86, F.node(cx, y, 62, `<circle cx="${cx}" cy="${y}" r="${62 * 0.34}" fill="${F.coreFill}">${a('fill', once([[0, F.coreFill], [s + 0.13, CRIMSON], [s + 0.24, F.coreFill, 'io'], [1, F.coreFill]]))}</circle>`))).join('')
      + drawn(hook, 0.4, 0.08, 0.84, 0.08)
      + fade(once([[0, 0], [0.26, 0], [0.28, 1, 'out'], [0.86, 1], [0.94, 0, 'io'], [1, 0]]),
        moveBy(once([[0, '-380 0'], [0.26, '-380 0'], [0.39, '16 0', 'out'], [0.45, '0 0', 'io'], [1, '0 0']]),
          scaleAt(500, 480, once([[0, 1], [0.26, '1.5 .75'], [0.39, '.85 1.15', 'out'], [0.45, 1, 'io'], [1, 1]]),
            orb(16, ' transform="translate(500 480)"'))))
      + flash(500, 480, 16, 110, 0.4, 0.12, 4)
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
export const CIRCUIT_FINISH = 'neon'
