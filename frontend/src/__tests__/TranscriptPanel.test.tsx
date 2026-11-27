import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'

const api = vi.hoisted(() => ({ renameSpeaker: vi.fn(), mergeSpeakers: vi.fn(), suggestSpeakers: vi.fn() }))
const cacheMock = vi.hoisted(() => ({ invalidate: vi.fn() }))
vi.mock('../services/api', () => ({ meetingsApi: api }))
vi.mock('../services/apiCache', () => ({ default: cacheMock }))

import TranscriptPanel from '../components/meetings/TranscriptPanel'
import { formatClock, toSegments, matchingLines, toSuggestions, isGenericSpeaker, type TranscriptSegment } from '../services/meetingTranscriptService'

const MEETING = 'meeting-1'
const SEGMENTS: TranscriptSegment[] = [
  { atMs: 500, speaker: 'Speaker 200', text: 'Hi there' },
  { atMs: 65_000, speaker: 'Ann Lee', text: 'Budget is approved' },
  { atMs: 3_725_000, speaker: 'Speaker 200', text: 'Great, the budget works' },
]

beforeEach(() => vi.clearAllMocks())

describe('meetingTranscriptService', () => {
  test('formatClock reads like a recording clock', () => {
    expect(formatClock(500)).toBe('0:00')
    expect(formatClock(65_000)).toBe('1:05')
    expect(formatClock(3_725_000)).toBe('1:02:05')
  })

  test('toSegments drops malformed rows and returns null for nothing', () => {
    expect(toSegments(null)).toBeNull()
    expect(toSegments([])).toBeNull()
    expect(toSegments([{ atMs: 'x', text: 'ok' }, { text: '' }, 5])).toEqual([{ atMs: 0, speaker: 'Speaker', text: 'ok' }])
  })

  test('matchingLines is case-insensitive over text and speaker', () => {
    expect(matchingLines(SEGMENTS, 'BUDGET')).toEqual([1, 2])
    expect(matchingLines(SEGMENTS, 'ann')).toEqual([1])
    expect(matchingLines(SEGMENTS, '  ')).toEqual([])
  })
})

