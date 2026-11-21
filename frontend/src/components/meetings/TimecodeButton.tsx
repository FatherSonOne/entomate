/**
 * A transcript timecode: "0:42", a button that jumps the transcript to that moment.
 *
 * Deliberately design-neutral (theme tokens only, inherits size from its context) so any
 * meeting layout can place it next to a decision, key point or action item. Renders
 * nothing for a missing timecode: no link is better than a link to the wrong moment.
 */

import React from 'react'
import { formatClock } from '../../services/meetingTranscriptService'

export interface TimecodeButtonProps {
  atMs: number | null | undefined
  onJump: (atMs: number) => void
  /** What the moment is, for the accessible name: "Jump to 0:42 in the transcript: <label>". */
  label?: string
  className?: string
}

export function TimecodeButton({ atMs, onJump, label, className = '' }: TimecodeButtonProps): React.ReactElement | null {
  if (typeof atMs !== 'number' || !Number.isFinite(atMs) || atMs < 0) return null
  const clock = formatClock(atMs)
  return (
    <button
      type="button"
      onClick={() => onJump(atMs)}
      aria-label={`Jump to ${clock} in the transcript${label ? `: ${label}` : ''}`}
      title="Jump to this moment in the transcript"
      className={
        '-mx-1 inline-flex items-center rounded px-1 font-mono tabular-nums text-content-secondary underline decoration-line ' +
        'underline-offset-2 hover:text-content-primary hover:decoration-accent-primary focus:outline-none ' +
        `focus-visible:ring-2 focus-visible:ring-accent-primary ${className}`
      }
    >
      {clock}
    </button>
  )
}

export default TimecodeButton
