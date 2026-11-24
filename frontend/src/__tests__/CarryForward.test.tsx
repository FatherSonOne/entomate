import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, test, expect } from 'vitest'
import CarryForward, { type CarryForwardData } from '../components/meetings/CarryForward'

const meeting = { id: 'm1', title: 'Weekly sync', date: '2026-11-13T15:00:00Z' }
const data: CarryForwardData = {
  lastMeeting: { ...meeting, sharedPeople: ['dana lee'], sameSeries: true },
  relatedMeetings: 1,
  openCount: 3,
  overdueCount: 1,
  doneCount: 1,
  open: [
    { id: 'a', text: 'Send deck', owner: 'Sam', dueDate: '2026-11-10', status: 'open', overdue: true, reason: 'series', meeting },
    { id: 'b', text: 'Book venue', owner: null, dueDate: null, status: 'open', overdue: false, reason: 'series', meeting },
    { id: 'c', text: 'Third', owner: 'Dana', dueDate: null, status: 'open', overdue: false, reason: 'owner', meeting },
  ],
  done: [{ id: 'd', text: 'Draft quote', owner: 'Dana', dueDate: null, status: 'completed', reason: 'people', meeting }],
}

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('CarryForward', () => {
  test('shows a linked project brief even when there are no earlier commitments', () => {
    wrap(<CarryForward data={{ ...data, openCount: 0, overdueCount: 0, doneCount: 0, open: [], done: [],
      projectContext: { id: 'pilot', name: 'Clinic pilot', outcome: 'Pilot in two clinics', scope: '', successCriteria: '',
        nextMilestone: { id: 'm1', title: 'Confirm clinic lead', dueDate: '2026-12-10' } }
    }} />)
    expect(screen.getByRole('link', { name: 'Clinic pilot' })).toHaveAttribute('href', '/projects/pilot')
    expect(screen.getByText('Pilot in two clinics')).toBeInTheDocument()
    expect(screen.getByText(/Confirm clinic lead/)).toBeInTheDocument()
    expect(screen.queryByText('0 open')).not.toBeInTheDocument()
  })

  test('lists open items with overdue first, the last meeting and what got done', () => {
    wrap(<CarryForward data={data} />)
    expect(screen.getByText('3 open · 1 overdue · 1 done')).toBeTruthy()
    expect(screen.getByText('Last in this series')).toBeTruthy()
    expect(screen.getByText('Overdue')).toBeTruthy()
    expect(screen.getByText('Draft quote')).toBeTruthy()
  })

  test('a limit trims open items, says how many more, and hides done', () => {
    wrap(<CarryForward data={data} limit={2} />)
    expect(screen.queryByText('Third')).toBeNull()
    expect(screen.getByText('1 more open from earlier meetings')).toBeTruthy()
    expect(screen.queryByText('Draft quote')).toBeNull()
  })

  test('renders nothing without history', () => {
    const { container } = wrap(<CarryForward data={{ ...data, openCount: 0, doneCount: 0, open: [], done: [] }} />)
    expect(container.textContent).toBe('')
  })

  test('a malformed reply renders nothing instead of breaking the page', () => {
    const bad = { items: [] } as unknown as CarryForwardData
    const { container } = wrap(<CarryForward data={bad} />)
    expect(container.textContent).toBe('')
  })

  test('missing lists are read as empty, counts fall back to the lists', () => {
    const partial = { openCount: 1, open: undefined, done: undefined } as unknown as CarryForwardData
    expect(() => wrap(<CarryForward data={partial} />)).not.toThrow()
  })
})
