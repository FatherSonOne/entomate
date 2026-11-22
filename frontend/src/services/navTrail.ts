/**
 * Breadcrumb trail for detail pages (meeting, project).
 *
 * A detail page's crumbs lead back to where the person opened it from:
 * Projects / Acme rollout / Kickoff when the meeting was opened from a project,
 * Tasks / Kickoff from Tasks, and Meetings / Kickoff when there is no trail
 * (a fresh tab, a pasted link). The origin of each detail path and the labels
 * of detail pages live in sessionStorage, so a reload keeps the trail.
 */

export interface Crumb {
  /** Link target, with the origin's query string kept (filters, tabs). */
  to: string
  label: string
}

export interface NavLocation {
  pathname: string
  search: string
}

/** Pages a crumb can lead back to, by pathname. */
export const SECTION_LABELS: Readonly<Record<string, string>> = {
  '/dashboard': 'Today',
  '/meetings': 'Meetings',
  '/projects': 'Projects',
  '/tasks': 'Tasks',
  '/automations': 'Automations',
  '/analytics': 'Insights',
  '/search': 'Search',
  '/calendar': 'Calendar',
  '/bot': 'Bot',
  '/guide': 'User Guide',
}

/** Detail routes and the section each one belongs to. */
const DETAIL_ROUTES: ReadonlyArray<{ pattern: RegExp; section: string; noun: string }> = [
  { pattern: /^\/meetings\/[^/]+$/, section: '/meetings', noun: 'Meeting' },
  { pattern: /^\/projects\/[^/]+$/, section: '/projects', noun: 'Project' },
]

const STORAGE_KEY = 'ento.crumbs.v1'
const MAX_ENTRIES = 60

interface TrailStore {
  /** Detail pathname → the path (with query) it was opened from. */
  origins: Record<string, string>
  /** Detail pathname → its title, for when it becomes someone's origin. */
  labels: Record<string, string>
}

const trimSlash = (p: string): string => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p)

const detailRoute = (pathname: string) => DETAIL_ROUTES.find((r) => r.pattern.test(trimSlash(pathname)))

export const isDetailPath = (pathname: string): boolean => detailRoute(pathname) !== undefined

const isSectionPath = (pathname: string): boolean => trimSlash(pathname) in SECTION_LABELS

function readStore(): TrailStore {
  try {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null
    if (!raw) return { origins: {}, labels: {} }
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const p = parsed as Partial<TrailStore>
      return {
        origins: p.origins && typeof p.origins === 'object' ? p.origins : {},
        labels: p.labels && typeof p.labels === 'object' ? p.labels : {},
      }
    }
  } catch {
    // Storage blocked or corrupt: the trail falls back to the section root.
  }
  return { origins: {}, labels: {} }
}

/** Keep the newest entries only, so the store cannot grow without bound. */
function capped(map: Record<string, string>): Record<string, string> {
  const keys = Object.keys(map)
  if (keys.length <= MAX_ENTRIES) return map
  return Object.fromEntries(keys.slice(keys.length - MAX_ENTRIES).map((k) => [k, map[k] as string]))
}

// Crumbs re-read the trail when it changes (the recorder writes after the page renders).
let version = 0
const listeners = new Set<() => void>()

export function subscribeTrail(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const trailVersion = (): number => version

function writeStore(store: TrailStore): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ origins: capped(store.origins), labels: capped(store.labels) }))
  } catch {
    // Private mode or quota: crumbs still work for this render from defaults.
  }
  version += 1
  listeners.forEach((l) => l())
}

/** Re-insert so the key moves to the end (newest) before capping. */
function put(map: Record<string, string>, key: string, value: string): void {
  delete map[key]
  map[key] = value
}

/**
 * Record a navigation. A detail page opened by a link remembers where it came
 * from; crumb links (state.crumb) and back/forward keep the trail as it was.
 */
export function recordNavigation(
  prev: NavLocation | null,
  next: NavLocation,
  navType: 'PUSH' | 'REPLACE' | 'POP',
  fromCrumb: boolean,
): void {
  if (!prev || navType === 'POP' || fromCrumb) return
  const nextPath = trimSlash(next.pathname)
  const prevPath = trimSlash(prev.pathname)
  if (!isDetailPath(nextPath) || prevPath === nextPath) return
  const store = readStore()
  if (isSectionPath(prevPath) || isDetailPath(prevPath)) put(store.origins, nextPath, prevPath + prev.search)
  else delete store.origins[nextPath]
  writeStore(store)
}

/** Remember a detail page's title so crumbs that lead back to it can name it. */
export function rememberLabel(pathname: string, label: string): void {
  const path = trimSlash(pathname)
  const store = readStore()
  if (store.labels[path] === label) return
  put(store.labels, path, label)
  writeStore(store)
}

function sectionCrumb(path: string, search = ''): Crumb {
  return { to: path + search, label: SECTION_LABELS[path] ?? path }
}

function splitPath(full: string): NavLocation {
  const i = full.indexOf('?')
  return i === -1 ? { pathname: full, search: '' } : { pathname: full.slice(0, i), search: full.slice(i) }
}

/**
 * The links before the current page, oldest first. One step of history at
 * most: the origin, and the origin's section when the origin is itself a
 * detail page (Projects / Acme rollout).
 */
export function trailFor(pathname: string): Crumb[] {
  const path = trimSlash(pathname)
  const route = detailRoute(path)
  if (!route) return []
  const store = readStore()
  const origin = store.origins[path]
  if (!origin) return [sectionCrumb(route.section)]

  const { pathname: oPath, search: oSearch } = splitPath(origin)
  if (isSectionPath(oPath)) return [sectionCrumb(oPath, oSearch)]

  const oRoute = detailRoute(oPath)
  if (!oRoute) return [sectionCrumb(route.section)]
  return [
    sectionCrumb(oRoute.section),
    { to: oPath + oSearch, label: store.labels[oPath] ?? oRoute.noun },
  ]
}
