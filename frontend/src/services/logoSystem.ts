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
  { id: 'relay-orbits', name: 'Relay Orbits', family: 'orbits', motion: 'Orbital handoff', note: 'The crescent winds back and spins a full turn; the axis fires.' },
  { id: 'relay', name: 'Relay', family: 'orbits', motion: 'Signal relay', note: 'The outer cores lunge in and hand the signal to the ring.' },
  { id: 'orbit', name: 'Orbit', family: 'orbits', motion: 'Ribbon exchange', note: 'The ribbon mass rocks on its axis and throws off a wave.' },
  { id: 'orbital-network', name: 'Orbital Network', family: 'orbits', motion: 'Network convergence', note: 'Satellites spin in to dock; the core ratchets as each arrives.' },
  { id: 'constellation', name: 'Constellation', family: 'orbits', motion: 'Connected cores', note: 'The dial carries its cores round in three clicks.' },
  { id: 'trinity', name: 'Trinity', family: 'orbits', motion: 'Three-part harmony', note: 'The upper rings spin in turn; the lower orbit tilts.' },
  { id: 'circuit-e', name: 'Circuit E', family: 'circuits', motion: 'Sequential execution', note: 'Each node fires and its bar shoots out from the spine.' },
  { id: 'circuit-spire', name: 'Circuit Spire', family: 'circuits', motion: 'Circuit ascent', note: 'The circuit builds upward behind a charged edge.' },
  { id: 'catalyst-core', name: 'Catalyst Core', family: 'circuits', motion: 'Catalyst lock', note: 'The rings spin apart and snap back into alignment.' },
  { id: 'routed-signal', name: 'Routed Signal', family: 'circuits', motion: 'Routed charge', note: 'Each route draws out to its terminal, which pops.' },
  { id: 'ignition', name: 'Ignition', family: 'circuits', motion: 'Agent ignition', note: 'The core compresses, then fires a shock wave.' },
  { id: 'aperture', name: 'Aperture', family: 'fields', motion: 'Aperture calibration', note: 'The crescent dial clicks round in calibrated steps.' },
  { id: 'bloom', name: 'Bloom', family: 'fields', motion: 'Living bloom', note: 'The bloom swells and each lobe charges in turn.' },
  { id: 'flow-field', name: 'Flow Field', family: 'fields', motion: 'Vortex flow', note: 'The four vortices whip round in turn, like gears.' },
  { id: 'neural-core', name: 'Neural Core', family: 'fields', motion: 'Neural exchange', note: 'The core charges and pushes a pulse through the loops.' },
  { id: 'ribbon-catalyst', name: 'Ribbon Catalyst', family: 'fields', motion: 'Ribbon circulation', note: 'The torus winds back, then turns a third with a surge.' },
  { id: 'signal-cascade', name: 'Signal Cascade', family: 'fields', motion: 'Signal cascade', note: 'The rings themselves ripple outward from the core.' },
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
