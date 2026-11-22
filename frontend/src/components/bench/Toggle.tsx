import React from 'react'
import { cx } from './cx'

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Accessible name, e.g. "Turn on: Post the recap to Slack". */
  label: string
  disabled?: boolean
  className?: string
}

/**
 * On/off rocker for a single setting (an automation, an agent). A sunk track
 * with a raised thumb that springs across; mint when on. For choosing between
 * options use Switch instead.
 */
export function Toggle({ checked, onChange, label, disabled, className }: ToggleProps): React.ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={cx('bs-toggle', checked && 'on', className)}
      onClick={(e) => { e.stopPropagation(); onChange(!checked) }}
    />
  )
}
