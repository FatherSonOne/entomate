/**
 * Logo systems, each paired with the shared vector wordmark and its own
 * loading motion. The shell, Logo.jsx and the loading screen share one choice.
 *
 * The raster marks live in public/brand/:
 *   <id>-128|256|512|1024.webp  full symbol on a square canvas (the motion's viewBox)
 *   <id>-small.webp        tight crop for the 22-28px rail and toolbar marks
 */
import { useSyncExternalStore } from 'react'
import relayOrbitsAsset from '../assets/relay-orbits.svg?no-inline'
import relayAsset from '../assets/relay.svg?no-inline'
import orbitalNetworkCompactAsset from '../assets/orbital-network-compact.svg?no-inline'
import constellationCompactAsset from '../assets/constellation-compact.svg?no-inline'
import thresholdAsset from '../assets/threshold.svg?no-inline'
import slipstreamAsset from '../assets/slipstream.svg?no-inline'
import nodeHandsAsset from '../assets/node-hands.svg?no-inline'
import facetHandsAsset from '../assets/facet-hands.svg?no-inline'
import ignitionCompactAsset from '../assets/ignition-compact.svg?no-inline'
import apertureCompactAsset from '../assets/aperture-compact.svg?no-inline'
import bloomCompactAsset from '../assets/bloom-compact.svg?no-inline'
import riftAsset from '../assets/rift.svg?no-inline'
import neuralCoreCompactAsset from '../assets/neural-core-compact.svg?no-inline'
import ribbonCatalystCompactAsset from '../assets/ribbon-catalyst-compact.svg?no-inline'
import signalCascadeCompactAsset from '../assets/signal-cascade-compact.svg?no-inline'

export type LogoFamily = 'orbits' | 'circuits' | 'fields'

export interface LogoSystem {
  id: string
  name: string
  family: LogoFamily
  /** Name of its loading motion. */
  motion: string
  note: string
}

export const LOGO_FAMILIES: ReadonlyArray<{ id: LogoFamily; label: string }> = [
  { id: 'orbits', label: 'Orbits' },
  { id: 'circuits', label: 'Circuits' },
  { id: 'fields', label: 'Fields' },
]

export const RELAY_ORBITS_ID = 'relay-orbits'
export const RELAY_ID = 'relay'
export const ORBIT_ID = 'orbit'
export const ORBITAL_NETWORK_ID = 'orbital-network'
export const CONSTELLATION_ID = 'constellation'
// Preserve the saved selection ID for browsers that selected Trinity.
export const THRESHOLD_ID = 'trinity'
export const SLIPSTREAM_ID = 'slipstream'
export const NODE_HANDS_ID = 'catalyst-core'
export const FACET_HANDS_ID = 'routed-signal'
export const IGNITION_ID = 'ignition'
export const APERTURE_ID = 'aperture'
export const BLOOM_ID = 'bloom'
// Keep the saved selection ID for browsers that selected Flow Field.
export const RIFT_ID = 'flow-field'
export const NEURAL_CORE_ID = 'neural-core'
export const RIBBON_CATALYST_ID = 'ribbon-catalyst'
export const SIGNAL_CASCADE_ID = 'signal-cascade'

