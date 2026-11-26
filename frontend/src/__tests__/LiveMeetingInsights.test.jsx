import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const api = vi.hoisted(() => ({
  insights: vi.fn(),
  refreshInsights: vi.fn(),
  approveAction: vi.fn(),
}))
vi.mock('../services/api', () => ({ liveRoomsApi: api }))

import { LiveMeetingInsights } from '../components/meetings/LiveMeetingInsights'

const cue = { id: 'line-1', atMs: 14000, speaker: 'Priya', text: 'We decided to launch Friday. I will send the checklist.' }
const draft = { id: 'draft-1', text: 'Send the checklist', owner: 'Priya', source: cue }
const data = {
  throughMs: 14000,
  summary: [{ id: 'summary-1', text: 'The launch is Friday.', source: cue }],
  decisions: [{ id: 'decision-1', text: 'Launch Friday', source: cue }],
  actions: [draft],
}

function panel(props) {
  return <MemoryRouter><LiveMeetingInsights roomId="room-1" {...props} /></MemoryRouter>
}

describe('live meeting insights', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    api.insights.mockResolvedValue(data)
    api.refreshInsights.mockResolvedValue(data)
  })
  afterEach(() => vi.useRealTimers())

  test('every draft can show its transcript line, and an action creates a task only on approval', async () => {
    const onTask = vi.fn()
    api.approveAction.mockResolvedValue({ taskId: 'task-1', insights: { ...data, actions: [{ ...draft, taskId: 'task-1' }] } })
    render(panel({ live: true, onTask }))
    expect(await screen.findByText('The launch is Friday.')).toBeInTheDocument()
    const decisions = within(screen.getByRole('region', { name: 'Draft decisions' }))
    fireEvent.click(decisions.getByRole('link', { name: 'View transcript at 0:14, Priya' }))
    expect(screen.getByRole('region', { name: 'Transcript source' })).toHaveTextContent(cue.text)
    const actions = within(screen.getByRole('region', { name: 'Draft action items' }))
    fireEvent.click(actions.getByRole('link', { name: 'View transcript at 0:14, Priya' }))
    expect(api.approveAction).not.toHaveBeenCalled()
    fireEvent.click(actions.getByRole('button', { name: 'Approve and create task for Send the checklist' }))
    expect(await actions.findByRole('link', { name: 'Open task' })).toHaveAttribute('href', '/tasks?item=action%3Atask-1')
    expect(api.approveAction).toHaveBeenCalledExactlyOnceWith('room-1', draft.id)
    expect(onTask).toHaveBeenCalledTimes(1)
    expect(actions.queryByRole('button')).not.toBeInTheDocument()
  })

  test('recap citations jump directly to the saved transcript event', async () => {
    const onSource = vi.fn()
    render(panel({ onSource }))
    const decisions = await screen.findByRole('region', { name: 'Draft decisions' })
    const citation = within(decisions).getByRole('link', { name: 'View transcript at 0:14, Priya' })
    expect(citation).toHaveAttribute('href', '#transcript-line-line-1')
    fireEvent.click(citation)
    expect(onSource).toHaveBeenCalledExactlyOnceWith(cue)
    expect(screen.queryByRole('region', { name: 'Transcript source' })).not.toBeInTheDocument()
  })

  test('live refresh waits for checkpoints and only runs again when more transcript arrives', async () => {
    vi.useFakeTimers()
    const beforeRefresh = vi.fn(async () => {})
    const { rerender } = render(panel({ live: true, transcriptRevision: 0, beforeRefresh }))
    await act(async () => {})
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(api.refreshInsights).not.toHaveBeenCalled()
    rerender(panel({ live: true, transcriptRevision: 1, beforeRefresh }))
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(api.refreshInsights).toHaveBeenCalledExactlyOnceWith('room-1')
    expect(beforeRefresh.mock.invocationCallOrder[0]).toBeLessThan(api.refreshInsights.mock.invocationCallOrder[0])
    expect(api.approveAction).not.toHaveBeenCalled()
  })
})
