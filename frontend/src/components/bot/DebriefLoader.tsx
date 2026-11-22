/**
 * The loader shown while the minutes are written after the bot leaves a call.
 * Modelled on the Logos Vision meetings transcript loader: a bar that glides
 * and never goes back, the five pipeline steps, a stopwatch since the bot
 * left, "about N min left", placeholder lines "typed" under a blinking
 * cursor, an 8-bar wave, and a faint Game of Life behind it.
 *
 * Step states come from the backend's pipeline; movement inside a step and
 * the time left are estimates (services/debriefProgress.ts).
 *
 * Drawn from one animation loop that writes the DOM directly: the bar moves
 * every frame, and a React render per frame would redraw the whole panel.
 */

import React, { useEffect, useRef, useState } from 'react'
import { Display, Led } from '../bench'
import { botsApi } from '../../services/api'
import type { BotSessionView, CaptionLine } from '../../services/botView'
import { runTitle } from '../../services/botView'
import {
  estimate, glide, initials, loaderClock, minutesLeft, stepWhere,
  type DebriefInfo, type StepKey,
} from '../../services/debriefProgress'

export interface DebriefLoaderProps {
  view: BotSessionView
  /** A plain ruled strip instead of a display (the meeting page already has its one display). */
  plain?: boolean
}

const TONES = 4
const MAX_LINES = 8
const reducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Speaker names from the call's live captions, for the typed lines' initials. Empty when there were none. */
function useCallSpeakers(sessionId: string): string[] {
  const [names, setNames] = useState<string[]>([])
  useEffect(() => {
    let off = false
    Promise.resolve(botsApi.captions(sessionId, 0) as unknown)
      .then((raw) => {
        if (off) return
        // The API client hands back the body itself.
        const res = raw as { lines?: CaptionLine[] } | undefined
        const seen = new Set<string>()
        for (const l of res?.lines || []) if (l.speaker && !l.hidden) seen.add(l.speaker)
        setNames([...seen].slice(0, 6))
      })
      .catch(() => { /* placeholders fall back to numbered speakers */ })
    return () => { off = true }
  }, [sessionId])
  return names
}

/** Game of Life on a canvas, very faint, behind the loader. Wraps at the edges and reseeds if it dies out. */
function lifeCanvas(canvas: HTMLCanvasElement) {
  const SIZE = 14, GAP = 2, DENSITY = 0.2, STEP_MS = 450, FADE_MS = 400, MAX = 0.08
  let ctx: CanvasRenderingContext2D | null = null
  try { ctx = canvas.getContext('2d') } catch { ctx = null }
  let cols = 0, rows = 0
  let grid = new Uint8Array(0), next = new Uint8Array(0), alpha = new Float32Array(0)
  let color = '', lastStep = 0, lastFrame = 0
  const seed = () => { for (let i = 0; i < grid.length; i++) grid[i] = Math.random() < DENSITY ? 1 : 0 }
  const at = (arr: Uint8Array, i: number) => arr[i] ?? 0
  function resize() {
    if (!ctx) return
    const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1)
    if (!w || !h) return
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    const c = Math.ceil(w / SIZE), r = Math.ceil(h / SIZE)
    if (c !== cols || r !== rows) {
      cols = c; rows = r
      grid = new Uint8Array(c * r); next = new Uint8Array(c * r); alpha = new Float32Array(c * r)
      seed()
      for (let i = 0; i < grid.length; i++) alpha[i] = at(grid, i)
    }
    color = getComputedStyle(canvas).color || 'rgb(255,184,0)'
  }
  function step() {
    let alive = 0
    for (let y = 0; y < rows; y++) {
      const up = (y || rows) - 1, down = (y + 1) % rows
      for (let x = 0; x < cols; x++) {
        const l = (x || cols) - 1, r = (x + 1) % cols, i = y * cols + x
        const n = at(grid, up * cols + l) + at(grid, up * cols + x) + at(grid, up * cols + r)
          + at(grid, y * cols + l) + at(grid, y * cols + r)
          + at(grid, down * cols + l) + at(grid, down * cols + x) + at(grid, down * cols + r)
        const v = at(grid, i) ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0)
        next[i] = v
        alive += v
      }
    }
    const t = grid; grid = next; next = t
    if (alive < grid.length * 0.03) for (let i = 0; i < grid.length; i++) if (Math.random() < DENSITY / 3) grid[i] = 1
  }
  function draw(now: number, animate: boolean) {
    if (!ctx || !cols) return
    const dt = lastFrame ? now - lastFrame : FADE_MS
    lastFrame = now
    if (animate && now - lastStep >= STEP_MS) { lastStep = now; step() }
    const change = animate ? dt / FADE_MS : 1
    const dpr = canvas.width / Math.max(1, canvas.clientWidth)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
    ctx.fillStyle = color
    for (let i = 0; i < alpha.length; i++) {
      const target = at(grid, i), a = alpha[i] ?? 0
      const v = a < target ? Math.min(target, a + change) : Math.max(target, a - change)
      alpha[i] = v
      if (v < 0.01) continue
      ctx.globalAlpha = v * MAX
      ctx.fillRect((i % cols) * SIZE, Math.floor(i / cols) * SIZE, SIZE - GAP, SIZE - GAP)
    }
    ctx.globalAlpha = 1
  }
  return { resize, draw }
}

