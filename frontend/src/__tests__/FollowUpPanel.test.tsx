import React from 'react'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FollowUpLetter, useFollowUp } from '../components/meetings/FollowUpPanel'

const { load } = vi.hoisted(() => ({ load: vi.fn<(id: string) => Promise<unknown>>() }))
vi.mock('../services/api', () => ({ meetingsApi: { followUp: load } }))
vi.mock('../services/apiCache', () => ({ default: { invalidate: vi.fn() } }))
vi.mock('../components/vc/ToastProvider', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))

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
