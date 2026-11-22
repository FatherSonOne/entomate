import * as React from 'react'

/* ============================================================
   RippleCircles: five concentric rings that breathe outward from a
   centre. Purely decorative (aria-hidden).

   Sizing: the wrapper is absolute with no inset, so the caller sizes
   and positions it (e.g. "inset-0", or "-inset-[9px]" to sit a
   little larger than what it surrounds).
   The innermost ring is 75% of the box, which puts it at the edge of
   a 54px round button inside a 72px box (the sidebar Record key).

   Colour: rings use --ripple-color, defaulting to the Bench Swiss
   display crimson. Override from the caller with an arbitrary
   property, e.g. className="[--ripple-color:var(--bs-d-live)]".

   Motion: the `ripple` keyframe lives in tailwind.config.js. Under
   prefers-reduced-motion the rings stay put (no animation).
   ============================================================ */

export interface RippleCirclesProps {
  /** Extra classes on the wrapper (positioning, colour, visibility). */
  className?: string
}

// Innermost first: tightest inset, strongest border, first in the stagger.
// Static strings so Tailwind's scanner sees every class.
const RINGS = [
  'inset-[12.5%] z-[5] [animation-delay:0ms] border-[color:color-mix(in_srgb,var(--ripple-color)_80%,transparent)]',
  'inset-[9.375%] z-[4] [animation-delay:200ms] border-[color:color-mix(in_srgb,var(--ripple-color)_60%,transparent)]',
  'inset-[6.25%] z-[3] [animation-delay:400ms] border-[color:color-mix(in_srgb,var(--ripple-color)_40%,transparent)]',
  'inset-[3.125%] z-[2] [animation-delay:600ms] border-[color:color-mix(in_srgb,var(--ripple-color)_28%,transparent)]',
  'inset-0 z-[1] [animation-delay:800ms] border-[color:color-mix(in_srgb,var(--ripple-color)_18%,transparent)]',
] as const

export function RippleCircles({ className = '' }: RippleCirclesProps) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute [--ripple-color:var(--bs-d-brand,#FF2D6B)] ${className}`}
    >
      {RINGS.map((ring) => (
        <span
          key={ring}
          className={`absolute rounded-full border bg-[color:color-mix(in_srgb,var(--ripple-color)_6%,transparent)] animate-ripple motion-reduce:animate-none ${ring}`}
        />
      ))}
    </span>
  )
}
