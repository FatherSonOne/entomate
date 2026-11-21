import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, test, expect } from 'vitest'

vi.mock('../services/api', () => ({ meetingsApi: {} }))
vi.mock('../services/apiCache', () => ({ default: { invalidate: vi.fn() } }))

import TimecodeButton from '../components/meetings/TimecodeButton'
import { toSummaryMoments } from '../services/meetingTranscriptService'

describe('TimecodeButton', () => {
  test('shows the clock and jumps with the exact ms', () => {
    const onJump = vi.fn()
    render(<TimecodeButton atMs={42_500} onJump={onJump} label="Launch moves to March" />)
    const btn = screen.getByRole('button', { name: 'Jump to 0:42 in the transcript: Launch moves to March' })
    expect(btn).toHaveTextContent('0:42')
    fireEvent.click(btn)
    expect(onJump).toHaveBeenCalledWith(42_500)
  })

  test('renders nothing without a timecode', () => {
    const { container } = render(<TimecodeButton atMs={null} onJump={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('toSummaryMoments', () => {
  test('keeps alignment and turns anything malformed into null', () => {
    expect(toSummaryMoments({ keyPoints: [1000, 'x', -5], decisions: [null, 2000] })).toEqual({
      keyPoints: [1000, null, null],
      decisions: [null, 2000],
    })
    expect(toSummaryMoments(null)).toEqual({ keyPoints: [], decisions: [] })
  })
})
