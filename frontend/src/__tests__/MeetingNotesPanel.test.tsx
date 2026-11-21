import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import type { MeetingNote } from '../services/meetingNotesService'

const service = vi.hoisted(() => ({
  getMeetingNotes: vi.fn(),
  createMeetingNote: vi.fn(),
  updateMeetingNote: vi.fn(),
  deleteMeetingNote: vi.fn(),
}))

vi.mock('../services/meetingNotesService', () => ({ ...service, MEETING_NOTE_MAX_LENGTH: 4000 }))

import MeetingNotesPanel from '../components/meetings/MeetingNotesPanel'

const MEETING = 'meeting-1'

function note(overrides: Partial<MeetingNote> = {}): MeetingNote {
  return {
    id: 'n1',
    meetingId: MEETING,
    authorId: 'u1',
    authorName: 'Ann',
    body: 'A note',
    visibility: 'private',
    createdAt: '2026-11-21T15:00:00Z',
    updatedAt: '2026-11-21T15:00:00Z',
    isMine: true,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  service.getMeetingNotes.mockResolvedValue({ notes: [], failed: false })
})

describe('MeetingNotesPanel', () => {
  test('empty list says "No notes yet"', async () => {
    render(<MeetingNotesPanel meetingId={MEETING} />)
    expect(await screen.findByText('No notes yet.')).toBeInTheDocument()
  })

  test('a failed read is NOT shown as an empty list', async () => {
    service.getMeetingNotes.mockResolvedValue({ notes: [], failed: true })
    render(<MeetingNotesPanel meetingId={MEETING} />)
    expect(await screen.findByText(/Notes could not be loaded/)).toBeInTheDocument()
    expect(screen.queryByText('No notes yet.')).not.toBeInTheDocument()
  })

  test('the composer says Private before saving and saves as private by default', async () => {
    service.createMeetingNote.mockResolvedValue(note({ body: 'Follow up' }))
    render(<MeetingNotesPanel meetingId={MEETING} />)
    await screen.findByText('No notes yet.')

    expect(screen.getByRole('button', { name: 'Private to me' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.change(screen.getByLabelText('Add a note'), { target: { value: 'Follow up' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }))

    await waitFor(() =>
      expect(service.createMeetingNote).toHaveBeenCalledWith({ meetingId: MEETING, body: 'Follow up', visibility: 'private' }),
    )
    expect(await screen.findByText('Follow up')).toBeInTheDocument()
  })

  test('sharing is one deliberate note: the next note starts private again', async () => {
    service.createMeetingNote.mockResolvedValue(note({ body: 'Shared', visibility: 'team' }))
    render(<MeetingNotesPanel meetingId={MEETING} />)
    await screen.findByText('No notes yet.')

    fireEvent.click(screen.getByRole('button', { name: 'Private to me' }))
    expect(screen.getByRole('button', { name: 'Visible to the team' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.change(screen.getByLabelText('Add a note'), { target: { value: 'Shared' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }))

    await waitFor(() => expect(service.createMeetingNote).toHaveBeenCalledWith(expect.objectContaining({ visibility: 'team' })))
    expect(await screen.findByRole('button', { name: 'Private to me' })).toBeInTheDocument()
  })

  test("a teammate's note shows their name and no edit controls", async () => {
    service.getMeetingNotes.mockResolvedValue({
      notes: [note({ isMine: false, authorName: 'Bo', visibility: 'team' })],
      failed: false,
    })
    render(<MeetingNotesPanel meetingId={MEETING} />)
    expect(await screen.findByText('Bo')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit note' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete note' })).not.toBeInTheDocument()
  })

  test('delete asks for confirmation first', async () => {
    service.getMeetingNotes.mockResolvedValue({ notes: [note()], failed: false })
    service.deleteMeetingNote.mockResolvedValue(true)
    render(<MeetingNotesPanel meetingId={MEETING} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Delete note' }))
    expect(service.deleteMeetingNote).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(service.deleteMeetingNote).toHaveBeenCalledWith(MEETING, 'n1'))
    expect(await screen.findByText('No notes yet.')).toBeInTheDocument()
  })

  test('a failed save shows an alert and keeps the draft', async () => {
    service.createMeetingNote.mockResolvedValue(null)
    render(<MeetingNotesPanel meetingId={MEETING} />)
    await screen.findByText('No notes yet.')

    fireEvent.change(screen.getByLabelText('Add a note'), { target: { value: 'Keep me' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved')
    expect(screen.getByLabelText('Add a note')).toHaveValue('Keep me')
  })

  test('no meeting id: explains instead of offering a composer', () => {
    render(<MeetingNotesPanel meetingId={null} />)
    expect(screen.getByText(/once this meeting has been saved/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Add a note')).not.toBeInTheDocument()
  })
})
