// The circuit family, redrawn in vector from Frankie's reference art
// (2026-11-23): the Circuit E (three bars of differing lengths, routed from
// ring nodes on the left) and the circuit hands that hold it. One crimson line,
// one amber for what is live, a soft halo instead of raster glow.
//
//   circuit-e      Circuit E      the E alone, exactly as the reference
//   circuit-spire  Circuit Crown  wireframe hands cup a circuit crown over the E
//   catalyst-core  Node Hands     direct port of the wire hands with linked fingertip nodes
//   routed-signal  Facet Hands    direct port of the solid low-poly hands (three bars, not four)
//
// The ids are the original four circuit marks', kept so a saved pick still
// resolves; the names shown in the app come from services/logoSystem.ts.
//
// renderCircuitMark(id, finish, duration) returns an SVG string in the same
// 1000-unit box as the illustrated marks. The still mark (.mark-static) shows
// when paused or with reduced motion. Circuit E and Circuit Crown animate
// directly over their resting marks.

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
  HALO: '#FF1F4B',
  AMBER: '#FFB36E',
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

/* ── Circuit Crown geometry ──────────────────────────────────────────────
   One left hand, palm facing out. The right hand is its mirror.
   The triangulated mesh keeps the same edges as the fingers flex. */
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
function handMesh(curl = 8, thumbBend = -curl * 0.6) {
  const { T0, T1, H0, W0, W1, C0, C1 } = PALM
  const palm = [
    [K[0], K[1], C0], [K[1], K[2], C0], [K[2], K[3], C0], [K[3], K[4], C0], [K[4], T0, C0],
    [K[0], C0, H0], [H0, C0, C1], [C0, T0, C1], [T0, T1, C1], [H0, C1, W0], [C1, T1, W1], [W0, C1, W1],
  ]
  const cuff = [[W0, W1, CUFF.X1], [W0, CUFF.X1, CUFF.X0]]
  const fingers = FINGERS.map((f) => {
    const [L, R] = f.base
    const w0 = dist(L, R) / 2
    const bend = f.thumb ? thumbBend : curl
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
    const tris = []
    for (let i = 0; i < rows.length - 2; i++) {
      const [a, b] = rows[i]
      const [d, e] = rows[i + 1]
      if (i % 2 === 0) tris.push([a, b, e], [a, e, d])
      else tris.push([a, b, d], [b, e, d])
    }
    const [l2, r2] = rows[rows.length - 2]
    const [l3, r3] = rows[rows.length - 1]
    return { tris: [...tris, [l2, r2, r3], [l2, r3, l3]] }
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
const meshPath = ({ palm, fingers }) => [palm, ...fingers.map(({ tris }) => tris)]
  .flatMap(edgesOf)
  .map(([[x, y], [xx, yy]]) => `M${f1(x)} ${f1(y)}L${f1(xx)} ${f1(yy)}`)
  .join('')

const CROWN_POSE = 'translate(40 120) scale(1.12) rotate(8 150 560)'
const CROWN_ROUTES = [
  'M512 390V355',
  'M512 355L497 341V331L512 318L527 331V341Z',
  'M512 318V302',
  'M477 327V338L498 359V386M484 375L498 386',
  'M547 327V338L526 359V386M540 375L526 386',
]
const CROWN_NODES = [[512, 293, 9], [477, 318, 9], [547, 318, 9], [478, 368, 8.5], [546, 368, 8.5]]

function renderCrown(uid, defs, emblem) {
  const rest = handMesh(16)
  const reach = handMesh(18)
  const release = handMesh(14.6)
  const restPath = meshPath(rest)
  const reachPath = meshPath(reach)
  const releasePath = meshPath(release)
  defs.push(
    `<linearGradient id="${uid}-wire" gradientUnits="userSpaceOnUse" x1="0" y1="45" x2="0" y2="550"><stop stop-color="#FF647C"/><stop offset=".56" stop-color="#FF3B5C"/><stop offset="1" stop-color="#ED2550"/></linearGradient>`,
    `<linearGradient id="${uid}-cuff" gradientUnits="userSpaceOnUse" x1="110" y1="525" x2="90" y2="660"><stop stop-color="#FC5877"/><stop offset="1" stop-color="#F52E52"/></linearGradient>`,
    `<linearGradient id="${uid}-copper" gradientUnits="userSpaceOnUse" x1="0" y1="283" x2="0" y2="394"><stop stop-color="#FFD4AA"/><stop offset=".5" stop-color="#F6B187"/><stop offset="1" stop-color="#F19672"/></linearGradient>`,
    `<radialGradient id="${uid}-aura"><stop stop-color="#FFD5AD" stop-opacity=".65"/><stop offset=".38" stop-color="#F67552" stop-opacity=".37"/><stop offset="1" stop-color="#FF3159" stop-opacity="0"/></radialGradient>`,
    `<linearGradient id="${uid}-vapor" gradientUnits="userSpaceOnUse" x1="0" y1="54" x2="0" y2="229"><stop stop-color="#FFD5BB" stop-opacity="0"/><stop offset=".38" stop-color="#FF9872"/><stop offset=".74" stop-color="#FFB28B"/><stop offset="1" stop-color="#FF596A" stop-opacity=".14"/></linearGradient>`,
    `<filter id="${uid}-diffusion" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>`,
  )
  const hand = (side) => {
    const mesh = `${uid}-mesh-${side}`
    const heat = `${uid}-heat-${side}`
    defs.push(`<path id="${mesh}" data-crown-mesh="${side}" data-reach="${reachPath}" data-release="${releasePath}" d="${restPath}" fill="none"/>`,
      `<linearGradient id="${heat}" data-crown-heat="${side}" gradientUnits="userSpaceOnUse" x1="0" y1="540" x2="0" y2="790"><stop stop-color="#FFDABC" stop-opacity="0"/><stop offset=".28" stop-color="#FFDABC"/><stop offset=".4" stop-color="#FFAD84"/><stop offset=".76" stop-color="#FF5959" stop-opacity=".5"/><stop offset="1" stop-color="#FF5959" stop-opacity="0"/></linearGradient>`)
    return `<g transform="${CROWN_POSE}"><g data-crown-hand="${side}" transform="rotate(0 140 625)">
      ${rest.cuff.map((t, i) => `<polygon points="${pts(t)}" fill="${i ? `url(#${uid}-cuff)` : '#BD183F'}" stroke-width="2" stroke="none"/>`).join('')}
      <g stroke-linecap="round" stroke-linejoin="round">
        <use href="#${mesh}" stroke="url(#${uid}-wire)" stroke-width="4.5"/>
        <g data-crown-current="${side}" opacity="0" stroke="url(#${heat})">
          <use href="#${mesh}" stroke-width="15" opacity=".62" filter="url(#${uid}-diffusion)"/>
          <use href="#${mesh}" stroke-width="4.9"/>
        </g>
      </g>
    </g></g>`
  }
  const crown = `<g data-crown-lift="" transform="translate(0 0)">
    <g transform="translate(500 228) scale(2.35) translate(-512 -340)">
      <circle cx="512" cy="340" r="64" fill="url(#${uid}-glow)"/>
      <circle data-crown-aura="" cx="512" cy="340" r="53" fill="url(#${uid}-aura)" opacity="0"/>
      <g fill="none" stroke="url(#${uid}-copper)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
        ${CROWN_ROUTES.map((d) => `<path d="${d}"/>`).join('')}
        ${CROWN_NODES.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.BG}"/>`).join('')}
      </g>
      <g data-crown-spokes="" opacity="0" stroke="#FFF0D2" fill="none" stroke-width="3" stroke-linecap="round">
        ${CROWN_ROUTES.map((d) => `<path d="${d}" pathLength="1" stroke-dasharray=".48 2" stroke-dashoffset=".48"/>`).join('')}
      </g>
      ${CROWN_NODES.map(([cx, cy, r]) => `<g data-crown-node="" opacity="0"><circle cx="${cx}" cy="${cy}" r="22" fill="url(#${uid}-aura)"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#FFE9C1" stroke-width="3"/></g>`).join('')}
    </g>
  </g>`

  // The ribbons start near the inner fingertips and follow the sides of the
  // crown before an updraft draws them through the open center.
  const vapor = `<g data-crown-vapor="" opacity="0" fill="none" stroke-linecap="round">
    ${['', ' transform="translate(1000 0) scale(-1 1)"'].map((mirror) => `<g${mirror}>
      <path data-crown-wisp="" stroke="url(#${uid}-vapor)" stroke-width="18" opacity=".65" filter="url(#${uid}-diffusion)" d="M385 232C395 217 412 201 421 184C430 165 411 145 423 131C441 111 467 118 478 104"/>
      <path data-crown-wisp="" stroke="url(#${uid}-vapor)" stroke-width="2.8" opacity=".78" d="M388 230C397 213 416 201 425 182C434 163 415 143 425 130C440 113 469 119 479 106"/>
      <path data-crown-wisp="" stroke="url(#${uid}-vapor)" stroke-width="1.4" opacity=".66" d="M391 225C405 218 416 200 422 184C432 165 419 147 428 135C443 121 470 121 478 112"/>
    </g>`).join('')}
  </g>`
  const dust = Array.from({ length: 26 }, (_, i) => {
    const side = i % 2 ? -1 : 1
    const x = 500 + side * (81 + ((i * 37) % 78))
    const y = 207 + ((i * 17) % 57)
    return `<circle data-crown-dust="" cx="${x}" cy="${y}" r="${[1.9, 2.7, 3.3, 1.5][i % 4]}" fill="${i % 3 ? '#FFBD8C' : '#FF597A'}" opacity="0"/>`
  }).join('')
  return hand('left') + `<g transform="translate(1000 0) scale(-1 1)">${hand('right')}</g>`
    + vapor + `<g>${dust}</g>` + crown + emblem
}

export function renderCircuitMark(id, finish = CIRCUIT_FINISH, duration = 6, title = id, artUrl = '') {
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
  const rotateAt = (cx, cy, f, inner) => `<g>${at('rotate', f, (v) => `${v} ${f1(cx)} ${f1(cy)}`)}${inner}</g>`
  const moveBy = (f, inner) => `<g>${at('translate', f)}${inner}</g>`
  const fade = (f, inner) => `<g opacity="${f[0][1]}">${a('opacity', f)}${inner}</g>`
  /** A ring of light that leaves a point at share t and fades as it grows. */
  const flash = (cx, cy, r0, r1, t, len = 0.12, w = 6, color = C.AMBER) => `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${r0}" fill="none" stroke="${color}" stroke-width="${w}" opacity="0">${a('r', once([[0, r0], [t, r0], [t + len, r1, 'out'], [1, r1]]))}${a('opacity', once([[0, 0], [t, 0], [t + 0.005, 0.85, 'lin'], [t + len, 0, 'out'], [1, 0]]))}</circle>`
  /** A neon strike: the line stutters as it catches, then holds. */
  const strike = (t, inner) => fade(once([[0, 1], [t, 1], [t + 0.008, 0.35, 'lin'], [t + 0.018, 1, 'lin'], [t + 0.026, 0.6, 'lin'], [t + 0.04, 1, 'lin'], [1, 1]]), inner)

  /* ── Circuit E (local units, centred) ───────────────────────────────── */
  defs.push(
    `<linearGradient id="${uid}-bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF5470"/><stop offset=".5" stop-color="${C.LINE}"/><stop offset="1" stop-color="#E52C51"/></linearGradient>`,
    `<filter id="${uid}-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>`,
    `<radialGradient id="${uid}-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${C.HALO}" stop-opacity=".55"/><stop offset=".45" stop-color="${C.HALO}" stop-opacity=".16"/><stop offset="1" stop-color="${C.HALO}" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="${uid}-amber" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${C.AMBER}" stop-opacity=".7"/><stop offset=".4" stop-color="${C.AMBER}" stop-opacity=".22"/><stop offset="1" stop-color="${C.AMBER}" stop-opacity="0"/></radialGradient>`,
  )
  const eBar = ([cy, w]) => `<rect data-halo="1" x="${E_BAR_X}" y="${cy - E_BAR_H / 2}" width="${w}" height="${E_BAR_H}" fill="${C.HALO}" opacity=".55" filter="url(#${uid}-soft)"/>`
    + `<rect x="${E_BAR_X}" y="${cy - E_BAR_H / 2}" width="${w}" height="${E_BAR_H}" rx="2" fill="url(#${uid}-bar)"/>`
  const eTrace = (d) => `<path data-halo="1" d="${d}" fill="none" stroke="${C.HALO}" stroke-opacity=".5" stroke-width="12" filter="url(#${uid}-soft)"></path>`
    + `<path d="${d}" fill="none" stroke="${C.LINE}" stroke-width="8" stroke-linejoin="miter"></path>`
  const eNode = (cx, cy) => `<circle data-halo="1" cx="${cx}" cy="${cy}" r="14" fill="${C.HALO}" opacity=".5" filter="url(#${uid}-soft)"/><circle cx="${cx}" cy="${cy}" r="10" fill="${C.BG}" stroke="${C.LINE}" stroke-width="8"></circle>`
  const eStill = () => E_BARS.map(eBar).join('')
    + E_BARS.map(([cy]) => eTrace(`M${E_NODE_X} ${cy}H${E_STUB_X}`)).join('')
    + E_ROUTES.map((r) => eTrace(r.d)).join('')
    + E_BARS.map(([cy]) => eNode(E_NODE_X, cy)).join('')
    + E_ROUTES.map((r) => eNode(r.end[0], r.end[1])).join('')
  const eFlow = () => {
    defs.push(
      `<linearGradient id="${uid}-current" gradientUnits="userSpaceOnUse" x1="-110" y1="0" x2="2" y2="0"><stop stop-color="#FF9A48" stop-opacity="0"/><stop offset=".46" stop-color="#FF934E" stop-opacity=".28"/><stop offset=".84" stop-color="#FF9D63" stop-opacity=".92"/><stop offset="1" stop-color="#FFF0C8"/></linearGradient>`,
      `<radialGradient id="${uid}-heat"><stop stop-color="#FFCA92" stop-opacity=".64"/><stop offset=".38" stop-color="#FF654B" stop-opacity=".38"/><stop offset="1" stop-color="#ED163C" stop-opacity="0"/></radialGradient>`,
    )
    const current = (d, kind) => `<g data-circuit-${kind} opacity="0">
      <path d="${d}" pathLength="1" fill="none" stroke="#FF9A52" stroke-width="10" stroke-opacity=".42" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=".36 2" stroke-dashoffset=".36"/>
      <path d="${d}" pathLength="1" fill="none" stroke="#FFE7BC" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray=".20 2" stroke-dashoffset=".20"/>
    </g>`
    const node = (x, y, kind) => `<g data-circuit-${kind} opacity="0">
      <circle cx="${x}" cy="${y}" r="32" fill="url(#${uid}-heat)"/>
      <circle cx="${x}" cy="${y}" r="10" fill="none" stroke="#FFD0A7" stroke-width="5"/>
    </g>`
    return E_BARS.map(([cy, w], i) => {
      const clip = `${uid}-lane-${i}`
      defs.push(`<clipPath id="${clip}"><rect x="${E_BAR_X}" y="${cy - E_BAR_H / 2}" width="${w}" height="${E_BAR_H}" rx="2"/></clipPath>`)
      const route = E_ROUTES.find(({ end }) => cy * end[1] > 0)
      return `<g data-circuit-lane data-bar-end="${E_BAR_X + w}">
        ${node(E_NODE_X, cy, 'source')}
        ${current(`M${E_NODE_X + 12} ${cy}H${E_STUB_X}`, 'feed')}
        ${route ? current(route.d, 'branch') + node(...route.end, 'terminal') : ''}
        <g clip-path="url(#${clip})"><g transform="translate(0 ${cy})">
          <g data-circuit-fluid opacity="0" transform="translate(${E_BAR_X - 10} 0)">
            <path data-circuit-front d="M-112 -30H-14C-13 -17 11 -15 4 -2S-10 15 7 30H-112Z" fill="url(#${uid}-current)"/>
            <path data-circuit-rim d="M-14 -30C-13 -17 11 -15 4 -2S-10 15 7 30" fill="none" stroke="#FFE6B4" stroke-opacity=".79" stroke-width="1.8"/>
            <path data-circuit-stream d="M-91 12C-61 11 -39 22 -13 11M-76 -10C-54 -16 -37 -7 -17 -11M-49 1C-29 -2 -18 2 -8 -3" fill="none" stroke="#FFF0CE" stroke-opacity=".52" stroke-width="1.3" stroke-linecap="round"/>
          </g>
        </g></g>
      </g>`
    }).join('')
  }
  const place = (cx, cy, scale, inner) => `<g transform="translate(${cx} ${cy}) scale(${scale})">${inner}</g>`

  let still = ''
  let moving = ''

  if (id === 'circuit-e') {
    const S = 3.05
    still = place(500, 500, S, eStill())
    moving = place(500, 500, S, eFlow())
  } else if (id === 'circuit-spire') {
    still = renderCrown(uid, defs, place(500, 735, 0.78, eStill()))
  } else {
    // Direct ports of Frankie's two hand references (2026-11-23): the art
    // itself, with its E (and the stray text) taken out and the three bars
    // redrawn in vector so they can build. Node Hands is the wire hands with
    // linked fingertip nodes; Facet Hands is the solid low-poly hands (its
    // four bars become three). Each hand moves as one piece: it rises turned
    // in, opens out to the reference pose, sways, and the fingertips glow.
    const art = artUrl || `/brand/${id}-art.webp`
    const SPEC = id === 'catalyst-core'
      ? {
        bars: [[432.6, 374.4, 137.2], [432.6, 460.5, 137.2], [432.6, 546.5, 137.2]], h: 37.2,
        colors: ['#F63559', '#E82F51', '#BD1C36'],
        tips: [[147, 200], [263, 147], [360, 219], [395, 368], [626, 368], [661, 219], [758, 147], [876, 200]], glow: 40,
        wrist: [[332, 895], [668, 895]],
      }
      : {
        bars: [[403.3, 336.7, 200], [403.3, 455, 180], [403.3, 573.3, 200]], h: 40,
        colors: ['#F22B54', '#F02C55', '#EF2C56'],
        tips: [[200, 242], [275, 212], [337, 253], [377, 320], [78, 445], [622, 320], [662, 253], [725, 212], [800, 242], [922, 445]], glow: 52,
        wrist: [[217, 812], [790, 812]],
      }
    defs.push(`<clipPath id="${uid}-hl"><rect x="0" y="0" width="500" height="1000"/></clipPath><clipPath id="${uid}-hr"><rect x="500" y="0" width="500" height="1000"/></clipPath>`)
    const img = `<image href="${art}" x="0" y="0" width="1000" height="1000" preserveAspectRatio="xMidYMid meet"/>`
    const bar = ([x, y, w], i) => `<rect data-halo="1" x="${x}" y="${y}" width="${w}" height="${SPEC.h}" fill="${C.HALO}" opacity=".45" filter="url(#${uid}-soft)"/><rect x="${x}" y="${y}" width="${w}" height="${SPEC.h}" fill="${SPEC.colors[i]}"/>`
    const barsStill = SPEC.bars.map(bar).join('')
    const half = (side) => {
      const [wx, wy] = SPEC.wrist[side === 'L' ? 0 : 1]
      const sgn = side === 'L' ? 1 : -1
      const piece = `<g clip-path="url(#${uid}-h${side === 'L' ? 'l' : 'r'})">${img}</g>`
      // turned in and low, then opens out to the reference pose and sways
      const turn = rotateAt(wx, wy, once([[0, 14 * sgn], [0.02, 14 * sgn], [0.3, 0, 'out'], [0.5, 0], [0.62, -2 * sgn], [0.74, 1 * sgn], [0.84, 0], [0.95, 10 * sgn, 'in'], [1, 14 * sgn]]), piece)
      return moveBy(once([[0, '0 70'], [0.02, '0 70'], [0.24, '0 0', 'out'], [0.9, '0 0'], [1, '0 40', 'in']]), turn)
    }
    const tipGlow = ([x, y], i) => `<circle cx="${x}" cy="${y}" r="${SPEC.glow}" fill="url(#${uid}-amber)" opacity="0">${a('opacity', once([[0, 0], [0.24 + (i % 5) * 0.025, 0], [0.3 + (i % 5) * 0.025, 1, 'out'], [0.5, 0.55], [0.62, 1], [0.74, 0.6], [0.86, 0.9], [0.94, 0, 'in'], [1, 0]]))}</circle>`
    const barsMoving = SPEC.bars.map(([x, y, w], i) => {
      const t = 0.32 + i * 0.07
      const o = 0.8 + i * 0.02
      const clip = `${uid}-pb${i}`
      defs.push(`<clipPath id="${clip}"><rect x="${x - 20}" y="${y - 30}" width="0" height="${SPEC.h + 60}">${a('width', once([[0, 0], [t, 0], [t + 0.07, w + 40, 'out'], [o, w + 40], [o + 0.08, 0, 'in'], [1, 0]]))}</rect></clipPath>`)
      return strike(t + 0.07, `<g clip-path="url(#${clip})">${bar([x, y, w], i)}</g>`) + flash(x, y + SPEC.h / 2, 6, 60, t, 0.1, 3)
    }).join('')
    const fadeAll = (inner) => fade(once([[0, 0], [0.02, 0], [0.1, 1, 'out'], [0.93, 1], [0.99, 0, 'in'], [1, 0]]), inner)
    still = img + barsStill
    moving = fadeAll(half('L') + half('R') + SPEC.tips.map(tipGlow).join('')) + barsMoving
  }

  const css = '.mark-static{display:none}.motion-still .mark-static{display:inline}.motion-still .motion-layer{display:none}'
    + '@media(prefers-reduced-motion:reduce){svg:not(.motion-opt-in) .mark-static{display:inline}svg:not(.motion-opt-in) .motion-layer{display:none}}'
  const base = id === 'circuit-spire' ? 'data-crown-base=""' : id === 'circuit-e' ? 'data-circuit-base=""' : 'class="mark-static"'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" class="logo-loop" role="img" aria-label="${title} loading animation" data-logo="${id}" data-finish="${finish}"><title>${title}</title><style>${css}</style><defs>${defs.join('')}</defs><g transform="translate(500 500) scale(${INSET}) translate(-500 -500)"><g ${base}>${still}</g><g class="motion-layer">${moving}</g></g></svg>`
}

/** The still mark only, cropped back to the art (no loader inset), for exporting icons and cards. */
export function renderCircuitStill(id, finish = CIRCUIT_FINISH, artUrl = '') {
  return renderCircuitMark(id, finish, 6, id, artUrl).replace('viewBox="0 0 1000 1000" class="logo-loop"', `viewBox="${ICON_BOX}" class="logo-loop motion-still"`)
}
