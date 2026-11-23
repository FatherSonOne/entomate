import React from 'react'

/**
 * First-load progress drawn into each logo's own geometry (2026-11-22).
 * Sits over the loader art in the same 1000-unit box, so the track lands on
 * the mark. Round marks get an orbit just outside the art, starting where the
 * mark's own motion starts; the Circuit E and the three hand marks get a
 * rule under the art instead. A tick marks each stage.
 */
type Geometry =
  | { kind: 'orbit'; cx: number; cy: number; r: number; startDeg: number }
  | { kind: 'rule'; x1: number; x2: number; y: number }

const orbit = (r: number, startDeg = 270, cx = 500, cy = 500): Geometry => ({ kind: 'orbit', cx, cy, r, startDeg })

/* Radii clear the art (measured from each mark's alpha); 180° starts on a horizontal axis's left end, 270° at the top, 90° at the root. */
export const PROGRESS_GEOMETRY: Record<string, Geometry> = {
  'relay-orbits': orbit(418, 180),
  relay: orbit(432, 180),
  orbit: orbit(480),
  'orbital-network': orbit(432, 180),
  constellation: orbit(412),
  trinity: orbit(432),
  'circuit-e': { kind: 'rule', x1: 175, x2: 825, y: 860 },
  'circuit-spire': { kind: 'rule', x1: 160, x2: 840, y: 880 },
  'catalyst-core': { kind: 'rule', x1: 160, x2: 840, y: 880 },
  'routed-signal': { kind: 'rule', x1: 160, x2: 840, y: 880 },
  ignition: orbit(404),
  aperture: orbit(490),
  bloom: orbit(486),
  'flow-field': orbit(402),
  'neural-core': orbit(440),
  'ribbon-catalyst': orbit(472),
  'signal-cascade': orbit(334),
}

export function hasProgressOrbit(logoId: string): boolean {
  return logoId in PROGRESS_GEOMETRY
}

const MINT = '#9affed'

function point(g: Geometry, share: number): { x: number; y: number } {
  if (g.kind === 'rule') return { x: g.x1 + (g.x2 - g.x1) * share, y: g.y }
  const a = ((g.startDeg + share * 360) * Math.PI) / 180
  return { x: g.cx + g.r * Math.cos(a), y: g.cy + g.r * Math.sin(a) }
}

function tick(g: Geometry, share: number): [{ x: number; y: number }, { x: number; y: number }] {
  if (g.kind === 'rule') {
    const { x, y } = point(g, share)
    return [{ x, y: y - 9 }, { x, y: y + 9 }]
  }
  return [point({ ...g, r: g.r - 9 }, share), point({ ...g, r: g.r + 9 }, share)]
}

interface Props {
  logoId: string
  /** 0-100 */
  progress: number
  /** Stage ends as shares 0-1 of the whole, with whether each is done. */
  stops?: ReadonlyArray<{ at: number; done: boolean }>
}

export default function ProgressOrbit({ logoId, progress, stops = [] }: Props): React.ReactElement | null {
  const g = PROGRESS_GEOMETRY[logoId]
  if (!g) return null
  const share = Math.max(0, Math.min(1, progress / 100))
  const head = point(g, share)
  const track = g.kind === 'rule'
    ? { el: 'line' as const, props: { x1: g.x1, y1: g.y, x2: g.x2, y2: g.y }, length: g.x2 - g.x1 }
    : { el: 'circle' as const, props: { cx: g.cx, cy: g.cy, r: g.r, transform: `rotate(${g.startDeg} ${g.cx} ${g.cy})` }, length: 2 * Math.PI * g.r }
  const Track = track.el
  return (
    <svg className="en-orbit" viewBox="0 0 1000 1000" aria-hidden="true">
      <defs>
        <filter id="en-orbit-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <Track {...track.props} fill="none" stroke="#fff" strokeOpacity=".09" strokeWidth="1.5" />
      <Track {...track.props} className="en-orbit-fill" fill="none" stroke={MINT} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={`${share * track.length} ${track.length}`} />
      {stops.map(({ at, done }) => {
        const [a, b] = tick(g, at)
        return (
          <line key={at} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={done ? MINT : '#fff'}
            strokeOpacity={done ? 0.9 : 0.22} strokeWidth="2" strokeLinecap="round" />
        )
      })}
      {share > 0 && share < 1 && (
        <g>
          <circle cx={head.x} cy={head.y} r="9" fill={MINT} opacity=".55" filter="url(#en-orbit-glow)" />
          <circle cx={head.x} cy={head.y} r="4.5" fill="#fff7ed" />
        </g>
      )}
    </svg>
  )
}
