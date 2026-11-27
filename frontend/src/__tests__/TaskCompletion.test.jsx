import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { ToastProvider } from '../components/vc/ToastProvider'
import Tasks from '../pages/Tasks'

const api = vi.hoisted(() => ({
  list: vi.fn(), actions: vi.fn(), complete: vi.fn(), update: vi.fn(), reopen: vi.fn(), actionStatus: vi.fn(),
}))
vi.mock('../services/api', () => ({
  meetingsApi: {},
  dashboardApi: { getActionItems: api.actions, updateActionItemStatus: api.actionStatus },
  tasksApi: { list: api.list, complete: api.complete, update: api.update, reopen: api.reopen },
}))
vi.mock('../components/vc/ConfirmDialog', () => ({ useConfirm: () => vi.fn() }))
vi.mock('../services/monitoring', () => ({ breadcrumb: vi.fn(), reportError: vi.fn() }))

const task = { id: 'task-1', title: 'Review the agreement', status: 'in_progress', due_date: '2026-11-26' }
const nextTask = { id: 'task-2', title: 'Send the draft', status: 'open', due_date: '2026-11-27' }
const action = {
  id: 'action-1', task_description: 'Record the vote', status: 'blocked',
  meeting_id: 'meeting-1', meetings: { title: 'Board review' }, transcript_at_ms: 1000,
}

function renderTasks(path = '/tasks?layout=list') {
  return render(<MemoryRouter initialEntries={[path]}><ToastProvider><Tasks /></ToastProvider></MemoryRouter>)
}

beforeEach(() => {
  vi.resetAllMocks()
  window.matchMedia = vi.fn().mockImplementation((media) => ({
    media, matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  }))
  api.list.mockResolvedValue({ tasks: [task, nextTask] })
  api.actions.mockResolvedValue({ actionItems: [] })
  api.update.mockResolvedValue({})
})

test('holds the checked row while saving, then offers undo to the original status', async () => {
  let finish
  api.complete.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
  renderTasks()
  const checkbox = await screen.findByRole('checkbox', { name: 'Complete Review the agreement' })
  const row = checkbox.closest('li')
  checkbox.focus()
  fireEvent.click(checkbox)
  expect(checkbox).toBeChecked()
  expect(row).toHaveClass('is-completing')
  fireEvent.click(checkbox)
  expect(api.complete).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button', { name: 'Undo', exact: true })).toBeNull()
  await act(async () => finish({}))
  await waitFor(() => expect(checkbox).not.toBeInTheDocument())
  expect(screen.getByRole('checkbox', { name: 'Complete Send the draft' })).toHaveFocus()
  expect(screen.getByRole('status')).toHaveTextContent('Review the agreement completed.')

  fireEvent.click(screen.getByRole('button', { name: 'Completed', exact: true }))
  expect(await screen.findByRole('checkbox', { name: 'Reopen Review the agreement' })).toBeChecked()
  fireEvent.click(screen.getByRole('button', { name: 'Undo', exact: true }))
  await waitFor(() => expect(api.update).toHaveBeenCalledWith('task-1', { status: 'in_progress' }))
  expect(await screen.findByText('Task reopened')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Open', exact: true }))
  expect(await screen.findByRole('checkbox', { name: 'Complete Review the agreement' })).not.toBeChecked()
})

test('keeps a meeting action visible after a failed save and preserves its source on undo', async () => {
  api.list.mockResolvedValue({ tasks: [] })
  api.actions.mockResolvedValue({ actionItems: [action] })
  api.actionStatus.mockRejectedValueOnce(new Error('Save rejected'))
    .mockResolvedValueOnce({ actionItem: { id: action.id, status: 'done' } })
    .mockResolvedValueOnce({ actionItem: { id: action.id, status: 'blocked' } })
  renderTasks()
  const box = await screen.findByRole('checkbox', { name: 'Complete Record the vote' })
  fireEvent.click(box)
  await waitFor(() => expect(box).not.toBeChecked())
  expect(screen.getByRole('status')).toHaveTextContent("Couldn't update Record the vote")
  expect(screen.queryByRole('button', { name: 'Undo', exact: true })).toBeNull()

  fireEvent.click(box)
  fireEvent.click(await screen.findByRole('button', { name: 'Undo', exact: true }))
  await waitFor(() => expect(api.actionStatus).toHaveBeenLastCalledWith(action.id, 'blocked'))
  const reopened = await screen.findByRole('checkbox', { name: 'Complete Record the vote' })
  expect(within(reopened.closest('li')).getByRole('link', { name: /Board review/ }))
    .toHaveAttribute('href', '/meetings/meeting-1?t=1000')
})
