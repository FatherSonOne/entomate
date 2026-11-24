import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import useReadyBriefNotifications from '../components/EntoAssistant/useReadyBriefNotifications'
import { onThreadRequest } from '../components/EntoAssistant/threadSignal'
import { ToastProvider } from '../components/vc/ToastProvider'

const api = vi.hoisted(() => ({ ready: vi.fn() }))
vi.mock('../services/api', () => ({ entoAiApi: { meetingBriefs: { ready: api.ready } } }))
vi.mock('../services/monitoring', () => ({ breadcrumb: vi.fn(), reportError: vi.fn() }))

const openAssistant = vi.fn()
const brief = { threadId: 'dc1abe50-7db3-45c0-9a2b-7b319235f9bd', title: 'Budget review' }
let tabHidden: boolean

function Watch({ orgId }: { orgId: string }) {
  useReadyBriefNotifications({ userId: 'user-a', orgId, openAssistant })
  return null
}

const view = (orgId = 'workspace-a') => <ToastProvider><Watch orgId={orgId} /></ToastProvider>

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  window.localStorage.clear()
  api.ready.mockResolvedValue({ briefs: [] })
  tabHidden = false
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => tabHidden)
})

afterEach(() => {
  cleanup()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

test('a brief that becomes ready shows one notification, and Open brief opens its saved conversation', async () => {
  const request = vi.fn()
  const disconnect = onThreadRequest(request)
  try {
    render(view())
    await act(async () => {})
    expect(screen.queryByRole('button', { name: 'Open brief' })).toBeNull()
    expect(api.ready).toHaveBeenCalledWith('workspace-a')

    api.ready.mockResolvedValue({ briefs: [brief] })
    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(screen.getByText('Pre-meeting brief ready')).toBeTruthy()
    expect(screen.getByText('Budget review')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open brief' }))
    expect(request).toHaveBeenCalledExactlyOnceWith({ id: brief.threadId })
    expect(openAssistant).toHaveBeenCalledTimes(1)

    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(screen.queryByRole('button', { name: 'Open brief' })).toBeNull()
    cleanup()
    render(view())
    await act(async () => {})
    expect(screen.queryByRole('button', { name: 'Open brief' })).toBeNull()
  } finally {
    disconnect()
  }
})

test('the visible tab checks immediately and discards a response from the previous workspace', async () => {
  tabHidden = true
  let finish: (response: { briefs: typeof brief[] }) => void = () => {}
  api.ready.mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
  const { rerender } = render(view())
  expect(api.ready).not.toHaveBeenCalled()

  tabHidden = false
  fireEvent(document, new Event('visibilitychange'))
  expect(api.ready).toHaveBeenCalledWith('workspace-a')
  rerender(view('workspace-b'))
  await act(async () => { finish({ briefs: [brief] }) })
  expect(api.ready).toHaveBeenCalledWith('workspace-b')
  expect(screen.queryByText('Budget review')).toBeNull()
})
