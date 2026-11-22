import React from 'react'

/**
 * First-load progress drawn into the logo's own geometry (pilot, 2026-11-22).
 * Sits over the loader art in the same 1000-unit box, so a ring here lands on
 * the mark. Relay Orbits only for now: an outer orbit that fills from the
 * left end of its signal axis, clockwise over the top, with a tick per stage.
 * Other systems keep the corner bar until they get geometry here.
 */
interface OrbitGeometry { cx: number; cy: number; r: number; startDeg: number }

const ORBITS: Record<string, OrbitGeometry> = {
  // Outside the outer circuit (r≈340), clear of the art; 180° = the signal axis's left end
  'relay-orbits': { cx: 500, cy: 500, r: 418, startDeg: 180 },
}

export function hasProgressOrbit(logoId: string): boolean {
  return logoId in ORBITS
}

const MINT = '#9affed'

function point(g: OrbitGeometry, share: number): { x: number; y: number } {
  const a = ((g.startDeg + share * 360) * Math.PI) / 180
  return { x: g.cx + g.r * Math.cos(a), y: g.cy + g.r * Math.sin(a) }
}

interface Props {
  logoId: string
  /** 0-100 */
  progress: number
  /** Stage ends as shares 0-1 of the whole, with whether each is done. */
  stops?: ReadonlyArray<{ at: number; done: boolean }>
}

export default function ProgressOrbit({ logoId, progress, stops = [] }: Props): React.ReactElement | null {
  const g = ORBITS[logoId]
  if (!g) return null
  const share = Math.max(0, Math.min(1, progress / 100))
  const length = 2 * Math.PI * g.r
  const head = point(g, share)
  return (
    <svg className="en-orbit" viewBox="0 0 1000 1000" aria-hidden="true">
      <defs>
        <filter id="en-orbit-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <circle cx={g.cx} cy={g.cy} r={g.r} fill="none" stroke="#fff" strokeOpacity=".09" strokeWidth="1.5" />
      {/* Fill: a circle drawn from the start angle, revealed by its dash */}
      <circle
        className="en-orbit-fill"
        cx={g.cx}
        cy={g.cy}
        r={g.r}
        fill="none"
        stroke={MINT}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${share * length} ${length}`}
        transform={`rotate(${g.startDeg} ${g.cx} ${g.cy})`}
      />
      {stops.map(({ at, done }) => {
        const inner = { ...g, r: g.r - 9 }
        const outer = { ...g, r: g.r + 9 }
        const a = point(inner, at)
        const b = point(outer, at)
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
