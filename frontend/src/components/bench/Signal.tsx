import React from 'react'
import { cx } from './cx'

/**
 * The signal law. brand = active/decision/High, ai = an agent made the call,
 * live = happening now, mint = action done, off = idle/low/scheduled.
 */
export type SignalTone = 'brand' | 'ai' | 'live' | 'mint' | 'off'

export interface LedProps {
  tone?: SignalTone
  className?: string
}

/** A bare LED. Only use next to a word; colour never carries meaning alone. */
export function Led({ tone = 'off', className }: LedProps): React.ReactElement {
  return <span className={cx('bs-led', tone, className)} aria-hidden="true" />
}

export interface SignalProps {
  tone: SignalTone
  /** The word. Required: every status is an LED plus a word. */
  children: React.ReactNode
  className?: string
}

/** LED + word, e.g. ● LIVE. */
export function Signal({ tone, children, className }: SignalProps): React.ReactElement {
  return (
    <span className={cx('bs-sig', className)}>
      <Led tone={tone} />
      {children}
    </span>
  )
}