export function DebriefLoader({ view, plain = false }: DebriefLoaderProps): React.ReactElement {
  const rootRef = useRef<HTMLDivElement>(null)
  const speakers = useCallSpeakers(view.sessionId)
  const viewRef = useRef(view)
  const speakersRef = useRef(speakers)
  viewRef.current = view
  speakersRef.current = speakers

  useEffect(() => {
    const found = rootRef.current
    if (!found) return undefined
    const el: HTMLDivElement = found
    const q = <T extends HTMLElement>(sel: string): T | null => el.querySelector<T>(sel)
    const canvas = q<HTMLCanvasElement>('.bs-dl-life')
    const life = canvas ? lifeCanvas(canvas) : null
    const seenAt: Partial<Record<StepKey, number>> = {}
    let shown = 0, lastStep = -1, lastFrame = 0, frame = 0, tick = 0, lineNo = 0, typedAt = 0, lastAt = 0
    let ro: ResizeObserver | null = null

    const names = (): string[] => {
      const list = speakersRef.current.filter(Boolean)
      return list.length ? list : ['Speaker 1', 'Speaker 2', 'Speaker 3']
    }

    // One "typed" line: initials, a time in the call, and bars that grow in.
    function typeLine() {
      const list = q('[data-dl-lines]')
      if (!list) return
      const who = names()
      const w = (lineNo * 7 + Math.floor(Math.random() * 3)) % who.length
      const dur = viewRef.current.debrief?.durationMs || 0
      // Times in the call only go forward, and start over at the top when they pass its end.
      let next = lastAt + 4000 + Math.random() * 11000
      if (dur && next > dur) next = Math.random() * 20000
      lastAt = next
      const row = document.createElement('div')
      row.className = `bs-dl-line${Math.random() > 0.75 ? ' is-indent' : ''}`
      const b = document.createElement('b')
      b.className = `tone-${w % TONES}`
      b.textContent = initials(who[w] || '?')
      const t = document.createElement('time')
      t.textContent = loaderClock(next)
      const span = document.createElement('span')
      for (let i = 0, n = 2 + Math.floor(Math.random() * 4); i < n; i++) {
        const u = document.createElement('u')
        u.className = `tone-${Math.floor(Math.random() * TONES)}`
        // A custom property, not a style: the stylesheet sets the width from it.
        u.style.setProperty('--w', `${30 + Math.floor(Math.random() * 110)}px`)
        span.appendChild(u)
      }
      row.append(b, t, span)
      list.appendChild(row)
      requestAnimationFrame(() => row.classList.add('is-in'))
      while (list.children.length > MAX_LINES) list.firstElementChild?.remove()
      lineNo++
    }

    function render(now: number) {
      const v = viewRef.current
      const steps = v.debrief?.steps || []
      const info: DebriefInfo = {
        endedAt: v.endedAt ? Date.parse(v.endedAt) : null,
        durationMs: v.debrief?.durationMs || 0,
        steps,
        seenAt,
      }
      const cur = steps.find((s) => s.state !== 'done')
      if (cur && seenAt[cur.key] == null) seenAt[cur.key] = now
      const state = estimate(info, now)
      const reduced = reducedMotion()
      shown = glide(shown, state.percent, lastFrame ? now - lastFrame : 0, reduced)
      lastFrame = now
      const step = steps[state.step]
      const label = step ? step.label : 'Writing the minutes'

      const fill = q('[data-dl-fill]')
      if (fill) fill.style.setProperty('--p', `${shown.toFixed(2)}%`)
      const bar = q('[data-dl-bar]')
      bar?.setAttribute('aria-valuenow', String(Math.round(shown)))
      bar?.setAttribute('aria-valuetext', `${Math.round(shown)}%, ${label}`)
      const watch = q('[data-dl-watch]')
      if (watch) watch.textContent = loaderClock(state.elapsedMs)
      const pct = q('[data-dl-pct]')
      if (pct) pct.textContent = `${Math.floor(shown)}%`
      const where = q('[data-dl-where]')
      if (where) where.textContent = step ? stepWhere(step.key, info.durationMs) : ''
      const left = q('[data-dl-left]')
      if (left) left.textContent = state.done ? 'Done' : state.over ? 'Taking longer than usual' : minutesLeft(state.leftMs)
      const est = q('[data-dl-est]')
      if (est) est.hidden = state.over || state.done

      el.querySelectorAll<HTMLElement>('[data-dl-step]').forEach((li, i) => {
        const s = steps[i]
        const isNow = !state.done && i === state.step
        li.classList.toggle('is-done', s?.state === 'done')
        li.classList.toggle('is-now', isNow)
        const small = li.querySelector('small')
        if (!small || !s) return
        small.textContent = s.state === 'done'
          ? (s.key === 'left' && info.durationMs ? `${loaderClock(info.durationMs)} call` : s.value)
          : isNow ? loaderClock(state.inStepMs) : ''
      })

      if (state.step !== lastStep) {
        lastStep = state.step
        const status = q('[data-dl-status]')
        if (status) status.textContent = `${label}.`
      }
      // Lines type faster while the transcript is read back.
      const every = step?.key === 'transcript' ? 900 : 1600
      if (!reduced && now - typedAt > every) { typedAt = now; typeLine() }
    }

    function stop() {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      window.clearInterval(tick)
      tick = 0
      ro?.disconnect()
      ro = null
    }
    function loop(now: number) {
      frame = 0
      if (!el.isConnected) { stop(); return }
      if (document.visibilityState !== 'hidden') {
        life?.draw(now, !reducedMotion())
        render(Date.now())
      }
      frame = requestAnimationFrame(loop)
    }

    life?.resize()
    if (life && typeof ResizeObserver === 'function') { ro = new ResizeObserver(() => life.resize()); ro.observe(el) }
    for (let i = 0; i < 4; i++) typeLine()
    if (reducedMotion()) life?.draw(performance.now(), false)
    render(Date.now())
    if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(loop)
    // A one-second tick keeps the stopwatch moving when animation frames are slowed down.
    tick = window.setInterval(() => { if (el.isConnected && document.visibilityState !== 'hidden') render(Date.now()) }, 1000)
    return stop
  }, [])

  const steps = view.debrief?.steps || []
  const dur = view.debrief?.durationMs || 0
  const sub = [runTitle(view), dur ? `${loaderClock(dur)} call` : ''].filter(Boolean).join(' · ')
  const Box = plain ? 'div' : Display
  return (
    <Box className={`bs-dl${plain ? ' is-plain' : ''}`}>
      <div ref={rootRef} className="bs-dl-in">
        <canvas className="bs-dl-life" aria-hidden="true" />
        <div className="bs-dl-head">
          <span className="bs-dl-wave" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => <i key={i} />)}
          </span>
          <div className="bs-dl-title">
            <span className="bs-lbl bs-dl-state"><Led tone="ai" /> The bot left · writing the minutes</span>
            <strong>{sub}</strong>
          </div>
          <div className="bs-dl-watch" aria-hidden="true">
            <b data-dl-watch>0:00</b>
            <small className="bs-lbl">since it left</small>
          </div>
        </div>
        <div className="bs-dl-page" aria-hidden="true">
          <div className="bs-dl-lines" data-dl-lines />
          <div className="bs-dl-cursor-row"><span className="bs-dl-cursor" /></div>
        </div>
        <div className="bs-dl-bar" role="progressbar" aria-label="Minutes progress" aria-valuemin={0} aria-valuemax={100} data-dl-bar>
          <i data-dl-fill />
        </div>
        <div className="bs-dl-meta">
          <span><strong data-dl-pct>0%</strong> · <span data-dl-where /></span>
          <span><span data-dl-left /> <i data-dl-est>(estimate)</i></span>
        </div>
        <ol className="bs-dl-steps">
          {steps.map((s, i) => <li key={s.key} data-dl-step={i}><span>{s.label}</span><small /></li>)}
        </ol>
        <p className="bs-dl-foot">
          {plain
            ? 'The summary, decisions and action items fill in on this page as they land. Times here are estimates.'
            : 'You can leave this page. It turns into the meeting on its own. Times here are estimates.'}
        </p>
        <p className="bs-sr" role="status" data-dl-status />
      </div>
    </Box>
  )
}

export default DebriefLoader
