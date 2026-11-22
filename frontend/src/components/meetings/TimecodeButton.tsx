/**
 * A transcript timecode: the Bench Swiss `tc` key ("▶ 0:42") that jumps the transcript
 * to that moment. Sits next to a decision, key point or action item. Renders nothing
 * for a missing timecode: no link is better than a link to the wrong moment.
 */

import React from 'react'
import { Key } from '../bench'
import { formatClock } from '../../services/meetingTranscriptService'

export interface TimecodeButtonProps {
  atMs: number | null | undefined
  onJump: (atMs: number) => void
  /** What the moment is, for the accessible name: "Jump to 0:42 in the transcript: <label>". */
  label?: string
  /** Shown pressed: the transcript is on this moment. */
  active?: boolean
  className?: string
}

export function TimecodeButton({ atMs, onJump, label, active = false, className }: TimecodeButtonProps): React.ReactElement | null {
  if (typeof atMs !== 'number' || !Number.isFinite(atMs) || atMs < 0) return null
  const clock = formatClock(atMs)
  return (
    <Key
      size="tc"
      onClick={() => onJump(atMs)}
      aria-label={`Jump to ${clock} in the transcript${label ? `: ${label}` : ''}`}
      title="Jump to this moment in the transcript"
      data-down={active || undefined}
      className={className}
    >
      <span aria-hidden="true">▶</span>
      {clock}
    </Key>
  )
}

export default TimecodeButton
