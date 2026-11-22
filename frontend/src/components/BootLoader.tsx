import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import EnhancedLoadingScreen from './EnhancedLoadingScreen'
import { prefersReducedMotion } from './bench/motion'
import {
  bootProgress, endBoot, isPublicPath, markBoot, stageDurations, uncoverBoot, useBoot,
} from '../services/bootProgress'
import type { BootStage, BootStageId } from '../services/bootProgress'
import './BootLoader.css'

/** Never hold anyone on the loader longer than this, whatever a stage is doing. */
const GIVE_UP_MS = 15000
/** First load only, so it may take a beat longer to read as progress, not a flash. */
const MIN_VISIBLE_MS = 1400
const MIN_FILL_MS = 450
const HOLD_MS = 220
const EXIT_MS = 760

const LIVE_WORD: Record<BootStageId, string> = { app: 'STARTING', session: 'CHECKING', workspace: 'LOADING', page: 'DRAWING' }

const now = (): number => performance.now()
const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3)

function rowsFor(stages: ReadonlyArray<BootStage>): Array<[string, string, string]> {
  const took = stageDurations(stages)
  const live = stages.findIndex((s) => s.doneAt === null)
  return stages.map((s, i) => {
    if (s.doneAt !== null) return [s.label, 'mint', `${((took[i] ?? 0) / 1000).toFixed(2)}s`]
    return i === live ? [s.label, 'live', LIVE_WORD[s.id]] : [s.label, 'off', 'WAITING']
  })
}

function stopsFor(stages: ReadonlyArray<BootStage>): Array<{ at: number; done: boolean }> {
  const total = stages.reduce((sum, s) => sum + s.weight, 0)
  let run = 0
  return stages.slice(0, -1).map((s) => {
    run += s.weight
    return { at: run / total, done: s.doneAt !== null }
  })
}

/**
 * The first-load loading screen (2026-11-22). Mounted once at the app root;
 * on a full page load into the app it covers everything, shows the real
 * stages from services/bootProgress, fills its progress to 100 once the
 * first page is drawn, then opens from the centre onto the app. Later
 * navigation never shows it. With reduced motion: no creep, a plain fade.
 */
export default function BootLoader(): React.ReactElement | null {
  const boot = useBoot()
  const { pathname } = useLocation()
  const [shown, setShown] = useState(() => bootProgress(boot.stages))
  const [exiting, setExiting] = useState(false)
  const mountedAt = useRef(now())

  // Signed out (or sent to sign-in): the load went somewhere public, so just leave
  useEffect(() => {
    if (boot.phase === 'loading' && isPublicPath(pathname)) endBoot('aborted')
  }, [boot.phase, pathname])

  useEffect(() => {
    if (!boot.covering) return undefined
    const timer = window.setTimeout(() => endBoot('done'), GIVE_UP_MS)
    return () => window.clearTimeout(timer)
  }, [boot.covering])

  // Progress while loading: ease toward the measured value every frame
  const stagesRef = useRef(boot.stages)
  stagesRef.current = boot.stages
  useEffect(() => {
    if (!boot.covering || boot.phase !== 'loading') return undefined
    const reduce = prefersReducedMotion()
    let frame = 0
    let last = now()
    const tick = (): void => {
      const t = now()
      const target = bootProgress(stagesRef.current, t, !reduce)
      const k = reduce ? 1 : Math.min(1, (t - last) / 140)
      last = t
      setShown((v) => v + (target - v) * k)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [boot.covering, boot.phase])

  // Finished: run the fill to 100, hold a beat, then open onto the app
  useEffect(() => {
    if (!boot.covering || boot.phase === 'loading' || boot.phase === 'idle') return undefined
    const reduce = prefersReducedMotion()
    const timers: number[] = []
    let frame = 0
    const exitMs = reduce ? 200 : EXIT_MS
    const leave = (): void => {
      setExiting(true)
      timers.push(window.setTimeout(uncoverBoot, exitMs))
    }
    if (boot.phase === 'aborted') {
      leave()
    } else {
      const from = shown
      const fillMs = reduce ? 0 : Math.max(MIN_FILL_MS, MIN_VISIBLE_MS - (now() - mountedAt.current))
      const start = now()
      const tick = (): void => {
        const p = fillMs ? Math.min(1, (now() - start) / fillMs) : 1
        setShown(from + (100 - from) * easeOut(p))
        if (p < 1) frame = requestAnimationFrame(tick)
        else timers.push(window.setTimeout(leave, reduce ? 120 : HOLD_MS))
      }
      frame = requestAnimationFrame(tick)
    }
    return () => { cancelAnimationFrame(frame); timers.forEach((id) => window.clearTimeout(id)) }
    // `shown` is read once as the starting point of the fill
  }, [boot.covering, boot.phase])

  if (!boot.covering) return null
  const rows = rowsFor(boot.stages)
  const live = rows.find(([, tone]) => tone === 'live')
  const label = live ? `${live[0]}: ${live[2]}` : 'Ready'
  return createPortal(
    <div className="en-boot" data-state={exiting ? 'exit' : 'on'} data-reduce={prefersReducedMotion() ? '' : undefined}>
      <EnhancedLoadingScreen boot={{ progress: shown, rows, label, stops: stopsFor(boot.stages) }} />
    </div>,
    document.body,
  )
}

/** Marks a first-load stage done when it mounts (the page stage sits beside the Outlet). */
export function BootMark({ stage }: { stage: BootStageId }): null {
  useEffect(() => { markBoot(stage) }, [stage])
  return null
}
