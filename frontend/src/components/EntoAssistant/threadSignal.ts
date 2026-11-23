/**
 * threadSignal — how the history page (EAI-02c slice 4) talks to the assistant panel.
 *
 * The panel is lazy-loaded inside Layout and owns the open conversation; the page is a route
 * beside it. Same shape as voiceSignal: a module singleton, because the two never share a
 * parent closer than Layout and a prop detour would remount nothing useful.
 *
 * - requestThread(id) asks the panel to show that conversation (null = a new one). The page
 *   opens the panel itself (Layout's openAssistant). If the panel has not mounted yet, the
 *   request parks and the first subscriber takes it.
 * - announceThreadsDeleted(ids) tells a mounted panel that the page deleted conversations, so
 *   it drops them from the rail and leaves one it was showing. Unmounted, nothing to tell.
 */

export type ThreadRequest = { id: string | null }

let pending: ThreadRequest | null = null
const requestListeners = new Set<(req: ThreadRequest) => void>()
const deleteListeners = new Set<(ids: string[]) => void>()

export function requestThread(id: string | null): void {
  const req = { id }
  if (requestListeners.size > 0) {
    pending = null
    requestListeners.forEach((fn) => fn(req))
    return
  }
  pending = req
}

export function onThreadRequest(fn: (req: ThreadRequest) => void): () => void {
  requestListeners.add(fn)
  // Fired a tick later, on the mount that stays: StrictMode mounts the panel twice (voiceSignal).
  const parked = pending
    ? setTimeout(() => {
        const req = pending
        if (!req) return // a newer request already reached this listener
        pending = null
        fn(req)
      }, 0)
    : undefined
  return () => {
    clearTimeout(parked)
    requestListeners.delete(fn)
  }
}

export function announceThreadsDeleted(ids: string[]): void {
  if (ids.length) deleteListeners.forEach((fn) => fn(ids))
}

export function onThreadsDeleted(fn: (ids: string[]) => void): () => void {
  deleteListeners.add(fn)
  return () => {
    deleteListeners.delete(fn)
  }
}
