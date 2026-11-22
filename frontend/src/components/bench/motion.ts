import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

/**
 * Motion primitives shared by every surface. CSS tokens and classes live in
 * styles/motion.css; the ms values here match them. This module imports
 * nothing from the app, so any component can use it without import cycles.
 */
export const MOTION = {
  press: 140,
  fast: 160,
  base: 220,
  slow: 300,
  exit: 160,
  spring: 460,
  easeOut: 'cubic-bezier(0.23, 1, 0.32, 1)',
  easeInOut: 'cubic-bezier(0.77, 0, 0.175, 1)',
} as const

const REDUCE_KEY = 'entomate-reduce-motion'
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)'

/** True when the OS asks for less motion or the in-app Reduce motion toggle is on. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  if (document.documentElement.dataset.motion === 'reduce') return true
  return window.matchMedia?.(REDUCE_QUERY).matches ?? false
}

/** Apply the in-app Reduce motion setting (Settings > Appearance) and remember it for the next boot. */
export function applyReduceMotion(on: boolean): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (on) root.dataset.motion = 'reduce'
  else delete root.dataset.motion
  try {
    if (on) localStorage.setItem(REDUCE_KEY, '1')
    else localStorage.removeItem(REDUCE_KEY)
  } catch { /* private mode: the attribute still applies for this visit */ }
}

/** Boot: restore the remembered Reduce motion setting before first paint. */
export function initReduceMotion(): void {
  try {
    if (localStorage.getItem(REDUCE_KEY) === '1') document.documentElement.dataset.motion = 'reduce'
  } catch { /* ignore */ }
}

export type PresenceState = 'open' | 'closed'

/**
 * Keep an element mounted long enough to animate out.
 * Returns `mounted` (render it) and `state` for data-state="open|closed".
 * On open it mounts closed, then flips to open on the next frame so the
 * CSS transition runs; on close it flips to closed and unmounts after exitMs.
 */
export function usePresence(open: boolean, exitMs: number = MOTION.exit): { mounted: boolean; state: PresenceState } {
  const [mounted, setMounted] = useState<boolean>(open)
  const [state, setState] = useState<PresenceState>(open ? 'open' : 'closed')

  useEffect(() => {
    if (open) {
      setMounted(true)
      let raf2 = 0
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setState('open'))
      })
      return () => {
        cancelAnimationFrame(raf1)
        cancelAnimationFrame(raf2)
      }
    }
    setState('closed')
    const t = window.setTimeout(() => setMounted(false), exitMs + 20)
    return () => window.clearTimeout(t)
  }, [open, exitMs])

  return { mounted, state }
}

/**
 * Play a short enter (fade + small rise) on `ref` whenever `key` changes,
 * without remounting it. For tab panels, swapped detail views and route
 * content that stays mounted. Skips the first render and honours reduced
 * motion (fade only). Runs on the compositor through the Web Animations API.
 */
export function useEnterOnChange(ref: RefObject<HTMLElement | null>, key: unknown, opts: { rise?: number; duration?: number } = {}): void {
  const first = useRef(true)
  const { rise = 6, duration = MOTION.base } = opts
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const el = ref.current
    if (!el || typeof el.animate !== 'function') return
    const travel = prefersReducedMotion() ? 0 : rise
    const anim = el.animate(
      [
        { opacity: 0, transform: `translate3d(0, ${travel}px, 0)` },
        { opacity: 1, transform: 'translate3d(0, 0, 0)' },
      ],
      { duration, easing: MOTION.easeOut },
    )
    return () => anim.cancel()
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
}
