import React from 'react'
import { cx } from './cx'

export interface FaceplateProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

/** One faceplate per screen. Regions inside are split by hairline rules, never cards. */
export function Faceplate({ children, className, ...rest }: FaceplateProps): React.ReactElement {
  return (
    <div className={cx('bs-plate', className)} {...rest}>
      <i className="bs-screw s1" aria-hidden="true" />
      <i className="bs-screw s2" aria-hidden="true" />
      <i className="bs-screw s3" aria-hidden="true" />
      <i className="bs-screw s4" aria-hidden="true" />
      {children}
    </div>
  )
}

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

/** The 12-column grid (24px gutters). Collapses to one column on phone. */
export function Grid({ children, className, ...rest }: GridProps): React.ReactElement {
  return <div className={cx('bs-g12', className)} {...rest}>{children}</div>
}

export type CellSpan = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 12

export interface CellProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Columns out of 12. Content is 8, context is 4. */
  span: CellSpan
  /** Draw the hairline on the left (the context column). */
  rule?: boolean
  /** Hide on phone (secondary content). */
  desktopOnly?: boolean
  children: React.ReactNode
}

export function Cell({ span, rule = false, desktopOnly = false, children, className, ...rest }: CellProps): React.ReactElement {
  return (
    <div className={cx('bs-cell', `bs-c${span}`, rule && 'bs-vr', desktopOnly && 'bs-dt', className)} {...rest}>
      {children}
    </div>
  )
}
