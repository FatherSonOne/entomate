import React from 'react'
import { cx } from './cx'

export interface SwitchOption<V extends string> {
  value: V
  label: React.ReactNode
}

export interface SwitchProps<V extends string> {
  options: ReadonlyArray<SwitchOption<V>>
  value: V
  onChange: (value: V) => void
  /** Accessible name for the group. */
  label: string
  className?: string
  disabled?: boolean
}

/** Segmented hardware switch: sunk track, raised thumb. Used for filters. */
export function Switch<V extends string>({ options, value, onChange, label, className, disabled }: SwitchProps<V>): React.ReactElement {
  return (
    <div className={cx('bs-switch', className)} role="group" aria-label={label}>
      {options.map((opt) => (
        <button key={opt.value} type="button" disabled={disabled} aria-pressed={opt.value === value} onClick={() => onChange(opt.value)}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}