export const LOGO_SYSTEMS: ReadonlyArray<LogoSystem> = [
  { id: RELAY_ORBITS_ID, name: 'Relay Orbits', family: 'orbits', motion: 'Signal handoff', note: 'The crescent flexes as the core catches a crimson pulse, then releases it in mint.' },
  { id: RELAY_ID, name: 'Relay', family: 'orbits', motion: 'Resonant exchange', note: 'The twin nodes arc inward, bending the ring. Two currents travel around its rim and send the nodes back out.' },
  { id: ORBIT_ID, name: 'Orbit', family: 'orbits', motion: 'Ribbon exchange', note: 'The cyan curl flexes first, the crimson curl answers, and the wave rolls through the lower ribbon.' },
  { id: ORBITAL_NETWORK_ID, name: 'Orbital Network', family: 'orbits', motion: 'Network convergence', note: 'Vapor curls around the rings, dust follows the outer orbit, and four light signals converge at the hub.' },
  { id: CONSTELLATION_ID, name: 'Constellation', family: 'orbits', motion: 'Triangulation', note: 'Three scopes trace a star chart, then a sheet of light crosses the glass dial.' },
  { id: THRESHOLD_ID, name: 'Threshold', family: 'orbits', motion: 'Gate ignition', note: 'Mint signals gather at the copper seam and send a pressure wave through the crimson chamber.' },
  { id: SLIPSTREAM_ID, name: 'Slipstream', family: 'orbits', motion: 'Current capture', note: 'A pulse follows the crimson swirl from its outer tip into the mint center.' },
  { id: 'circuit-e', name: 'Circuit E', family: 'circuits', motion: 'Pulse routing', note: 'Light flows through the three bars and forks into the branch nodes.' },
  { id: 'circuit-spire', name: 'Circuit Crown', family: 'circuits', motion: 'Crown induction', note: 'Copper light climbs the wire hands and lifts the crown in a wake of vapor and embers.' },
  { id: NODE_HANDS_ID, name: 'Node Hands', family: 'circuits', motion: 'Fingertip relay', note: 'A filament carries light between the fingertips and sends a wave down the three bars.' },
  { id: FACET_HANDS_ID, name: 'Facet Hands', family: 'circuits', motion: 'Facet refraction', note: 'The palms open as light climbs the facets and vapor curls off the fingertips.' },
  { id: IGNITION_ID, name: 'Ignition', family: 'circuits', motion: 'Thermal draft', note: 'Mint vapor gathers at the core, then heat and embers rise along the spire.' },
  { id: APERTURE_ID, name: 'Aperture', family: 'fields', motion: 'Optical focus', note: 'Light travels along the crescent, then a curved sheet gathers into the offset lens.' },
  { id: BLOOM_ID, name: 'Bloom', family: 'fields', motion: 'Petal currents', note: 'Mint vapor unfurls the five glass lobes, then amber light flows back along the inner ribbon.' },
  { id: RIFT_ID, name: 'Rift', family: 'fields', motion: 'Tidal crossing', note: 'Teal and coral currents flow along the banks. A light crosses the bridge as vapor rises through the opening.' },
  { id: NEURAL_CORE_ID, name: 'Neural Core', family: 'fields', motion: 'Impulse cascade', note: 'The gold lattice sends ribbons of light through the fibre loops, passing behind the core and back into view.' },
  { id: RIBBON_CATALYST_ID, name: 'Ribbon Catalyst', family: 'fields', motion: 'Travelling fold', note: 'A fold travels through the glass ribbon in depth, catching rose and teal light as it turns.' },
  { id: SIGNAL_CASCADE_ID, name: 'Signal Cascade', family: 'fields', motion: 'Radial lift', note: 'Two ripples lift the copper rings outward from the core, scattering sparks as they pass the beacon.' },
]

export const DEFAULT_LOGO = RELAY_ORBITS_ID
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

const VECTOR_ARTWORK: Readonly<Partial<Record<string, { url: string; compact: string }>>> = {
  [RELAY_ORBITS_ID]: { url: relayOrbitsAsset, compact: 'relay-orbits-compact' },
  [RELAY_ID]: { url: relayAsset, compact: 'relay-mark-compact' },
  [THRESHOLD_ID]: { url: thresholdAsset, compact: 'threshold-compact' },
  [SLIPSTREAM_ID]: { url: slipstreamAsset, compact: 'slipstream-compact' },
  [NODE_HANDS_ID]: { url: nodeHandsAsset, compact: 'node-hands-compact' },
  [FACET_HANDS_ID]: { url: facetHandsAsset, compact: 'facet-hands-compact' },
  [RIFT_ID]: { url: riftAsset, compact: 'rift-mark-compact' },
}

export function logoAsset(id: string, size: LogoAssetSize): string {
  const logoId = isLogoId(id) ? id : DEFAULT_LOGO
  const vector = VECTOR_ARTWORK[logoId]
  if (vector) return size === 'small' ? `${vector.url}#${vector.compact}` : vector.url
  if (logoId === ORBITAL_NETWORK_ID && size === 'small') return orbitalNetworkCompactAsset
  if (logoId === CONSTELLATION_ID && size === 'small') return constellationCompactAsset
  if (logoId === IGNITION_ID && size === 'small') return ignitionCompactAsset
  if (logoId === APERTURE_ID && size === 'small') return apertureCompactAsset
  if (logoId === BLOOM_ID && size === 'small') return bloomCompactAsset
  if (logoId === NEURAL_CORE_ID && size === 'small') return neuralCoreCompactAsset
  if (logoId === RIBBON_CATALYST_ID && size === 'small') return ribbonCatalystCompactAsset
  if (logoId === SIGNAL_CASCADE_ID && size === 'small') return signalCascadeCompactAsset
  return `/brand/${logoId}-${size}.webp`
}

type SyncStatus = 'browser' | 'ready' | 'saving' | 'saved' | 'retry'
type CachedChoice = { id: string; source: 'legacy' | 'pending' | 'account' }
type AccountSync = { select: (id: string) => void; refresh: () => Promise<void> }

