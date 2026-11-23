import { useCallback, useEffect, useRef, useState } from 'react'
import { entoAiApi } from '../../../services/api'
import { announceThreadsDeleted } from '../threadSignal'

/**
 * Data for the Ask Entomate history page (EAI-02c slice 4), ported from Logos AI's
 * useTranscriptHistory without pin, archive and rename (ento_ai_threads has no columns for
 * the first two, and its updated_at trigger would re-date a renamed conversation).
 *
 * Every read is GET /api/ento-ai/threads/search, which runs ento_ai_search_threads()
 * (SECURITY INVOKER) under the caller's JWT, so the table's owner-and-member policy decides.
 */

export const HISTORY_PAGE_SIZE = 50
const SEARCH_DEBOUNCE_MS = 250

export interface ThreadHistoryRow {
  id: string
  title: string | null
  created_at: string
  updated_at: string
  message_count: number
  /** Around the first message that matched the search; null when not searching. */
  snippet: string | null
}

interface SearchPage { threads?: ThreadHistoryRow[]; total?: number }

export function useThreadHistory(query: string) {
  const [rows, setRows] = useState<ThreadHistoryRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Only the newest request may write the list: typing fast fires several searches, and a slow
  // early one must not land on top of the answer to what is in the box now.
  const requestRef = useRef(0)
  const [debouncedQuery, setDebouncedQuery] = useState(query)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  const load = useCallback(async () => {
    const request = ++requestRef.current
    setLoading(true)
    setError(null)
    try {
      const page: SearchPage = await entoAiApi.threads.search(debouncedQuery, 0)
      if (request !== requestRef.current) return
      setRows(Array.isArray(page?.threads) ? page.threads : [])
      setTotal(Number(page?.total) || 0)
    } catch {
      if (request !== requestRef.current) return
      // A failed read is not "no conversations": the list empties and the banner says why.
      setRows([])
      setTotal(0)
      setError('Your conversations could not be loaded. Try again in a moment.')
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [debouncedQuery])

  useEffect(() => { void load() }, [load])

  const loadMore = useCallback(async () => {
    if (loadingMore || rows.length >= total) return
    const request = requestRef.current
    setLoadingMore(true)
    try {
      const page: SearchPage = await entoAiApi.threads.search(debouncedQuery, rows.length)
      if (request !== requestRef.current) return
      const more = Array.isArray(page?.threads) ? page.threads : []
      setRows((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        return [...prev, ...more.filter((r) => !seen.has(r.id))]
      })
      setTotal(Number(page?.total) || 0)
    } catch {
      setError('More conversations could not be loaded. Try again in a moment.')
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, rows.length, total, debouncedQuery])

  /**
   * Deletes one at a time through the rail's own DELETE route (a 404 is already gone, so it
   * counts as deleted). Stops at the first real failure; what was deleted stays deleted, and
   * the re-read shows exactly what is left.
   */
  const remove = useCallback(async (ids: string[]): Promise<boolean> => {
    const deleted: string[] = []
    let failed = false
    for (const id of ids) {
      try {
        await entoAiApi.threads.remove(id)
        deleted.push(id)
      } catch (err) {
        if ((err as { status?: number })?.status === 404) { deleted.push(id); continue }
        failed = true
        break
      }
    }
    // An open panel may be showing one of these; let it catch up.
    announceThreadsDeleted(deleted)
    await load()
    if (failed) {
      setError(ids.length > 1
        ? `${deleted.length} of ${ids.length} conversations were deleted. The rest could not be. Try again.`
        : 'That conversation could not be deleted. Try again.')
    }
    return !failed
  }, [load])

  return {
    rows, total, loading, loadingMore, error,
    searching: query !== debouncedQuery,
    loadMore, remove,
    dismissError: () => setError(null),
    retry: load,
  }
}