describe('TranscriptPanel', () => {
  test('shows every line with its time and speaker, and the speakers with line counts', () => {
    render(<TranscriptPanel meetingId={MEETING} segments={SEGMENTS} />)
    const lines = screen.getAllByTestId('transcript-line')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toHaveTextContent('1:05')
    expect(lines[1]).toHaveTextContent('Ann Lee')
    expect(screen.getByRole('button', { name: 'Rename Speaker 200' })).toHaveTextContent('2')
  })

  test('search counts matches and steps through them', () => {
    render(<TranscriptPanel meetingId={MEETING} segments={SEGMENTS} />)
    fireEvent.change(screen.getByLabelText('Search transcript'), { target: { value: 'budget' } })
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
    expect(screen.getAllByTestId('transcript-line')[1]).toHaveAttribute('aria-current', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Next match' }))
    expect(screen.getByText('2 of 2')).toBeInTheDocument()
    expect(screen.getAllByTestId('transcript-line')[2]).toHaveAttribute('aria-current', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Next match' }))
    expect(screen.getByText('1 of 2')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search transcript'), { target: { value: 'zebra' } })
    expect(screen.getByText('No matches')).toBeInTheDocument()
  })

  test('previews a speaker turn and merges two labels while keeping the selected name', async () => {
    const onPreviewSpeaker = vi.fn()
    const merged = SEGMENTS.map(line => ({ ...line, speaker: 'Ann Lee' }))
    api.mergeSpeakers.mockResolvedValue({ data: { transcript_segments: merged, transcript: 'Merged' } })
    render(<TranscriptPanel meetingId={MEETING} segments={SEGMENTS} onPreviewSpeaker={onPreviewSpeaker} />)
    fireEvent.click(screen.getByRole('button', { name: 'Preview Speaker 200' }))
    expect(onPreviewSpeaker).toHaveBeenCalledWith(500, 5500)
    fireEvent.click(screen.getByRole('button', { name: 'Merge speakers' }))
    expect(screen.getByRole('button', { name: /^Merge$/ })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Merge from'), { target: { value: 'Speaker 200' } })
    fireEvent.change(screen.getByLabelText('Keep this speaker'), { target: { value: 'Ann Lee' } })
    fireEvent.click(screen.getByRole('button', { name: /^Merge$/ }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Rename Speaker 200' })).toBeNull())
    expect(api.mergeSpeakers).toHaveBeenCalledWith(MEETING, 'Speaker 200', 'Ann Lee')
    expect(screen.getByRole('button', { name: 'Rename Ann Lee' })).toHaveTextContent('3')
  })

  test('renaming a speaker updates every line and tells the page', async () => {
    api.renameSpeaker.mockResolvedValue({
      success: true,
      data: {
        transcript: 'Bo: Hi there\nAnn Lee: Budget is approved\nBo: Great, the budget works',
        transcript_segments: SEGMENTS.map((s) => (s.speaker === 'Speaker 200' ? { ...s, speaker: 'Bo' } : s)),
      },
    })
    const onRenamed = vi.fn()
    render(<TranscriptPanel meetingId={MEETING} segments={SEGMENTS} onRenamed={onRenamed} />)

    fireEvent.click(screen.getByRole('button', { name: 'Rename Speaker 200' }))
    const input = screen.getByLabelText('New name for Speaker 200')
    fireEvent.change(input, { target: { value: 'Bo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }))

    await waitFor(() => expect(api.renameSpeaker).toHaveBeenCalledWith(MEETING, 'Speaker 200', 'Bo'))
    expect(await screen.findByRole('button', { name: 'Rename Bo' })).toBeInTheDocument()
    expect(within(screen.getAllByTestId('transcript-line')[2]!).getByText('Bo')).toBeInTheDocument()
    expect(cacheMock.invalidate).toHaveBeenCalledWith(`/meetings/${MEETING}`)
    expect(onRenamed).toHaveBeenCalledWith(expect.objectContaining({ transcript: expect.stringContaining('Bo: Hi there') }))
  })

  test('a timecode jumps to the line being spoken at that moment', () => {
    const { rerender } = render(<TranscriptPanel meetingId={MEETING} segments={SEGMENTS} focusAtMs={70_000} />)
    expect(screen.getAllByTestId('transcript-line')[1]).toHaveAttribute('aria-current', 'true')
    rerender(<TranscriptPanel meetingId={MEETING} segments={SEGMENTS} focusAtMs={4_000_000} />)
    expect(screen.getAllByTestId('transcript-line')[2]).toHaveAttribute('aria-current', 'true')
  })

  test('a draft citation focuses the exact line even when transcript timestamps match', () => {
    const segments = toSegments([
      { ...SEGMENTS[0], eventId: 'first' },
      { ...SEGMENTS[1], atMs: SEGMENTS[0]!.atMs, eventId: 'second' },
    ])!
    const { rerender } = render(<TranscriptPanel meetingId={MEETING} segments={segments} />)
    fireEvent.change(screen.getByLabelText('Search transcript'), { target: { value: 'Hi there' } })
    rerender(<TranscriptPanel meetingId={MEETING} segments={segments} focusAtMs={500} focusEventId="second" />)
    const cited = screen.getAllByTestId('transcript-line')[1]
    expect(cited).toHaveAttribute('id', 'transcript-line-second')
    expect(cited).toHaveAttribute('aria-current', 'true')
    expect(cited).toHaveFocus()
  })

  test('a colon is refused before anything is sent', () => {
    render(<TranscriptPanel meetingId={MEETING} segments={SEGMENTS} />)
    fireEvent.click(screen.getByRole('button', { name: 'Rename Ann Lee' }))
    fireEvent.change(screen.getByLabelText('New name for Ann Lee'), { target: { value: 'Ann: CEO' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }))
    expect(screen.getByRole('alert')).toHaveTextContent('colon')
    expect(api.renameSpeaker).not.toHaveBeenCalled()
  })

  test("a failed rename keeps the old name and says why", async () => {
    api.renameSpeaker.mockRejectedValue(Object.assign(new Error('That speaker is not in this transcript'), { status: 404 }))
    render(<TranscriptPanel meetingId={MEETING} segments={SEGMENTS} />)
    fireEvent.click(screen.getByRole('button', { name: 'Rename Ann Lee' }))
    fireEvent.change(screen.getByLabelText('New name for Ann Lee'), { target: { value: 'Annie' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be renamed')
    expect(screen.getAllByTestId('transcript-line')[1]).toHaveTextContent('Ann Lee')
  })
})

describe('speaker name suggestions', () => {
  const SEGS: TranscriptSegment[] = [
    { atMs: 0, speaker: 'Speaker 1', text: "I'm Priya" },
    { atMs: 1000, speaker: 'Speaker 2', text: 'Hello' },
  ]

  test('toSuggestions keeps one valid guess per speaker still present', () => {
    expect(isGenericSpeaker('Speaker 12')).toBe(true)
    expect(isGenericSpeaker('Priya')).toBe(false)
    expect(toSuggestions([
      { speaker: 'Speaker 1', name: 'Priya Shah', confidence: 0.7, evidence: "I'm Priya" },
      { speaker: 'Speaker 1', name: 'Other', confidence: 0.6 },
      { speaker: 'Speaker 9', name: 'Ghost', confidence: 0.9 },
      { speaker: 'Speaker 2', name: 'Bad: name', confidence: 0.9 },
    ], SEGS)).toEqual([{ speaker: 'Speaker 1', name: 'Priya Shah', confidence: 0.7, evidence: "I'm Priya" }])
  })

  test('saved guesses can be accepted, which renames the speaker', async () => {
    const renamed = SEGS.map((s) => (s.speaker === 'Speaker 1' ? { ...s, speaker: 'Priya Shah' } : s))
    api.renameSpeaker.mockResolvedValue({ data: { transcript_segments: renamed, transcript: 'x' } })
    const onRenamed = vi.fn()
    render(<TranscriptPanel meetingId={MEETING} segments={SEGS} onRenamed={onRenamed} suggestions={[{ speaker: 'Speaker 1', name: 'Priya Shah', confidence: 0.7, evidence: "I'm Priya" }]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Rename Speaker 1 to Priya Shah' }))
    await waitFor(() => expect(api.renameSpeaker).toHaveBeenCalledWith(MEETING, 'Speaker 1', 'Priya Shah'))
    await waitFor(() => expect(onRenamed).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Rename Speaker 1 to Priya Shah' })).toBeNull()
  })

  test('Suggest names asks the server and says so when nothing is found', async () => {
    api.suggestSpeakers.mockResolvedValue({ data: { suggestions: [] } })
    render(<TranscriptPanel meetingId={MEETING} segments={SEGS} />)
    fireEvent.click(screen.getByRole('button', { name: 'Suggest names' }))
    expect(await screen.findByRole('status')).toHaveTextContent('No names could be worked out')
    expect(api.suggestSpeakers).toHaveBeenCalledWith(MEETING)
  })
})
