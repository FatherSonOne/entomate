import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi, describe, test, expect, beforeEach } from 'vitest'

const api = vi.hoisted(() => ({ get: vi.fn(), carryForward: vi.fn(() => Promise.resolve(null)) }))
const player = vi.hoisted(() => ({ ready: false, playFrom: vi.fn() }))
vi.mock('../services/api', () => ({ default: {}, meetingsApi: api, integrationsApi: {}, calendarApi: {}, reportsApi: {}, searchApi: {} }))
vi.mock('../components/vc/ToastProvider', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))
vi.mock('../components/intelligence/MeetingIntelligencePanel', () => ({ default: () => null }))
vi.mock('../components/EcosystemSyncStatus', () => ({ default: () => null }))
vi.mock('../components/meetings/MeetingNotesPanel', () => ({ default: () => null }))
vi.mock('../components/meetings/RecordingStatus', () => ({ default: () => null }))
vi.mock('../components/ChatChannelSelector', () => ({ default: () => null }))
vi.mock('../components/meetings/RecordingPlayer', async () => {
  const { forwardRef, useImperativeHandle } = await import('react')
  return {
    default: forwardRef(function Stub(_props, ref) {
      useImperativeHandle(ref, () => ({ isReady: () => player.ready, playFrom: player.playFrom }))
      return <div data-testid="player-stub" />
    }),
  }
})

import MeetingDetail from '../pages/MeetingDetail'

const MEETING = {
  id: 'm1',
  title: 'Planning',
  decisions: ['Ship on the fourteenth'],
  summary_moments: { decisions: [22_000] },
  transcript_segments: [
    { atMs: 0, speaker: 'Speaker 1', text: 'Morning' },
    { atMs: 22_000, speaker: 'Speaker 2', text: 'Ship on the fourteenth' },
  ],
  action_items: [],
}

function renderPage(recordingJob) {
  api.get.mockResolvedValue({ ...MEETING, recording_job: recordingJob })
  return render(
    <MemoryRouter initialEntries={['/meetings/m1']}>
      <Routes><Route path="/meetings/:id" element={<MeetingDetail />} /></Routes>
    </MemoryRouter>,
  )
}

describe('a pressed timecode plays the recording', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    player.ready = false
    Element.prototype.scrollIntoView = vi.fn()
  })

  test('loads and plays from the moment when the audio is not loaded yet', async () => {
    renderPage({ status: 'done', audioKept: true, durationMs: 60_000 })
    fireEvent.click(await screen.findByRole('button', { name: /Jump to 0:22 in the transcript: Ship/ }))
    expect(player.playFrom).toHaveBeenCalledTimes(1)
    expect(player.playFrom).toHaveBeenCalledWith(22_000)
  })

  test('moves loaded audio once, not twice', async () => {
    player.ready = true
    renderPage({ status: 'done', audioKept: true, durationMs: 60_000 })
    fireEvent.click(await screen.findByRole('button', { name: /Jump to 0:22 in the transcript: Ship/ }))
    expect(player.playFrom).toHaveBeenCalledTimes(1)
  })

  test('without kept audio it only jumps the transcript', async () => {
    renderPage({ status: 'done' })
    fireEvent.click(await screen.findByRole('button', { name: /Jump to 0:22 in the transcript: Ship/ }))
    expect(screen.queryByTestId('player-stub')).toBeNull()
    expect(player.playFrom).not.toHaveBeenCalled()
  })
})
