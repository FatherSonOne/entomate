// The circuit family, redrawn in vector from Frankie's reference art
// (2026-11-23): the Circuit E (three bars of differing lengths, routed from
// ring nodes on the left) and the circuit hands that hold it. One crimson line,
// one amber for what is live, a soft halo instead of raster glow.
//
//   circuit-e      Circuit E      the E alone, exactly as the reference
//   circuit-spire  Circuit Crown  wireframe hands cup a circuit crown over the E
//   catalyst-core  Node Hands     open hands, fingertips are linked nodes
//   routed-signal  Facet Hands    solid low-poly hands with lit fingertips
//
// The ids are the original four circuit marks', kept so a saved pick still
// resolves; the names shown in the app come from services/logoSystem.ts.
//
// renderCircuitMark(id, finish, duration) returns an SVG string in the same
// 1000-unit box as the illustrated marks. The still mark (.mark-static) shows
// when paused or with reduced motion; the animated copy is .motion-layer.

export const CIRCUIT_MARK_IDS = ['circuit-e', 'circuit-spire', 'catalyst-core', 'routed-signal']
export const CIRCUIT_FINISHES = ['neon']
/** The finish the app ships. */
export const CIRCUIT_FINISH = 'neon'

const EASE = { io: '.65 0 .35 1', out: '.16 1 .3 1', in: '.7 0 .84 0', lin: '0 0 1 1', back: '.34 1.56 .64 1' }

/* Sampled from the references: crimson-pink line, deeper crimson for shade,
   amber-peach for what is lit (fingertips, crown, live nodes). */
const f1 = (n) => Math.round(n * 10) / 10

const C = {
  BG: '#060606',
  LINE: '#FF3B5C',
  MID: '#E02A4E',
  DEEP: '#B5163C',
  SHADE: '#7E0B2A',
  HALO: '#FF1F4B',
  AMBER: '#FFB36E',
  HOT: '#FFE7CB',
  PEACH: '#F6AE82',
  SEAM: '#0A0204',
}

/* The art fills the box edge to edge; the loader shows it at 94vmin with
   status text in the corners, so it is drawn inset. Icons undo the inset
   (see renderCircuitStill). */
const INSET = 0.84
const ICON_BOX = `${f1(500 - 500 * INSET)} ${f1(500 - 500 * INSET)} ${f1(1000 * INSET)} ${f1(1000 * INSET)}`

let instance = 0

/* ── Circuit E geometry ─────────────────────────────────────────────────
   Measured off the reference (1024 px), centred on its own middle. Bars
   start at x -58 and are 48 tall; top and bottom run 185, the middle 165.
   Ring nodes sit at x -113 on each bar's centre line; two routes leave the
   top and bottom nodes at 45° and run to a second ring node at x -12. */
const E_BARS = [[-99, 185], [0, 165], [99, 185]]
const E_BAR_X = -58
const E_BAR_H = 48
const E_NODE_X = -113
const E_STUB_X = -66
const E_ROUTES = [
  { d: 'M-113 -99L-64 -50H-12', end: [-12, -50] },
  { d: 'M-113 99L-64 50H-12', end: [-12, 50] },
]

/* ── Hand geometry ───────────────────────────────────────────────────────
   One left hand, palm facing out, built as a low-poly mesh so the same hand
   can be drawn as wire, as linked nodes or as solid facets. The right hand
   is its mirror. Units are the hand's own (about 340 x 580). */
const K = [[60, 300], [94, 274], [132, 262], [170, 266], [204, 290]] // knuckles, pinky side first
const PALM = { T0: [212, 368], T1: [222, 452], H0: [50, 424], W0: [88, 540], W1: [192, 540], C0: [126, 350], C1: [150, 446] }
const CUFF = { X0: [40, 660], X1: [190, 632] }
const FINGERS = [
  { base: [K[0], K[1]], ang: -103, len: [80, 56, 44] },
  { base: [K[1], K[2]], ang: -95, len: [106, 72, 54] },
  { base: [K[2], K[3]], ang: -88, len: [114, 78, 58] },
  { base: [K[3], K[4]], ang: -80, len: [102, 70, 52] },
  { base: [PALM.T0, PALM.T1], ang: -50, len: [84, 60, 46], thumb: true },
]