const listeners = new Set<() => void>()
let account: AccountSync | undefined
let status: SyncStatus = 'browser'

function readBrowserChoice(): string | undefined {
  try {
    const saved = localStorage.getItem(LOGO_KEY)
    return isLogoId(saved) ? saved : undefined
  } catch {
    return undefined
  }
}

function readAccountChoice(key: string): CachedChoice | undefined {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (isLogoId(saved?.id) && ['legacy', 'pending', 'account'].includes(saved.source)) return saved
  } catch { /* cache unavailable */ }
  return undefined
}

let current = readBrowserChoice() ?? DEFAULT_LOGO

function publish(id: string, nextStatus: SyncStatus): void {
  if (current === id && status === nextStatus) return
  current = id
  status = nextStatus
  listeners.forEach((fn) => fn())
}

/** Connect one authenticated account and keep writes bound to its session. */
export function connectLogoAccount(
  userId: string,
  sessionLogo: unknown,
  request: (logoId?: string) => Promise<unknown>,
): () => void {
  const key = `${LOGO_KEY}:${userId}`
  let legacy = readBrowserChoice()
  let choice: CachedChoice | undefined = readAccountChoice(key)
    ?? (isLogoId(sessionLogo) ? { id: sessionLogo, source: 'account' } : undefined)
    ?? (legacy ? { id: legacy, source: 'legacy' } : undefined)
  let reading = false
  let writing = false
  const active = (): boolean => account === connection

  const apply = (next: CachedChoice | undefined, nextStatus: SyncStatus): void => {
    choice = next
    try {
      if (next) localStorage.setItem(key, JSON.stringify(next))
      else localStorage.removeItem(key)
      if (legacy) {
        localStorage.removeItem(LOGO_KEY)
        legacy = undefined
      }
    } catch { /* the active session can still use the choice */ }
    publish(next?.id ?? DEFAULT_LOGO, nextStatus)
  }

  async function save(): Promise<void> {
    if (!active() || writing) return
    writing = true
    try {
      while (active() && choice?.source === 'pending') {
        const pending = choice
        publish(pending.id, 'saving')
        try {
          const saved = await request(pending.id)
          if (saved !== pending.id) throw new Error('Account did not confirm the logo choice')
          if (active() && choice === pending) apply({ id: pending.id, source: 'account' }, 'saved')
        } catch {
          if (active() && choice === pending) {
            publish(pending.id, 'retry')
            return
          }
        }
      }
    } finally {
      writing = false
    }
  }

  async function refresh(): Promise<void> {
    if (!active() || writing) return
    if (choice?.source === 'pending') return save()
    if (reading) return

    const before = choice
    reading = true
    try {
      const saved = await request()
      if (!active() || choice !== before) return
      if (isLogoId(saved)) apply({ id: saved, source: 'account' }, 'saved')
      else if (saved == null && before?.source === 'legacy') connection.select(before.id)
      else apply(undefined, 'ready')
    } catch {
      if (active() && choice === before) publish(current, 'retry')
    } finally {
      reading = false
    }
  }

  const connection: AccountSync = {
    select(id) {
      apply({ id, source: 'pending' }, 'saving')
      void save()
    },
    refresh,
  }
  account = connection
  apply(choice, choice?.source === 'pending' ? 'saving' : 'ready')
  const onVisible = (): void => { if (!document.hidden) void refresh() }
  const onOnline = (): void => { void refresh() }
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', onOnline)
  void refresh()

  return () => {
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', onOnline)
    if (!active()) return
    account = undefined
    publish(readBrowserChoice() ?? DEFAULT_LOGO, 'browser')
  }
}

export function getLogo(): string {
  return current
}

export function setLogo(id: string): void {
  if (!isLogoId(id) || id === current) return
  if (account) return account.select(id)
  try { localStorage.setItem(LOGO_KEY, id) } catch { /* storage blocked: keep it for this session */ }
  publish(id, 'browser')
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  const onStorage = (e: StorageEvent): void => {
    if (e.key === LOGO_KEY && !account) publish(readBrowserChoice() ?? DEFAULT_LOGO, 'browser')
  }
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(fn)
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
  }
}

/** The active mark and loading animation. */
export function useLogoSystem(): LogoSystem {
  const id = useSyncExternalStore(subscribe, getLogo, () => DEFAULT_LOGO)
  return logoById(id)
}

export function useLogoSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, () => status, () => 'browser' as SyncStatus)
}

export function retryLogoSync(): void {
  void account?.refresh()
}

/** Test hook: re-read storage. */
export function __resetLogoForTests(): void {
  account = undefined
  status = 'browser'
  current = readBrowserChoice() ?? DEFAULT_LOGO
}
