import React from 'react'

export interface SectionProps {
  /** Only on the major breaks of a long page ("01"). Never on sub-sections. */
  number?: string
  title: React.ReactNode
  /** h2 for page sections, h3 for sub-sections. */
  level?: 2 | 3
  /** Right-aligned label or Signal. */
  aside?: React.ReactNode
  id?: string
}

/** Section head: optional number, title, optional aside, then a 1px rule. */
export function Section({ number, title, level = 2, aside, id }: SectionProps): React.ReactElement {
  const Heading = level === 2 ? 'h2' : 'h3'
  return (
    <div className="bs-sec">
      {number && <span className="bs-sec-n" aria-hidden="true">{number}</span>}
      <Heading id={id} className={`bs-sec-title ${level === 2 ? 'bs-h2' : 'bs-h3'}`}>{title}</Heading>
      {aside && <span className="bs-sec-aside bs-lbl">{aside}</span>}
    </div>
  )
}

export interface GroupHeadProps {
  label: React.ReactNode
  /** Count or note on the right. */
  count?: React.ReactNode
}

/** Group head for lists: mono caps label over a 2px ink rule (Overdue, This week). */
export function GroupHead({ label, count }: GroupHeadProps): React.ReactElement {
  return (
    <div className="bs-group">
      <span className="bs-lbl">{label}</span>
      {count !== undefined && <span className="bs-lbl">{count}</span>}
    </div>
  )
}
