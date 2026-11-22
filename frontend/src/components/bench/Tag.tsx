import React from 'react'
import { cx } from './cx'

export interface TagProps {
  /** ai = amber text, for agent confidence ("AI 92%"). */
  tone?: 'plain' | 'ai'
  children: React.ReactNode
  className?: string
}

/** 22px sunk mono tag. */
export function Tag({ tone = 'plain', children, className }: TagProps): React.ReactElement {
  return <span className={cx('bs-tag', tone === 'ai' && 'ai', className)}>{children}</span>
}
