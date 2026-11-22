/**
 * Stale-deploy recovery (2026-11-22).
 *
 * Every page is a lazy chunk with a hashed file name. A tab that loaded before
 * a deploy still asks for the old hashes when it switches page; the new deploy
 * no longer has them, so the import fails and the error screen showed until a
 * manual refresh. Here a failed chunk load reloads the page once, which picks
 * up the new build at the URL the user was going to.
 *
 * A reload within RELOAD_WINDOW_MS of the last one is not repeated, so a chunk
 * that is really broken still reaches the error screen instead of looping.
 */

const KEY = 'entomate-chunk-reload-at'
const RELOAD_WINDOW_MS = 10000

const CHUNK_ERROR = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|is not a valid JavaScript MIME type|ChunkLoadError|Loading chunk [\w-]+ failed/i

let pending = false

export function isChunkError(error: unknown): boolean {
  if (!error) return false
  const e = error as { name?: string; message?: string }
  return CHUNK_ERROR.test(`${e.name ?? ''} ${e.message ?? String(error)}`)
}

function lastReloadAt(): number {
  try { return Number(sessionStorage.getItem(KEY)) || 0 } catch { return 0 }
}

/** True while a recovery reload is on its way (show a quiet screen, not the error). */
export function chunkReloadPending(): boolean {
  return pending
}

/** Reloads once for a stale chunk. Returns false when it already tried just now. */
export function reloadForStaleChunk(): boolean {
  if (pending) return true
  if (Date.now() - lastReloadAt() < RELOAD_WINDOW_MS) return false
  pending = true
  try { sessionStorage.setItem(KEY, String(Date.now())) } catch { /* private mode: reload anyway */ }
  window.location.reload()
  return true
}

let installed = false

/** Call once at boot. Vite fires vite:preloadError when a lazy import or its CSS fails. */
export function installChunkReload(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('vite:preloadError', () => { reloadForStaleChunk() })
}
