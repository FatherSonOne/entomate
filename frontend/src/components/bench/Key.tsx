import React, { forwardRef } from 'react'
import { cx } from './cx'

export type KeyVariant = 'plain' | 'primary'
export type KeySize = 'md' | 'sm' | 'tc'

export interface KeyProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** One primary (crimson) key per view. */
  variant?: KeyVariant
  /** md 34px, sm 26px, tc = 24px mono timecode key ("▶ 12:20"). */
  size?: KeySize
  /** Keyboard hint shown in a sunk cap, e.g. "⌘K". */
  kbd?: string
  /** Leading icon. */
  icon?: React.ReactNode
  /** Icon-only square key. Requires aria-label. */
  iconOnly?: boolean
  /** Use the darker face for keys that sit on a Display. */
  onDisplay?: boolean
}

/** A key: presses 2px in 80ms. Nothing glows on hover. */
export const Key = forwardRef<HTMLButtonElement, KeyProps>(function Key(
  { variant = 'plain', size = 'md', kbd, icon, iconOnly = false, onDisplay = false, className, children, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'bs-key',
        variant === 'primary' && 'pri',
        size !== 'md' && size,
        iconOnly && 'bs-ikey',
        onDisplay && 'on-display',
        className
      )}
      {...rest}
    >
      {icon}
      {children}
      {kbd && <span className="bs-k" aria-hidden="true">{kbd}</span>}
    </button>
  )
})
