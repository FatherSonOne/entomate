import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import Today from '../pages/Dashboard'

const reason = 'The review blocks the handoff to the next team.'
const title = 'Review the handoff'

vi.mock('../services/api', () => ({
  default: {},
  meetingsApi: { list: async () => ({ meetings: [] }) },
  dashboardApi: {
    getActionItems: async () => ({
      actionItems: [
        {
          id: 'with-explanation',
          task_description: title,
          meeting_id: 'meeting-1',
          assigned_to_name: 'Morgan Lee',
          due_date: '2024-01-13',
          priority: 'high',
          agent_notes: { priority: { reason, recommended: 'high', applied: true } },
        },
        { id: 'without-explanation', task_description: 'Send the recap' },
      ],
    }),
  },
  tasksApi: { list: async () => ({ count: 0 }) },
  calendarApi: { getStatus: async () => ({ connected: false }), getUpcoming: async () => ({ upcoming: [] }) },
}))
vi.mock('../contexts/OrgContext', () => ({ useOrgSafe: () => null }))
vi.mock('../components/vc/ToastProvider', () => {
  const toast = {}
  return { useToast: () => toast }
})

test('an AI explanation can be opened without following the action item’s meeting link', async () => {
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<Today />} />
        <Route path="/meetings/meeting-1" element={<h1>Source meeting</h1>} />
      </Routes>
    </MemoryRouter>,
  )

  const row = await screen.findByRole('row', { name: new RegExp(title) })
  const summary = within(row).getByLabelText(`AI explanation for ${title}`)
  const disclosure = summary.closest('details')
  expect(disclosure).not.toHaveAttribute('open')
  expect(within(row).getAllByText('Morgan Lee').length).toBeGreaterThan(0)
  expect(within(row).getAllByText('Sat 13 Jan').length).toBeGreaterThan(0)
  expect(within(row).getAllByText('High', { exact: true }).length).toBeGreaterThan(0)
  expect(screen.queryByLabelText('AI explanation for Send the recap')).not.toBeInTheDocument()

  expect(fireEvent.keyDown(summary, { key: 'Enter' })).toBe(true)
  fireEvent.click(summary)
  expect(disclosure).toHaveAttribute('open')
  fireEvent.click(within(disclosure).getByText(reason))
  expect(screen.queryByRole('heading', { name: 'Source meeting' })).not.toBeInTheDocument()

  fireEvent.click(summary)
  expect(disclosure).not.toHaveAttribute('open')
  fireEvent.click(row)
  expect(screen.getByRole('heading', { name: 'Source meeting' })).toBeInTheDocument()
})
