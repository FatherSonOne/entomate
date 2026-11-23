/**
 * Shared hooks for the ⌘K palette and the Search page: one engine, one notes store.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { searchApi } from '../services/api'
import { recentFromHistory, searchEverything } from '../services/searchEngine'
import type { RecentSearch, SearchResponse } from '../services/searchEngine'
import {
  NOTES_CHANGED, clipKey, createNote, deleteNote, listNotes, updateNote,
} from '../services/searchNotesService'
import type { NewNote, SearchNote } from '../services/searchNotesService'

export interface UseSearchOptions {
  /** Wait this long after the last keystroke (palette types live). */
  debounceMs?: number
  /** Results per group. */
  limit?: number
  /** Record the query in search history. */
  log?: boolean
  /** Skip searching (palette closed). */
  enabled?: boolean
}

export interface UseSearchResult {
  data: SearchResponse | null
  loading: boolean
  error: string | null
  /** Query the current data belongs to. */
  settledQuery: string
}

/** Debounced shared search. Late responses for an older query are dropped. */
export function useSearch(query: string, opts: UseSearchOptions = {}): UseSearchResult {
  const { debounceMs = 180, limit = 8, log = false, enabled = true } = opts
  const [data, setData] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settledQuery, setSettledQuery] = useState('')
  const seq = useRef(0)

  useEffect(() => {
    const q = query.trim()
    if (!enabled || q.length < 2) {
      seq.current += 1
      setData(null)
      setLoading(false)
      setError(null)
      setSettledQuery('')
      return undefined
    }
    const id = ++seq.current
    setData(null)
    setError(null)
    setLoading(true)
    const t = window.setTimeout(() => {
      searchEverything(q, { limit, log })
        .then((resp) => {
          if (id !== seq.current) return
          setData(resp)
          setSettledQuery(q)
          setError(null)
        })
        .catch((e: unknown) => {
          if (id !== seq.current) return
          setError(e instanceof Error ? e.message : 'Search failed')
        })
        .finally(() => {
          if (id === seq.current) setLoading(false)
        })
    }, debounceMs)
    return () => { window.clearTimeout(t); seq.current += 1 }
  }, [query, debounceMs, limit, log, enabled])

  return { data: enabled && data?.query === query.trim() ? data : null, loading, error, settledQuery }
}

/** Recent searches from history. `reloadKey` refetches (after a logged search). */
export function useRecentSearches(enabled: boolean, reloadKey: string | number = 0): RecentSearch[] {
  const [recent, setRecent] = useState<RecentSearch[]>([])
  useEffect(() => {
    if (!enabled) return
    let live = true
    const api = searchApi as unknown as { getHistory: (limit: number) => Promise<{ history?: unknown }> }
    api.getHistory(30)
      .then((r) => { if (live) setRecent(recentFromHistory(r.history)) })
      .catch(() => { if (live) setRecent([]) })
    return () => { live = false }
  }, [enabled, reloadKey])
  return recent
}

export interface UseNotesResult {
  notes: SearchNote[]
  loading: boolean
  /** True when the list could not be read (not the same as "no notes"). */
  failed: boolean
  clipped: Set<string>
  add: (note: NewNote) => Promise<SearchNote>
  remove: (id: string) => Promise<void>
  edit: (id: string, body: string) => Promise<void>
  reload: () => void
}

export function useNotes(enabled = true): UseNotesResult {
  const [notes, setNotes] = useState<SearchNote[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const reload = useCallback(() => {
    listNotes()
      .then((n) => { setNotes(n); setFailed(false) })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    reload()
    const on = () => reload()
    window.addEventListener(NOTES_CHANGED, on)
    return () => window.removeEventListener(NOTES_CHANGED, on)
  }, [enabled, reload])

  const clipped = useMemo(() => new Set(notes.map((n) => clipKey(n))), [notes])

  const add = useCallback(async (note: NewNote) => {
    const n = await createNote(note)
    setNotes((prev) => [n, ...prev.filter((x) => x.id !== n.id)])
    return n
  }, [])

  const remove = useCallback(async (id: string) => {
    setNotes((prev) => prev.filter((x) => x.id !== id))
    try {
      await deleteNote(id)
    } catch (e) {
      reload()
      throw e
    }
  }, [reload])

  const edit = useCallback(async (id: string, body: string) => {
    const n = await updateNote(id, body)
    setNotes((prev) => prev.map((x) => (x.id === id ? n : x)))
  }, [])

  return { notes, loading, failed, clipped, add, remove, edit, reload }
}
