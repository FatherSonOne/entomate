/**
 * Logo systems: the 17 illustrated marks from the Entomate Complete Logo
 * System (2026-11-21), each paired with the shared vector wordmark and its own
 * loading motion (components/logoMotion.js). The pick is per browser, like the
 * theme and palette, and is read by the shell, Logo.jsx and the loading screen.
 *
 * Assets live in public/brand/:
*   <id>-128|256|512|1024.webp  full symbol on a square canvas (the motion's viewBox)
 *   <id>-small.webp        tight crop for the 22-28px rail and toolbar marks
 */
import { useSyncExternalStore } from 'react'

export type LogoFamily = 'orbits' | 'circuits' | 'fields'

export interface LogoSystem {
  id: string
  name: string
  family: LogoFamily
  /** Name of its loading motion, from logoMotion.js. */
  motion: string
  note: string
}

export const LOGO_FAMILIES: ReadonlyArray<{ id: LogoFamily; label: string }> = [
  { id: 'orbits', label: 'Orbits' },
  { id: 'circuits', label: 'Circuits' },
  { id: 'fields', label: 'Fields' },
]

export const LOGO_SYSTEMS: ReadonlyArray<LogoSystem> = [
  { id: 'relay-orbits', name: 'Relay Orbits', family: 'orbits', motion: 'Orbital handoff', note: 'Nested circuits counter-rotate around a shared signal axis.' },
  { id: 'relay', name: 'Relay', family: 'orbits', motion: 'Signal relay', note: 'A counter-orbit carries a signal between the satellite cores.' },
  { id: 'orbit', name: 'Orbit', family: 'orbits', motion: 'Ribbon exchange', note: 'Two opposing currents follow the intertwined ribbon paths.' },
  { id: 'orbital-network', name: 'Orbital Network', family: 'orbits', motion: 'Network convergence', note: 'Satellite signals return to the core along connected routes.' },
  { id: 'constellation', name: 'Constellation', family: 'orbits', motion: 'Connected cores', note: 'Signals circulate between the satellites and the central core.' },
  { id: 'trinity', name: 'Trinity', family: 'orbits', motion: 'Three-part harmony', note: 'The three orbital regions activate in a measured sequence.' },
  { id: 'circuit-e', name: 'Circuit E', family: 'circuits', motion: 'Sequential execution', note: 'The three E bars charge in sequence, connecting their nodes.' },
  { id: 'circuit-spire', name: 'Circuit Spire', family: 'circuits', motion: 'Circuit ascent', note: 'Energy rises through the routing spine and returns along the branch.' },
  { id: 'catalyst-core', name: 'Catalyst Core', family: 'circuits', motion: 'Catalyst lock', note: 'Counter-rotating circuit rings resolve around a steady core.' },
  { id: 'routed-signal', name: 'Routed Signal', family: 'circuits', motion: 'Routed charge', note: 'Staggered pulses travel along the horizontal routes.' },
  { id: 'ignition', name: 'Ignition', family: 'circuits', motion: 'Agent ignition', note: 'The core gathers energy while its tracking arc revolves.' },
  { id: 'aperture', name: 'Aperture', family: 'fields', motion: 'Aperture calibration', note: 'The crescent calibrates while a highlight completes the orbit.' },
  { id: 'bloom', name: 'Bloom', family: 'fields', motion: 'Living bloom', note: 'Four lobes breathe in sequence around the shared centre.' },
  { id: 'flow-field', name: 'Flow Field', family: 'fields', motion: 'Vortex flow', note: 'Four currents turn in opposing directions within the field.' },
  { id: 'neural-core', name: 'Neural Core', family: 'fields', motion: 'Neural exchange', note: 'A living core exchanges signals with its circuitry.' },
  { id: 'ribbon-catalyst', name: 'Ribbon Catalyst', family: 'fields', motion: 'Ribbon circulation', note: 'Two currents follow the torus while its rim rocks gently.' },
  { id: 'signal-cascade', name: 'Signal Cascade', family: 'fields', motion: 'Signal cascade', note: 'Concentric ripples carry the signal outward from the centre.' },
]

export const DEFAULT_LOGO = 'relay-orbits'
export const LOGO_KEY = 'entomate-logo'

const IDS = new Set(LOGO_SYSTEMS.map((l) => l.id))

export function isLogoId(id: unknown): id is string {
  return typeof id === 'string' && IDS.has(id)
}

export function logoById(id: string): LogoSystem {
  return LOGO_SYSTEMS.find((l) => l.id === id) ?? (LOGO_SYSTEMS.find((l) => l.id === DEFAULT_LOGO) as LogoSystem)
}

export function logosInFamily(family: LogoFamily): LogoSystem[] {
  return LOGO_SYSTEMS.filter((l) => l.family === family)
}

export type LogoAssetSize = 128 | 256 | 512 | 1024 | 'small'

export function logoAsset(id: string, size: LogoAssetSize): string {
  return `/brand/${isLogoId(id) ? id : DEFAULT_LOGO}-${size}.webp`
}

/* ── Store: one value per browser, shared by every reader ── */
const listeners = new Set<() => void>()

function read(): string {
  try {
    const saved = typeof localStorage === 'undefined' ? null : localStorage.getItem(LOGO_KEY)
    return isLogoId(saved) ? saved : DEFAULT_LOGO
  } catch {
    return DEFAULT_LOGO
  }
}

let current = read()

export function getLogo(): string {
  return current
}

export function setLogo(id: string): void {
  if (!isLogoId(id) || id === current) return
  current = id
  try { localStorage.setItem(LOGO_KEY, id) } catch { /* storage blocked: keep it for this session */ }
  listeners.forEach((fn) => fn())
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  const onStorage = (e: StorageEvent): void => {
    if (e.key !== LOGO_KEY) return
    current = read()
    fn()
  }
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(fn)
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
  }
}

/** The logo system in use in this browser; re-renders when it changes (also across tabs). */
export function useLogoSystem(): LogoSystem {
  const id = useSyncExternalStore(subscribe, getLogo, () => DEFAULT_LOGO)
  return logoById(id)
}

/** Test hook: re-read storage. */
export function __resetLogoForTests(): void {
  current = read()
}
