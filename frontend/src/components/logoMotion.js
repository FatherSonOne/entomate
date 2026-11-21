// Shared illustrated loading motion, mirrored from the brand loading lab.
/* Native SVG loading loops; the source PNG remains intact beneath moving layers. */
export const LOGO_MOTIONS = {
  relay: { name: 'Signal relay', note: 'A counter-orbit carries a signal between the satellite cores.', type: 'relay' },
  constellation: { name: 'Connected cores', note: 'Signals circulate between the three satellites and the central intelligence core.', type: 'network' },
  aperture: { name: 'Aperture calibration', note: 'The crescent calibrates gently while a precise highlight completes the orbit.', type: 'aperture' },
  orbit: { name: 'Ribbon exchange', note: 'Two opposing currents follow the intertwined ribbon paths.', type: 'ribbons' },
  bloom: { name: 'Living bloom', note: 'Four lobes breathe in sequence around the shared center.', type: 'bloom' },
  'circuit-spire': { name: 'Circuit ascent', note: 'Energy rises through the routing spine and returns along the branch circuit.', type: 'spire' },
  'circuit-e': { name: 'Sequential execution', note: 'The three E bars charge in sequence, connecting their terminal nodes.', type: 'circuit' },
  'catalyst-core': { name: 'Catalyst lock', note: 'Counter-rotating circuit rings resolve around a steady central core.', type: 'core' },
  'routed-signal': { name: 'Routed charge', note: 'Staggered pulses travel along the horizontal routes.', type: 'routes' },
  ignition: { name: 'Agent ignition', note: 'The core gathers energy while its outer tracking arc revolves.', type: 'ignition' },
  'relay-orbits': { name: 'Orbital handoff', note: 'Nested circuits counter-rotate around a shared signal axis.', type: 'nested' },
  'signal-cascade': { name: 'Signal cascade', note: 'Soft concentric ripples carry the signal outward from the center.', type: 'cascade' },
  'orbital-network': { name: 'Network convergence', note: 'Satellite signals return to the intelligence core along connected routes.', type: 'network' },
  trinity: { name: 'Three-part harmony', note: 'The three orbital regions activate in a measured repeating sequence.', type: 'trinity' },
  'flow-field': { name: 'Vortex flow', note: 'Four local currents turn in opposing directions within the ribbon field.', type: 'vortices' },
  'neural-core': { name: 'Neural exchange', note: 'A living core exchanges signals with its surrounding circuitry.', type: 'neural' },
  'ribbon-catalyst': { name: 'Ribbon circulation', note: 'Two bright currents follow the torus while its rim rocks gently.', type: 'torus' },
}

