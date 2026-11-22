import React from 'react'
import { cx } from './cx'

export interface DisplayProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

/**
 * The inset dark screen. At most one per screen, and only for live or
 * time-critical data. Signals inside always use the dark colours.
 */
export function Display({ children, className, ...rest }: DisplayProps): React.ReactElement {
  return <div className={cx('bs-disp', className)} {...rest}>{children}</div>
}
