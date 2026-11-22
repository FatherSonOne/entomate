/**
 * Loader handoff: tells the app when the last full-screen loading screen has
 * gone, so LoaderHandoff can morph its mark into the shell's brand mark.
 * Counting mounted loaders means a loader replaced by another one in the same
 * commit (session check, then page code) or a Strict Mode remount is not an
 * exit; only the moment no loader is left counts.
 */
type ExitListener = (logoId: string) => void

const listeners = new Set<ExitListener>()
let mounted = 0

export function loaderMounted(): void {
  mounted += 1
}

export function loaderUnmounted(logoId: string): void {
  mounted = Math.max(0, mounted - 1)
  queueMicrotask(() => {
    if (mounted === 0) listeners.forEach((fn) => fn(logoId))
  })
}

export function onLoaderExit(fn: ExitListener): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** Test hook. */
export function __resetLoaderHandoffForTests(): void {
  mounted = 0
  listeners.clear()
}