let logoMotionInstance = 0
export function renderLogoMotion(id, href, duration = 6, title = id) {
  const uid = 'en-motion-' + id + '-' + (++logoMotionInstance)
  const kind = LOGO_MOTIONS[id].type
  const mint = '#9affed', red = '#ff628d', chalk = '#fff7ed'
  const defs = [`<image id="${uid}-art" href="${href}" x="0" y="0" width="1000" height="1000" preserveAspectRatio="xMidYMid meet"/>`]
  let layerIndex = 0
  const image = (opacity = 1) => `<use href="#${uid}-art" opacity="${opacity}"/>`
  const begin = phase => `${-(phase || 0) * duration}s`
  const spin = (cx, cy, reverse = false, phase = 0) => `<animateTransform attributeName="transform" type="rotate" from="${phase * 360} ${cx} ${cy}" to="${phase * 360 + (reverse ? -360 : 360)} ${cx} ${cy}" dur="${duration}s" repeatCount="indefinite"/>`
  function arc(cx, cy, r, color = mint, reverse = false, phase = 0) {
    return `<g class="motion-layer"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" opacity=".65" stroke-dasharray="${r * .65} ${r * 6.283}"/>${spin(cx, cy, reverse, phase)}</g>`
  }
  function ripple(cx, cy, r, phase = 0, color = mint) {
    return `<circle class="motion-layer" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="2"><animate attributeName="r" values="${r * .78};${r * 1.22}" dur="${duration}s" begin="${begin(phase)}" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.45;0" keyTimes="0;.22;1" dur="${duration}s" begin="${begin(phase)}" repeatCount="indefinite"/></circle>`
  }
  function traveler(path, color = mint, phase = 0, r = 5) {
    return `<g class="motion-layer"><path d="${path}" fill="none" stroke="${color}" stroke-width="1.4" opacity=".12"/><circle r="${r}" fill="${color}" filter="url(#${uid}-glow)"><animateMotion path="${path}" dur="${duration}s" begin="${begin(phase)}" repeatCount="indefinite" calcMode="paced"/><animate attributeName="opacity" values=".45;1;.45" dur="${duration / 2}s" repeatCount="indefinite"/></circle></g>`
  }
  function ringTexture(cx, cy, r, thickness, direction = 1, rock = false, phase = 0) {
    const clip = `${uid}-ring-${layerIndex++}`, inner = r - thickness
    defs.push(`<clipPath id="${clip}"><path clip-rule="evenodd" fill-rule="evenodd" d="M${cx-r} ${cy}a${r} ${r} 0 1 0 ${2*r} 0a${r} ${r} 0 1 0 ${-2*r} 0 M${cx-inner} ${cy}a${inner} ${inner} 0 1 0 ${2*inner} 0a${inner} ${inner} 0 1 0 ${-2*inner} 0Z"/></clipPath>`)
    const motion = rock ? `<animateTransform attributeName="transform" type="rotate" values="-7 ${cx} ${cy};7 ${cx} ${cy};-7 ${cx} ${cy}" dur="${duration}s" begin="${begin(phase)}" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"/>` : spin(cx,cy,direction<0,phase)
    return `<g class="motion-layer" clip-path="url(#${clip})" opacity=".36"><g>${image()}${motion}</g></g>`
  }
  function breathe(cx, cy, r, phase = 0) {
    const clip = `${uid}-petal-${layerIndex++}`
    defs.push(`<clipPath id="${clip}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`)
    return `<g class="motion-layer" clip-path="url(#${clip})"><g transform="translate(${cx} ${cy})"><g><g transform="translate(${-cx} ${-cy})">${image()}</g><animateTransform attributeName="transform" type="scale" values="1;1.035;1" dur="${duration}s" begin="${begin(phase)}" calcMode="spline" keyTimes="0;.5;1" keySplines=".45 0 .55 1;.45 0 .55 1" repeatCount="indefinite"/><animate attributeName="opacity" values=".03;.36;.03" dur="${duration}s" begin="${begin(phase)}" repeatCount="indefinite"/></g></g></g>`
  }
  let moving = ''
  if (kind === 'relay') {
    moving = ringTexture(500,500,250,70,1,true) + arc(500,500,285,mint,false,.1)
      + traveler('M180 500 C180 260 820 260 820 500 C820 740 180 740 180 500Z',chalk)
      + traveler('M180 500H820H180Z',red,.5) + ripple(500,500,235,.2)
  } else if (kind === 'network') {
    moving = ringTexture(545,565,245,65,-1,true) + arc(545,565,260,mint,true)
      + traveler('M260 350L545 565L760 300L545 565L270 735L545 565L260 350Z',chalk)
      + traveler('M260 350Q510 60 760 300Q960 610 545 565Q155 960 270 735Q60 490 260 350Z',mint,.5)
      + ripple(545,565,95,.5,red)
  } else if (kind === 'aperture') {
    moving = ringTexture(515,500,375,85,1,true) + arc(515,500,383,chalk,false,.22)
      + ringTexture(335,500,105,36,-1) + ripple(335,500,110,.4,mint)
  } else if (kind === 'ribbons') {
    moving = breathe(500,525,310) + ringTexture(515,530,295,70,1,true)
      + traveler('M230 300C70 570 320 800 570 710C920 640 875 240 685 285C460 335 620 690 370 695C125 700 135 435 230 300Z',mint)
      + traveler('M250 700C100 420 450 175 710 365C930 520 615 850 390 705C180 570 390 240 625 350C850 460 570 815 250 700Z',red,.5)
  } else if (kind === 'bloom') {
    moving = [[330,330],[675,325],[675,675],[330,675]].map(([x,y],i)=>breathe(x,y,205,i/4)).join('')
      + traveler('M330 330C330 110 900 160 680 350C450 550 890 610 680 700C470 900 80 790 325 630C560 450 70 420 330 330Z',mint)
      + ripple(500,500,150,.5,red)
  } else if (kind === 'spire') {
    moving = traveler('M500 890V230H555V410H725V465H500V650H265V710H500V890Z',chalk)
      + traveler('M500 165V420H275V485H500V685H735V750H500V165Z',red,.5)
      + breathe(500,500,320,.25)
  } else if (kind === 'circuit' || kind === 'routes') {
    const ys = kind === 'circuit' ? [215,500,785] : [255,500,745]
    moving = ys.map((y,i)=>traveler(`M235 ${y}H810V${y+22}H235V${y}Z`,i===1?mint:chalk,i/3,5)).join('')
      + traveler('M235 215V785V215Z',red,.15) + breathe(500,500,340,.35)
  } else if (kind === 'core' || kind === 'nested') {
    moving = ringTexture(500,500,325,55,1) + ringTexture(500,500,205,45,-1)
      + arc(500,500,340,mint) + arc(500,500,220,red,true,.5) + ripple(500,500,80,.4)
  } else if (kind === 'ignition') {
    moving = breathe(500,500,310) + ripple(500,500,235,.1,mint) + ripple(500,500,235,.6,red)
      + arc(500,500,340,mint,true) + traveler('M500 160V840V160Z',chalk,.25)
  } else if (kind === 'cascade') {
    moving = [0,.33,.66].map(p=>ripple(500,500,275,p,p===.33?mint:chalk)).join('')
      + ringTexture(500,500,300,40,-1) + arc(500,500,340,chalk,false,.3)
  } else if (kind === 'trinity') {
    moving = breathe(350,330,200) + breathe(650,330,200,1/3) + breathe(500,680,280,2/3)
      + traveler('M350 330Q500 150 650 330Q800 570 500 680Q180 560 350 330Z',chalk)
      + ripple(500,500,125,.5,mint)
  } else if (kind === 'vortices') {
    moving = [[330,310,1],[690,310,-1],[330,700,-1],[690,700,1]].map(([x,y,d])=>ringTexture(x,y,175,65,d)).join('')
      + traveler('M330 310C600 100 875 460 690 700C420 960 60 525 330 310Z',chalk)
  } else if (kind === 'neural') {
    moving = ringTexture(500,500,280,70,1,true) + breathe(500,500,185,.25)
      + traveler('M220 430L650 430L650 650L350 650L350 350L780 350L780 575L220 575V430Z',mint)
      + arc(500,500,315,red,true,.5)
  } else if (kind === 'torus') {
    moving = ringTexture(500,500,350,110,1,true)
      + traveler('M190 500C190 125 810 125 810 500C810 875 190 875 190 500Z',mint)
      + traveler('M500 180C850 180 850 820 500 820C150 820 150 180 500 180Z',red,.5)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" class="logo-loop" role="img" aria-label="${title} loading animation" data-logo="${id}"><title>${title} — ${LOGO_MOTIONS[id].name}</title><style>@media(prefers-reduced-motion:reduce){svg:not(.motion-opt-in) .motion-layer{display:none}}</style><defs><filter id="${uid}-glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="5"/></filter>${defs.join('')}</defs>${image()}${moving}</svg>`
}
