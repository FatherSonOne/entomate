import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, test, expect, vi } from 'vitest'
const http = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('../services/api', () => ({ default: http, searchApi: {} }))
import { useSearch } from '../hooks/useSearch'

describe('shared Search request lifecycle', () => {
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
})
