import React from 'react'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FollowUpLetter, useFollowUp } from '../components/meetings/FollowUpPanel'

const { load, mutate, success, error } = vi.hoisted(() => ({
  load: vi.fn<(id: string) => Promise<unknown>>(), mutate: vi.fn<() => Promise<unknown>>(), success: vi.fn(), error: vi.fn(),
}))
vi.mock('../services/api', () => ({ meetingsApi: {
  followUp: load, saveFollowUp: mutate, sendFollowUp: mutate, stopFollowUp: mutate, setFollowUpAutoSend: mutate,
} }))
vi.mock('../services/apiCache', () => ({ default: { invalidate: vi.fn() } }))
vi.mock('../components/vc/ToastProvider', () => ({ useToast: () => ({ success, error }) }))

const draft = {
  followUp: { id: 'f1', status: 'draft', subject: 'Follow-up: Q4', opening: 'Hi all', signoff: 'Thanks' },
  parts: {}, autoSend: false, mailReady: false, canSend: false,
}
function Panel() {
  return <FollowUpLetter state={useFollowUp('m1', true)} />
}

beforeEach(() => { vi.resetAllMocks() })
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('follow-up loading recovery', () => {
  it('shows the read error and retries in place, disabling retry while pending', async () => {
    load.mockRejectedValueOnce(new Error('Could not load the follow-up'))
    let resolve!: (value: typeof draft) => void
    load.mockImplementationOnce(() => new Promise((done) => { resolve = done }))
    render(<Panel />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the follow-up')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(screen.getByRole('button', { name: 'Retrying…' })).toBeDisabled()
    expect(load).toHaveBeenCalledTimes(2)
    await act(async () => { resolve(draft) })
    expect(await screen.findByRole('article', { name: 'Follow-up email' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(load.mock.calls).toEqual([['m1'], ['m1']])
  })

  it('keeps retry available when another read fails', async () => {
    load.mockRejectedValue(new Error('Network Error'))
    render(<Panel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled())
    expect(screen.getByRole('alert')).toHaveTextContent('Network Error')
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('distinguishes a successful empty draft from a load error', async () => {
    load.mockResolvedValue({ ...draft, followUp: null })
    render(<Panel />)
    expect(await screen.findByText('The follow-up is drafted as soon as the minutes are ready.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('does not load before the minutes are ready', () => {
    renderHook(() => useFollowUp('m1', false))
    expect(load).not.toHaveBeenCalled()
  })

  it('shows the server error when the client wraps it', async () => {
    load.mockRejectedValue({ message: 'Request failed', originalError: { response: { data: { error: 'Meeting access denied' } } } })
    render(<Panel />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Meeting access denied')
  })

  it('shows a retry error even when the last successful reply had no draft', async () => {
    load.mockResolvedValueOnce({ ...draft, followUp: null }).mockRejectedValueOnce(new Error('Read failed'))
    const { result } = renderHook(() => useFollowUp('m1', true))
    await waitFor(() => expect(result.current.data).not.toBeNull())
    await act(async () => { await result.current.retry() })
    render(<FollowUpLetter state={result.current} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Read failed')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
  })

  it('preserves the last draft on a failed scheduled refresh and recovers on retry', async () => {
    vi.useFakeTimers()
    load.mockResolvedValueOnce({ ...draft, followUp: { ...draft.followUp, status: 'scheduled', send_at: new Date().toISOString() } })
      .mockRejectedValueOnce(new Error('Refresh failed'))
      .mockResolvedValueOnce(draft)
    const { result } = renderHook(() => useFollowUp('m1', true))
    await act(async () => {})
    const previous = result.current.data
    expect(previous?.row?.status).toBe('scheduled')
    await act(async () => { await vi.advanceTimersByTimeAsync(90_000) })
    expect(result.current.data).toBe(previous)
    expect(result.current.loadError).toBe('Refresh failed')
    const panel = render(<FollowUpLetter state={result.current} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Showing the last loaded draft.')
    expect(screen.getByRole('article', { name: 'Follow-up email' })).toBeInTheDocument()
    await act(async () => { await result.current.retry() })
    panel.rerender(<FollowUpLetter state={result.current} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(result.current.loadError).toBeNull()
    expect(result.current.data?.row?.status).toBe('draft')
    expect(load).toHaveBeenCalledTimes(3)
  })
})

function pending() {
  let resolve!: (value: unknown) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<unknown>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

const otherDraft = { ...draft, followUp: { ...draft.followUp, id: 'f2', subject: 'Meeting two' } }

describe('follow-up read and mutation ordering', () => {
  const edited = { ...draft, followUp: { ...draft.followUp, subject: 'Saved edit', edited_at: '2026-11-23T20:00:00Z' } }

  it.each(['success', 'failure'] as const)('ignores a read %s arriving after a successful save', async (outcome) => {
    const read = pending()
    load.mockResolvedValueOnce(draft).mockReturnValueOnce(read.promise)
    mutate.mockResolvedValueOnce(edited)
    const { result } = renderHook(() => useFollowUp('m1', true))
    await waitFor(() => expect(result.current.data?.row?.id).toBe('f1'))
    let retry!: Promise<void>
    act(() => { retry = result.current.retry() })
    await act(async () => { await result.current.save({ subject: 'Saved edit' }) })
    await act(async () => { outcome === 'success' ? read.resolve(draft) : read.reject(new Error('Old read failed')); await retry })
    expect(result.current.data?.row?.subject).toBe('Saved edit')
    expect(result.current.loadError).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('ignores a read that finishes while a save is still pending', async () => {
    const read = pending(), write = pending()
    load.mockResolvedValueOnce(edited).mockReturnValueOnce(read.promise)
    mutate.mockReturnValueOnce(write.promise)
    const { result } = renderHook(() => useFollowUp('m1', true))
    await waitFor(() => expect(result.current.data?.row?.subject).toBe('Saved edit'))
    let retry!: Promise<void>, save!: Promise<void>
    act(() => { retry = result.current.retry(); save = result.current.save({ opening: 'Another edit' }) })
    await act(async () => { read.resolve(draft); await retry })
    expect(result.current.data?.row?.subject).toBe('Saved edit')
    expect(result.current.busy).toBe('save')
    await act(async () => { write.resolve(edited); await save })
  })

  it('rejects reads begun during a save but accepts fresh reads after it settles', async () => {
    const write = pending(), read = pending()
    load.mockResolvedValueOnce(draft).mockReturnValueOnce(read.promise).mockResolvedValueOnce(otherDraft)
    mutate.mockReturnValueOnce(write.promise)
    const { result } = renderHook(() => useFollowUp('m1', true))
    await waitFor(() => expect(result.current.data?.row?.id).toBe('f1'))
    let save!: Promise<void>, retry!: Promise<void>
    act(() => { save = result.current.save({ subject: 'Saved edit' }); retry = result.current.retry() })
    await act(async () => { write.resolve(edited); await save })
    await act(async () => { read.resolve(draft); await retry })
    expect(result.current.data?.row?.subject).toBe('Saved edit')
    await act(async () => { await result.current.retry() })
    expect(result.current.data?.row?.id).toBe('f2')
    expect(result.current.loading).toBe(false)
  })

  it('still reloads the current draft after a failed save', async () => {
    load.mockResolvedValueOnce(draft).mockResolvedValueOnce(edited)
    mutate.mockRejectedValueOnce(new Error('Save conflict'))
    const { result } = renderHook(() => useFollowUp('m1', true))
    await waitFor(() => expect(result.current.data?.row?.id).toBe('f1'))
    await act(async () => { await result.current.save({ subject: 'Saved edit' }) })
    await waitFor(() => expect(result.current.data?.row?.subject).toBe('Saved edit'))
    expect(error).toHaveBeenCalledWith('Not saved', 'Save conflict')
    expect(load).toHaveBeenCalledTimes(2)
    expect(result.current.busy).toBeNull()
  })

  it('clears a prior read error when a save returns a fresh draft', async () => {
    load.mockResolvedValueOnce(draft).mockRejectedValueOnce(new Error('Refresh failed'))
    mutate.mockResolvedValueOnce(edited)
    const { result } = renderHook(() => useFollowUp('m1', true))
    await waitFor(() => expect(result.current.data?.row?.id).toBe('f1'))
    await act(async () => { await result.current.retry() })
    expect(result.current.loadError).toBe('Refresh failed')
    await act(async () => { await result.current.save({ subject: 'Saved edit' }) })
    expect(result.current.loadError).toBeNull()
    expect(result.current.data?.row?.subject).toBe('Saved edit')
  })

  it('holds busy state and rejects reads until all overlapping saves settle', async () => {
    const first = pending(), second = pending(), read = pending()
    load.mockResolvedValueOnce(draft).mockReturnValueOnce(read.promise)
    mutate.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result } = renderHook(() => useFollowUp('m1', true))
    await waitFor(() => expect(result.current.data?.row?.id).toBe('f1'))
    let firstSave!: Promise<void>, secondSave!: Promise<void>, retry!: Promise<void>
    act(() => { firstSave = result.current.save({ subject: 'Saved edit' }); secondSave = result.current.save({ opening: 'New opening' }); retry = result.current.retry() })
    await act(async () => { first.resolve(edited); await firstSave })
    expect(result.current.busy).toBe('save')
    await act(async () => { read.resolve(draft); await retry })
    expect(result.current.data?.row?.subject).toBe('Saved edit')
    await act(async () => { second.resolve({ ...edited, followUp: { ...edited.followUp, opening: 'New opening' } }); await secondSave })
    expect(result.current.busy).toBeNull()
    expect(result.current.data?.row?.opening).toBe('New opening')
  })

  it.each(['send', 'stop', 'auto'] as const)('preserves a mocked %s result against an older read', async (kind) => {
    const read = pending()
    load.mockResolvedValueOnce(draft).mockReturnValueOnce(read.promise)
    const reply = { ...draft, followUp: { ...draft.followUp, status: kind === 'send' ? 'sent' : 'stopped' } }
    mutate.mockResolvedValueOnce(reply)
    const { result } = renderHook(() => useFollowUp('m1', true))
    await waitFor(() => expect(result.current.data?.row?.id).toBe('f1'))
    let retry!: Promise<void>
    act(() => { retry = result.current.retry() })
    await act(async () => { await (kind === 'auto' ? result.current.setAutoSend(true) : result.current[kind]()) })
    await act(async () => { read.resolve(draft); await retry })
    if (kind === 'auto') expect(result.current.data?.autoSend).toBe(true)
    else expect(result.current.data?.row?.status).toBe(reply.followUp.status)
    expect(result.current.busy).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('keeps an old scheduled refresh from restoring scheduling after an edit', async () => {
    vi.useFakeTimers()
    const read = pending()
    const scheduled = { ...draft, followUp: { ...draft.followUp, status: 'scheduled', send_at: new Date().toISOString() } }
    load.mockResolvedValueOnce(scheduled).mockReturnValueOnce(read.promise)
    mutate.mockResolvedValueOnce(edited)
    const { result } = renderHook(() => useFollowUp('m1', true))
    await act(async () => {})
    await act(async () => { await vi.advanceTimersByTimeAsync(90_000) })
    await act(async () => { await result.current.save({ subject: 'Saved edit' }) })
    await act(async () => { read.resolve(scheduled) })
    expect(result.current.data?.row?.status).toBe('draft')
    expect(result.current.data?.row?.subject).toBe('Saved edit')
  })
})

describe('follow-up request isolation', () => {
  it('ignores the previous meeting response without finishing the current load', async () => {
    const first = pending(), second = pending()
    load.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result, rerender } = renderHook(({ id }) => useFollowUp(id, true), { initialProps: { id: 'm1' } })
    rerender({ id: 'm2' })
    await act(async () => { first.resolve(draft) })
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(true)
    await act(async () => { second.resolve(otherDraft) })
    expect(result.current.data?.row?.id).toBe('f2')
    expect(result.current.loading).toBe(false)
  })

  it('ignores a previous meeting error after the current draft loads', async () => {
    const first = pending()
    load.mockReturnValueOnce(first.promise).mockResolvedValueOnce(otherDraft)
    const { result, rerender } = renderHook(({ id }) => useFollowUp(id, true), { initialProps: { id: 'm1' } })
    rerender({ id: 'm2' })
    await waitFor(() => expect(result.current.data?.row?.id).toBe('f2'))
    await act(async () => { first.reject(new Error('Previous meeting failed')) })
    expect(result.current.loadError).toBeNull()
    expect(result.current.data?.row?.id).toBe('f2')
  })

  it('clears the previous draft and error when the meeting changes', async () => {
    load.mockResolvedValueOnce(draft).mockRejectedValueOnce(new Error('Refresh failed')).mockReturnValueOnce(pending().promise)
    const { result, rerender } = renderHook(({ id }) => useFollowUp(id, true), { initialProps: { id: 'm1' } })
    await waitFor(() => expect(result.current.data?.row?.id).toBe('f1'))
    await act(async () => { await result.current.retry() })
    expect(result.current.loadError).toBe('Refresh failed')
    rerender({ id: 'm2' })
    expect(result.current.data).toBeNull()
    expect(result.current.loadError).toBeNull()
    expect(result.current.loading).toBe(true)
  })

  it('invalidates pending reads and disables retry while minutes are unavailable', async () => {
    const first = pending()
    load.mockReturnValueOnce(first.promise).mockResolvedValueOnce(otherDraft)
    const { result, rerender } = renderHook(({ ready }) => useFollowUp('m1', ready), { initialProps: { ready: true } })
    const oldRetry = result.current.retry
    rerender({ ready: false })
    await act(async () => { first.resolve(draft); await oldRetry() })
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(load).toHaveBeenCalledTimes(1)
    rerender({ ready: true })
    await waitFor(() => expect(result.current.data?.row?.id).toBe('f2'))
  })

  it('keeps the newest same-meeting read when an older read finishes last', async () => {
    const first = pending(), second = pending()
    load.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result } = renderHook(() => useFollowUp('m1', true))
    let retry!: Promise<void>
    act(() => { retry = result.current.retry() })
    await act(async () => { second.resolve(otherDraft); await retry })
    await act(async () => { first.resolve(draft) })
    expect(result.current.data?.row?.id).toBe('f2')
    expect(result.current.loading).toBe(false)
  })

  it('does not clear the newest error with an older successful read', async () => {
    const first = pending()
    load.mockReturnValueOnce(first.promise).mockRejectedValueOnce(new Error('Newest read failed'))
    const { result } = renderHook(() => useFollowUp('m1', true))
    await act(async () => { await result.current.retry() })
    await act(async () => { first.resolve(draft) })
    expect(result.current.loadError).toBe('Newest read failed')
    expect(result.current.data).toBeNull()
  })

  it('does not start more reads from a callback retained after unmount', async () => {
    const first = pending()
    load.mockReturnValueOnce(first.promise)
    const { result, unmount } = renderHook(() => useFollowUp('m1', true))
    const retry = result.current.retry
    unmount()
    await act(async () => { first.reject(new Error('Unmounted')); await retry() })
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('survives StrictMode effect replay without accepting the discarded response', async () => {
    const first = pending(), second = pending()
    load.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result } = renderHook(() => useFollowUp('m1', true), { wrapper: ({ children }) => <React.StrictMode>{children}</React.StrictMode> })
    await act(async () => { second.resolve(otherDraft) })
    await act(async () => { first.resolve(draft) })
    expect(result.current.data?.row?.id).toBe('f2')
  })

  it('retires an in-flight scheduled refresh when navigating to another meeting', async () => {
    vi.useFakeTimers()
    const refresh = pending()
    load.mockResolvedValueOnce({ ...draft, followUp: { ...draft.followUp, status: 'scheduled', send_at: new Date().toISOString() } })
      .mockReturnValueOnce(refresh.promise).mockResolvedValueOnce(otherDraft)
    const { result, rerender } = renderHook(({ id }) => useFollowUp(id, true), { initialProps: { id: 'm1' } })
    await act(async () => {})
    await act(async () => { await vi.advanceTimersByTimeAsync(90_000) })
    expect(load).toHaveBeenCalledTimes(2)
    rerender({ id: 'm2' })
    await act(async () => {})
    await act(async () => { refresh.reject(new Error('Previous refresh failed')); await vi.advanceTimersByTimeAsync(90_000) })
    expect(result.current.data?.row?.id).toBe('f2')
    expect(result.current.loadError).toBeNull()
    expect(load).toHaveBeenCalledTimes(3)
  })

  it('does not let an old mutation failure toast or clear a new meeting operation', async () => {
    const previous = pending(), current = pending()
    load.mockResolvedValueOnce(draft).mockResolvedValueOnce(otherDraft)
    mutate.mockReturnValueOnce(previous.promise).mockReturnValueOnce(current.promise)
    const { result, rerender } = renderHook(({ id }) => useFollowUp(id, true), { initialProps: { id: 'm1' } })
    await waitFor(() => expect(result.current.data?.row?.id).toBe('f1'))
    let oldSave!: Promise<void>, newSave!: Promise<void>
    act(() => { oldSave = result.current.save({ subject: 'Old meeting' }) })
    rerender({ id: 'm2' })
    await waitFor(() => expect(result.current.data?.row?.id).toBe('f2'))
    act(() => { newSave = result.current.save({ subject: 'Current meeting' }) })
    await act(async () => { previous.reject(new Error('Old save failed')); await oldSave })
    expect(result.current.busy).toBe('save')
    expect(error).not.toHaveBeenCalled()
    expect(load).toHaveBeenCalledTimes(2)
    await act(async () => { current.resolve(otherDraft); await newSave })
    expect(result.current.busy).toBeNull()
  })

  it.each(['save', 'send', 'stop', 'auto'] as const)('isolates an in-flight %s result after navigation (mocked only)', async (kind) => {
    const mutation = pending()
    load.mockResolvedValueOnce(draft).mockResolvedValueOnce(otherDraft)
    mutate.mockReturnValueOnce(mutation.promise)
    const { result, rerender } = renderHook(({ id }) => useFollowUp(id, true), { initialProps: { id: 'm1' } })
    await waitFor(() => expect(result.current.data?.row?.id).toBe('f1'))
    let done!: Promise<void>
    act(() => { done = kind === 'save' ? result.current.save({ subject: 'Updated' }) : kind === 'auto' ? result.current.setAutoSend(true) : result.current[kind]() })
    expect(mutate.mock.calls[0]).toEqual(kind === 'save' ? ['m1', { subject: 'Updated' }] : kind === 'auto' ? [true] : ['m1'])
    expect(result.current.busy).toBe(kind)
    rerender({ id: 'm2' })
    await waitFor(() => expect(result.current.data?.row?.id).toBe('f2'))
    expect(result.current.busy).toBeNull()
    await act(async () => { mutation.resolve(draft); await done })
    expect(result.current.data?.row?.id).toBe('f2')
    expect(result.current.data?.autoSend).toBe(false)
    expect(success).not.toHaveBeenCalled()
  })
})
