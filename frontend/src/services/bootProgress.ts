/**
 * First-load progress (2026-11-22). On a full page load into the app, the
 * loading screen reports the real stages the app goes through, in order:
 *
 *   App        the app's code has downloaded and started (measured from navigation start)
 *   Session    Supabase has restored (or completed) the sign-in
 *   Workspace  the organisation has loaded
 *   Page       the first page's code has loaded and the shell is drawn
 *
 * Each stage is marked done by the code that actually finishes it
 * (ProtectedRoute, OrgSetupGate, BootMark in Layout). Progress is the
 * weight of the stages that are done, plus a slow creep inside the current
 * stage that never reaches its end, so the bar keeps moving without ever
 * claiming a stage that has not happened. Later navigation never shows it.
 */
import { useSyncExternalStore } from 'react'

export type BootStageId = 'app' | 'session' | 'workspace' | 'page'
export type BootPhase = 'idle' | 'loading' | 'done' | 'aborted'

export interface BootStage {
  id: BootStageId
  label: string
  weight: number
  /** performance.now() when it finished, null while waiting. */
  doneAt: number | null
}

export interface BootState {
  phase: BootPhase
  /** True while the boot loader is on screen; gate loaders draw only their ground under it. */
  covering: boolean
  stages: ReadonlyArray<BootStage>
}

const WEIGHTS: Record<BootStageId, number> = { app: 15, session: 30, workspace: 30, page: 25 }
/** Inside a stage the bar creeps toward, never past, this share of the stage. */
const CREEP_SHARE = 0.8
const CREEP_MS = 900

/** Routes in App.jsx that sit inside ProtectedRoute + OrgSetupGate + Layout. */
const SHELL_SECTIONS = new Set([
  'dashboard', 'meetings', 'projects', 'project-dashboard', 'tasks', 'automations', 'workflows',
  'agents', 'goals', 'analytics', 'insights', 'reports', 'calendar', 'search', 'settings', 'bot',
  'bot-launcher', 'guide',
])

/** Public pages: the boot loader never covers these. */
export function isPublicPath(path: string): boolean {
  return ['/', '/privacy', '/terms', '/sign-in', '/data-deletion'].includes(path) || path.startsWith('/opt-out/') || path.startsWith('/meet/')
}

/** The stages a first load into `path` goes through, or null when it is not an app page. */
export function planFor(path: string): BootStage[] | null {
  const clean = path.replace(/\/+$/, '') || '/'
  if (isPublicPath(clean)) return null
  const stage = (id: BootStageId, label: string): BootStage => ({ id, label, weight: WEIGHTS[id], doneAt: null })
  if (clean === '/auth/callback') {
    return [stage('app', 'App'), stage('session', 'Sign-in'), stage('workspace', 'Workspace'), stage('page', 'Page')]
  }
  const [, first, second] = clean.split('/')
  // The workflow builder is outside the shell: no workspace gate, its own loader after sign-in
  if (first === 'workflows' && second) return [stage('app', 'App'), stage('session', 'Session')]
  if (!first || !SHELL_SECTIONS.has(first)) return null
  return [stage('app', 'App'), stage('session', 'Session'), stage('workspace', 'Workspace'), stage('page', 'Page')]
}

let state: BootState = { phase: 'idle', covering: false, stages: [] }
const listeners = new Set<() => void>()

function set(next: BootState): void {
  state = next
  listeners.forEach((fn) => fn())
}

const now = (): number => (typeof performance === 'undefined' ? Date.now() : performance.now())

/**
 * Boot: decide from the URL whether this load shows progress. The App stage
 * is already done when this runs; its time is how long the code took to arrive.
 */
export function initBoot(path: string = typeof window === 'undefined' ? '/' : window.location.pathname, at: number = now()): void {
  const plan = planFor(path)
  if (!plan) {
    set({ phase: 'idle', covering: false, stages: [] })
    return
  }
  const [app] = plan
  if (app) app.doneAt = at
  set({ phase: 'loading', covering: true, stages: plan })
}

/** Mark a stage done. Earlier stages are done too (the page cannot load before the session). */
export function markBoot(id: BootStageId, at: number = now()): void {
  if (state.phase !== 'loading') return
  const index = state.stages.findIndex((s) => s.id === id)
  if (index < 0 || state.stages[index]?.doneAt !== null) return
  const stages = state.stages.map((s, i) => (i <= index && s.doneAt === null ? { ...s, doneAt: at } : s))
  const done = stages.every((s) => s.doneAt !== null)
  set({ ...state, stages, phase: done ? 'done' : 'loading' })
}

/**
 * End the boot early. 'done': the app is usable without the later stages
 * (no workspace yet, so the setup wizard shows). 'aborted': the load went
 * somewhere public (signed out), so the loader just leaves.
 */
export function endBoot(reason: 'done' | 'aborted', at: number = now()): void {
  if (state.phase !== 'loading') return
  const stages = reason === 'done' ? state.stages.map((s) => (s.doneAt === null ? { ...s, doneAt: at } : s)) : state.stages
  set({ ...state, stages, phase: reason })
}

/** The boot loader calls this once its exit transition has finished. */
export function uncoverBoot(): void {
  if (state.covering) set({ ...state, covering: false })
}

export function getBoot(): BootState {
  return state
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function useBoot(): BootState {
  return useSyncExternalStore(subscribe, getBoot, getBoot)
}

/**
 * 0-100. Done stages count in full; the first unfinished stage creeps toward
 * CREEP_SHARE of its weight. 100 only when every stage is done.
 */
export function bootProgress(stages: ReadonlyArray<BootStage>, at: number = now(), creep = true): number {
  const total = stages.reduce((sum, s) => sum + s.weight, 0)
  if (!total) return 0
  let value = 0
  let lastDone = 0
  for (const s of stages) {
    if (s.doneAt !== null) {
      value += s.weight
      lastDone = Math.max(lastDone, s.doneAt)
      continue
    }
    if (creep) value += s.weight * CREEP_SHARE * (1 - Math.exp(-Math.max(0, at - lastDone) / CREEP_MS))
    break
  }
  return Math.min(100, (value / total) * 100)
}

/** How long each stage took, in ms (App: since navigation start). */
export function stageDurations(stages: ReadonlyArray<BootStage>): Array<number | null> {
  let prev = 0
  return stages.map((s) => {
    if (s.doneAt === null) return null
    const d = Math.max(0, s.doneAt - prev)
    prev = s.doneAt
    return d
  })
}

/** Test hook. */
export function __resetBootForTests(): void {
  state = { phase: 'idle', covering: false, stages: [] }
  listeners.clear()
}