const add = (p, q) => [p[0] + q[0], p[1] + q[1]]
const mul = (p, k) => [p[0] * k, p[1] * k]
const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1])
const dir = (deg) => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)]
const leftOf = (deg) => { const [x, y] = dir(deg); return [y, -x] }

/** Build the mesh for a pose. `curl` bends each finger joint toward the centre (degrees). */
function handMesh(curl = 8) {
  const { T0, T1, H0, W0, W1, C0, C1 } = PALM
  const palm = [
    [K[0], K[1], C0], [K[1], K[2], C0], [K[2], K[3], C0], [K[3], K[4], C0], [K[4], T0, C0],
    [K[0], C0, H0], [H0, C0, C1], [C0, T0, C1], [T0, T1, C1], [H0, C1, W0], [C1, T1, W1], [W0, C1, W1],
  ]
  const cuff = [[W0, W1, CUFF.X1], [W0, CUFF.X1, CUFF.X0]]
  const fingers = FINGERS.map((f) => {
    const [L, R] = f.base
    const w0 = dist(L, R) / 2
    const bend = f.thumb ? -curl * 0.6 : curl
    let c = mid(L, R)
    const rows = [[L, R]]
    const taper = [0.86, 0.7, 0.5]
    f.len.forEach((len, i) => {
      const a = f.ang + bend * (i + 0.5)
      c = add(c, mul(dir(a), len))
      const hw = w0 * taper[i]
      const lo = leftOf(a)
      rows.push([add(c, mul(lo, hw)), add(c, mul(lo, -hw))])
    })
    const tip = c
    const tris = []
    for (let i = 0; i < rows.length - 2; i++) {
      const [a, b] = rows[i]
      const [d, e] = rows[i + 1]
      if (i % 2 === 0) tris.push([a, b, e], [a, e, d])
      else tris.push([a, b, d], [b, e, d])
    }
    const [l2, r2] = rows[rows.length - 2]
    const [l3, r3] = rows[rows.length - 1]
    const nail = [[l2, r2, r3], [l2, r3, l3]]
    return { tris, nail, all: [...tris, ...nail], tip, pivot: mid(L, R) }
  })
  return { palm, cuff, fingers }
}

const pts = (tri) => tri.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ')
const edgeKey = (p, q) => { const a = `${f1(p[0])},${f1(p[1])}`; const b = `${f1(q[0])},${f1(q[1])}`; return a < b ? `${a}|${b}` : `${b}|${a}` }
/** Unique edges of a set of triangles, in the order first met. */
function edgesOf(tris) {
  const seen = new Map()
  tris.forEach((t) => [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]].forEach(([p, q]) => { const k = edgeKey(p, q); if (!seen.has(k)) seen.set(k, [p, q]) }))
  return [...seen.values()]
}
const centroid = (t) => [(t[0][0] + t[1][0] + t[2][0]) / 3, (t[0][1] + t[1][1] + t[2][1]) / 3]

