import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'
const http = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('../services/api', () => ({ default: http, searchApi: {} }))
import { useSearch } from '../hooks/useSearch'

describe('shared Search request lifecycle', () => {
  test('a new query reports pending on its first render, before the request effect runs', async () => {
    http.post.mockResolvedValue({ query: 'pricing', total: 0, groups: {} })
    const seen: Array<{ query: string; loading: boolean }> = []
    const { result, rerender } = renderHook(({ query }) => {
      const search = useSearch(query, { debounceMs: 0 })
      seen.push({ query, loading: search.loading })
      return search
    }, { initialProps: { query: 'pricing' } })
    await waitFor(() => expect(result.current.data?.query).toBe('pricing'))
    rerender({ query: 'budget' })
    expect(seen.find(row => row.query === 'budget')?.loading).toBe(true)
  })

  test('closing drops an in-flight response and reopening does not expose stale records', async () => {
    let resolve!: (v: unknown) => void
    http.post.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const { result, rerender } = renderHook(({ enabled }) => useSearch('pricing', { enabled, debounceMs: 0 }), { initialProps: { enabled: true } })
    await waitFor(() => expect(http.post).toHaveBeenCalled())
    rerender({ enabled: false })
    await act(async () => resolve({ query: 'pricing', total: 1, groups: { notes: [{ id: 'private-clip' }] } }))
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  test('a failed current request settles and exposes its error instead of staying pending', async () => {
    http.post.mockRejectedValueOnce(new Error('Offline'))
    const { result } = renderHook(() => useSearch('budget', { debounceMs: 0 }))
    await waitFor(() => expect(result.current.error).toBe('Offline'))
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeNull()
  })
})