export function renderCircuitMark(id, finish = CIRCUIT_FINISH, duration = 6, title = id) {
  const uid = `en-cm-${id}-${++instance}`
  const D = duration
  const defs = []

  /* ── timing ─────────────────────────────────────────────────────────── */
  const timing = (f) => `keyTimes="${f.map(([t]) => f1(t * 1000) / 1000).join(';')}" calcMode="spline" keySplines="${f.slice(1).map(([, , e]) => EASE[e || 'io']).join(';')}"`
  const loop = `dur="${D}s" repeatCount="indefinite"`
  const a = (attr, f) => `<animate attributeName="${attr}" values="${f.map(([, v]) => v).join(';')}" ${timing(f)} ${loop}/>`
  const at = (type, f, fmt = (v) => v) => `<animateTransform attributeName="transform" type="${type}" values="${f.map(([, v]) => fmt(v)).join(';')}" ${timing(f)} ${loop} additive="sum"/>`
  /** keep keyframes strictly increasing in time */
  const once = (f) => f.filter((x, i) => i === f.length - 1 || x[0] < f[i + 1][0])
  const scaleAt = (cx, cy, f, inner) => `<g transform="translate(${f1(cx)} ${f1(cy)})"><g>${at('scale', f)}<g transform="translate(${f1(-cx)} ${f1(-cy)})">${inner}</g></g></g>`
  const rotateAt = (cx, cy, f, inner) => `<g>${at('rotate', f, (v) => `${v} ${f1(cx)} ${f1(cy)}`)}${inner}</g>`
  const moveBy = (f, inner) => `<g>${at('translate', f)}${inner}</g>`
  const fade = (f, inner) => `<g opacity="${f[0][1]}">${a('opacity', f)}${inner}</g>`
  /** Visible from s (ramping in over `rin`) until e (ramping out over `rout`). */
  const visible = (s, e, rin = 0.04, rout = 0.06) => once([[0, 0], [s, 0], [s + rin, 1, 'out'], [e, 1], [e + rout, 0, 'in'], [1, 0]])
  /** 0→1 scale pop at s, gone at e. */
  const popF = (s, e, over = 0.05) => once([[0, 0.001], [s, 0.001], [s + over, 1.12, 'out'], [s + over * 1.8, 1, 'io'], [e, 1], [e + 0.06, 0.001, 'in'], [1, 0.001]])
  const popAt = (cx, cy, s, e, inner, over) => scaleAt(cx, cy, popF(s, e, over), inner)
  /** A stroke that draws itself over [s, s+dur] and erases over [e, e+edur]. */
  const drawF = (s, dur, e, edur, ease = 'out') => once([[0, 1], [s, 1], [s + dur, 0, ease], [e, 0], [e + edur, -1, 'in'], [1, -1]])
  const drawAttrs = () => ` pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"`
  /** A ring of light that leaves a point at share t and fades as it grows. */
  const flash = (cx, cy, r0, r1, t, len = 0.12, w = 6, color = C.AMBER) => `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${r0}" fill="none" stroke="${color}" stroke-width="${w}" opacity="0">${a('r', once([[0, r0], [t, r0], [t + len, r1, 'out'], [1, r1]]))}${a('opacity', once([[0, 0], [t, 0], [t + 0.005, 0.85, 'lin'], [t + len, 0, 'out'], [1, 0]]))}</circle>`
  /** A neon strike: the line stutters as it catches, then holds. */
  const strike = (t, inner) => fade(once([[0, 1], [t, 1], [t + 0.008, 0.35, 'lin'], [t + 0.018, 1, 'lin'], [t + 0.026, 0.6, 'lin'], [t + 0.04, 1, 'lin'], [1, 1]]), inner)

  /* ── line styles ────────────────────────────────────────────────────── */
  /** A lit line: soft halo, crimson body, faint hot core. */
  const line = (d, w, extra = '', inner = '', color = C.LINE, halo = true) => (halo ? `<path data-halo="1" d="${d}" fill="none" stroke="${C.HALO}" stroke-opacity=".16" stroke-width="${f1(w * 3)}" stroke-linecap="round" stroke-linejoin="round"${extra}>${inner}</path>` : '')
    + `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}>${inner}</path>`
  const segD = ([p, q]) => `M${f1(p[0])} ${f1(p[1])}L${f1(q[0])} ${f1(q[1])}`

  /* ── Circuit E (local units, centred) ───────────────────────────────── */
  defs.push(
    `<linearGradient id="${uid}-bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF5470"/><stop offset=".5" stop-color="${C.LINE}"/><stop offset="1" stop-color="#E52C51"/></linearGradient>`,
    `<filter id="${uid}-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>`,
    `<radialGradient id="${uid}-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${C.HALO}" stop-opacity=".55"/><stop offset=".45" stop-color="${C.HALO}" stop-opacity=".16"/><stop offset="1" stop-color="${C.HALO}" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="${uid}-amber" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${C.AMBER}" stop-opacity=".7"/><stop offset=".4" stop-color="${C.AMBER}" stop-opacity=".22"/><stop offset="1" stop-color="${C.AMBER}" stop-opacity="0"/></radialGradient>`,
  )
  const eBar = ([cy, w]) => `<rect data-halo="1" x="${E_BAR_X}" y="${cy - E_BAR_H / 2}" width="${w}" height="${E_BAR_H}" fill="${C.HALO}" opacity=".55" filter="url(#${uid}-soft)"/>`
    + `<rect x="${E_BAR_X}" y="${cy - E_BAR_H / 2}" width="${w}" height="${E_BAR_H}" rx="2" fill="url(#${uid}-bar)"/>`
  const eTrace = (d, extra = '', inner = '') => `<path data-halo="1" d="${d}" fill="none" stroke="${C.HALO}" stroke-opacity=".5" stroke-width="12" filter="url(#${uid}-soft)"${extra}>${inner}</path>`
    + `<path d="${d}" fill="none" stroke="${C.LINE}" stroke-width="8" stroke-linejoin="miter"${extra}>${inner}</path>`
  /** A ring node; `live` = [on, off] shares when its ring burns amber. */
  const eNode = (cx, cy, live) => {
    const stroke = live ? `${a('stroke', once([[0, C.LINE], [live[0], C.LINE], [live[0] + 0.02, C.AMBER, 'out'], [live[1], C.AMBER], [live[1] + 0.08, C.LINE, 'io'], [1, C.LINE]]))}` : ''
    return `<circle data-halo="1" cx="${cx}" cy="${cy}" r="14" fill="${C.HALO}" opacity=".5" filter="url(#${uid}-soft)"/><circle cx="${cx}" cy="${cy}" r="10" fill="${C.BG}" stroke="${C.LINE}" stroke-width="8">${stroke}</circle>`
  }
  const eStill = () => E_BARS.map(eBar).join('')
    + E_BARS.map(([cy]) => eTrace(`M${E_NODE_X} ${cy}H${E_STUB_X}`)).join('')
    + E_ROUTES.map((r) => eTrace(r.d)).join('')
    + E_BARS.map(([cy]) => eNode(E_NODE_X, cy)).join('')
    + E_ROUTES.map((r) => eNode(r.end[0], r.end[1])).join('')
  /**
   * The E builds row by row from t0 over `span` (shares of the loop): each
   * node pops and burns, its stub draws, its bar strikes on from the stub;
   * the routes draw down to their second node. It all retracts from `out`.
   */
  const eMoving = (t0, span, out) => {
    const k = span / 3
    let s = ''
    E_BARS.forEach(([cy, w], i) => {
      const t = t0 + i * k
      const o = out + i * 0.02
      const clip = `${uid}-eb${i}`
      defs.push(`<clipPath id="${clip}"><rect x="${E_BAR_X - 8}" y="${cy - 40}" width="0" height="80">${a('width', once([[0, 0], [t + 0.05, 0], [t + 0.05 + k * 0.9, w + 16, 'out'], [o, w + 16], [o + 0.08, 0, 'in'], [1, 0]]))}</rect></clipPath>`)
      s += strike(t + 0.05 + k * 0.9, `<g clip-path="url(#${clip})">${eBar([cy, w])}</g>`)
      s += eTrace(`M${E_NODE_X} ${cy}H${E_STUB_X}`, drawAttrs(), a('stroke-dashoffset', drawF(t + 0.02, 0.04, o, 0.05)))
    })
    E_ROUTES.forEach((r, i) => {
      const t = t0 + (i === 0 ? 0 : 2 * k) + k * 0.5
      const o = out + (i === 0 ? 0 : 0.04)
      s += eTrace(r.d, drawAttrs(), a('stroke-dashoffset', drawF(t, k * 0.7, o, 0.06)))
      s += popAt(r.end[0], r.end[1], t + k * 0.62, o + 0.04, eNode(r.end[0], r.end[1], [t + k * 0.66, t + k * 1.4]), 0.04)
      s += flash(r.end[0], r.end[1], 10, 46, t + k * 0.66, 0.1, 3)
    })
    E_BARS.forEach(([cy], i) => {
      const t = t0 + i * k
      s += popAt(E_NODE_X, cy, t, out + 0.06 + i * 0.02, eNode(E_NODE_X, cy, [t + 0.02, t + 0.12]), 0.04)
      s += flash(E_NODE_X, cy, 10, 52, t + 0.02, 0.1, 3)
    })
    return s
  }
  const place = (cx, cy, scale, inner) => `<g transform="translate(${cx} ${cy}) scale(${scale})">${inner}</g>`

  /* ── hands ──────────────────────────────────────────────────────────── */
  /** Left hand at (tx, ty) and `scale`, plus its mirror about x = 500. */
  const pair = (tx, ty, scale, rot, inner) => {
    const leftT = `translate(${tx} ${ty}) scale(${scale}) rotate(${rot} 150 560)`
    return `<g transform="${leftT}">${inner('L')}</g><g transform="translate(1000 0) scale(-1 1)"><g transform="${leftT}">${inner('R')}</g></g>`
  }
  /** A hand's entrance: it rises from the wrist and opens. */
  const handRise = (s, e, inner) => moveBy(once([[0, '0 70'], [s, '0 70'], [s + 0.16, '0 0', 'out'], [e, '0 0'], [e + 0.1, '0 40', 'in'], [1, '0 70']]),
    rotateAt(150, 560, once([[0, -6], [s, -6], [s + 0.2, 0, 'out'], [0.5, 0], [0.63, 2.5], [0.76, -1], [e, 0], [1, 0]]), inner))
  /** A finger's flex about its knuckle. */
  const flex = (pivot, f, inner) => rotateAt(pivot[0], pivot[1], f, inner)
  const breathe = (amp, s, e, ph = 0) => once([[0, 0], [s + ph, 0], [s + ph + (e - s) * 0.35, amp], [s + ph + (e - s) * 0.7, -amp * 0.4], [e, 0], [1, 0]])

  let still = ''
  let moving = ''

  if (id === 'circuit-e') {
    const S = 3.05
    still = place(500, 500, S, eStill())
    moving = `<circle cx="500" cy="500" r="430" fill="url(#${uid}-glow)" opacity="0">${a('opacity', visible(0.3, 0.8, 0.12, 0.1).map(([t, v, e]) => [t, f1(v * 0.5), e]))}</circle>`
      + place(500, 500, S, eMoving(0.04, 0.42, 0.82))
  } else {
    const wire = id === 'circuit-spire'
    const nodes = id === 'catalyst-core'
    const facets = id === 'routed-signal'
    const mesh = handMesh(wire ? 16 : 6)
    const pose = wire ? { tx: 40, ty: 120, scale: 1.12, rot: 8 } : { tx: 22, ty: 56, scale: 1.14, rot: -3 }
    const eAt = wire ? { x: 500, y: 735, s: 0.78 } : { x: 500, y: 580, s: 0.92 }

    // Draw one hand (side L or R) still, or animated with timing for that side.
    const drawHand = (side, animated) => {
      const sh = side === 'R' ? 0.02 : 0
      const shade = (t, i) => {
        // light from above-right: lighter facets face up
        const [p, q, r] = t
        const n = ((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]))
        const tone = [C.LINE, C.MID, C.DEEP, C.MID, C.SHADE, C.DEEP][(i + (n > 0 ? 0 : 3)) % 6]
        return tone
      }
      const facet = (t, i, s, e) => {
        const poly = `<polygon points="${pts(t)}" fill="${shade(t, i)}" stroke="${C.SEAM}" stroke-width="2.4" stroke-linejoin="round"/>`
        if (!animated) return poly
        const [cx, cy] = centroid(t)
        return popAt(cx, cy, s, e, poly, 0.05)
      }
      const cuff = (animated) => mesh.cuff.map((t, i) => {
        const poly = `<polygon points="${pts(t)}" fill="${i ? C.LINE : C.DEEP}" stroke="${facets ? C.SEAM : 'none'}" stroke-width="2"/>`
        return animated ? popAt(...centroid(t), 0.02 + sh + i * 0.02, 0.86, poly, 0.06) : poly
      }).join('')
      const edgeLines = (tris, s0, s1, e) => {
        const edges = edgesOf(tris)
        return edges.map((ed, i) => {
          if (!animated) return line(segD(ed), 4.5, '', '', C.LINE, false)
          const s = s0 + (s1 - s0) * (i / Math.max(1, edges.length - 1))
          return line(segD(ed), 4.5, drawAttrs(), a('stroke-dashoffset', drawF(s, 0.06, e, 0.06)), C.LINE, false)
        }).join('')
      }
      const tipNode = (p, i, s) => {
        const [x, y] = p
        const lit = `<circle cx="${f1(x)}" cy="${f1(y)}" r="40" fill="url(#${uid}-amber)"/><circle cx="${f1(x)}" cy="${f1(y)}" r="13" fill="${C.AMBER}"/><circle cx="${f1(x - 3)}" cy="${f1(y - 3)}" r="5" fill="${C.HOT}"/>`
        if (!animated) return lit
        return popAt(x, y, s, 0.84, lit, 0.04) + flash(x, y, 13, 60, s + 0.01, 0.1, 3)
      }
      let out = ''
      if (facets) {
        out += cuff(animated)
        const palmS = 0.06 + sh
        out += mesh.palm.map((t, i) => facet(t, i, palmS + (1 - centroid(t)[1] / 560) * 0.1, 0.86)).join('')
        mesh.fingers.forEach((f, fi) => {
          const base = 0.18 + sh + fi * 0.025
          const nailPoly = `<polygon points="${pts([f.nail[0][0], f.nail[0][1], f.nail[0][2], f.nail[1][2]])}" fill="${C.AMBER}" stroke="${C.SEAM}" stroke-width="2.4" stroke-linejoin="round"/>`
          const glow = `<circle cx="${f1(f.tip[0])}" cy="${f1(f.tip[1])}" r="46" fill="url(#${uid}-amber)"/>`
          let g = f.tris.map((t, i) => facet(t, i + fi, base + i * 0.03, 0.86)).join('')
          g += animated
            ? fade(visible(base + 0.16, 0.84, 0.06, 0.06), glow) + popAt(...centroid(f.nail[0]), base + 0.12, 0.86, nailPoly, 0.04)
            : glow + nailPoly
          if (animated) g = flex(f.pivot, breathe(fi === 4 ? -4 : 3, 0.46, 0.8, fi * 0.015), g)
          out += g
        })
      } else {
        out += cuff(animated)
        out += edgeLines(mesh.palm, 0.04 + sh, 0.16 + sh, 0.84)
        mesh.fingers.forEach((f, fi) => {
          const s0 = 0.14 + sh + fi * 0.02
          let g = edgeLines(f.all, s0, s0 + 0.12, 0.84)
          if (nodes) g += tipNode(f.tip, fi, s0 + 0.14)
          if (animated) g = flex(f.pivot, breathe(fi === 4 ? -4 : 3, 0.46, 0.8, fi * 0.015), g)
          out += g
        })
        if (nodes) {
          // constellation links between neighbouring fingertips
          const tips = mesh.fingers.map((f) => f.tip)
          const links = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 2], [1, 3]]
          out += links.map(([i, j], li) => {
            const d = segD([tips[i], tips[j]])
            const el = `<path d="${d}" fill="none" stroke="${C.PEACH}" stroke-opacity=".55" stroke-width="2"${animated ? drawAttrs() : ''}>${animated ? a('stroke-dashoffset', drawF(0.36 + sh + li * 0.02, 0.06, 0.82, 0.05)) : ''}</path>`
            return el
          }).join('')
        }
      }
      return animated ? handRise(0.02 + sh, 0.84, out) : out
    }

    const crown = (animated) => {
      // The circuit crown from the reference: a node on a stem over a diamond,
      // two side nodes routed down into a V, all in peach.
      const P = C.PEACH
      const ring = (x, y, r, s) => {
        const el = `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.BG}" stroke="${P}" stroke-width="6"/>`
        return animated ? popAt(x, y, s, 0.84, el, 0.04) + flash(x, y, r, r * 3, s + 0.01, 0.1, 3) : el
      }
      const tr = (d, s, dur = 0.06) => `<path d="${d}" fill="none" stroke="${P}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"${animated ? drawAttrs() : ''}>${animated ? a('stroke-dashoffset', drawF(s, dur, 0.82, 0.05)) : ''}</path>`
      // reference units (px of the 1024 art), placed over the hands
      const g = tr('M512 390V355', 0.3, 0.04) + tr('M512 355L497 341V331L512 318L527 331V341Z', 0.33, 0.07) + tr('M512 318V302', 0.4, 0.03)
        + tr('M477 327V338L498 359V386M484 375L498 386', 0.36, 0.07) + tr('M547 327V338L526 359V386M540 375L526 386', 0.36, 0.07)
        + ring(512, 293, 9, 0.43) + ring(477, 318, 9, 0.42) + ring(547, 318, 9, 0.42) + ring(478, 368, 8.5, 0.4) + ring(546, 368, 8.5, 0.4)
      const glow = `<circle cx="512" cy="340" r="64" fill="url(#${uid}-glow)"/>`
      const inner = animated ? fade(visible(0.4, 0.82, 0.1, 0.08), glow) + g : glow + g
      return `<g transform="translate(500 228) scale(2.35) translate(-512 -340)">${inner}</g>`
    }

    still = pair(pose.tx, pose.ty, pose.scale, pose.rot, (side) => drawHand(side, false))
      + (wire ? crown(false) : '')
      + place(eAt.x, eAt.y, eAt.s, eStill())
    moving = pair(pose.tx, pose.ty, pose.scale, pose.rot, (side) => drawHand(side, true))
      + (wire ? crown(true) : '')
      + place(eAt.x, eAt.y, eAt.s, eMoving(wire ? 0.5 : 0.44, 0.24, 0.84))
  }

  const css = '.mark-static{display:none}.motion-still .mark-static{display:inline}.motion-still .motion-layer{display:none}'
    + '@media(prefers-reduced-motion:reduce){svg:not(.motion-opt-in) .mark-static{display:inline}svg:not(.motion-opt-in) .motion-layer{display:none}}'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" class="logo-loop" role="img" aria-label="${title} loading animation" data-logo="${id}" data-finish="${finish}"><title>${title}</title><style>${css}</style><defs>${defs.join('')}</defs><g transform="translate(500 500) scale(${INSET}) translate(-500 -500)"><g class="mark-static">${still}</g><g class="motion-layer">${moving}</g></g></svg>`
}

/** The still mark only, cropped back to the art (no loader inset), for exporting icons and cards. */
export function renderCircuitStill(id, finish = CIRCUIT_FINISH) {
  return renderCircuitMark(id, finish, 6, id).replace('viewBox="0 0 1000 1000" class="logo-loop"', `viewBox="${ICON_BOX}" class="logo-loop motion-still"`)
}
