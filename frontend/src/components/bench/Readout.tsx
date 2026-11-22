import React from 'react'

export interface ReadoutProps {
  label: React.ReactNode
  /** The number, set in 30px mono. */
  value: React.ReactNode
  /** One line of context. */
  context?: React.ReactNode
}

/** A label, a big mono number and one line of context. Stack them in the context column. */
export function Readout({ label, value, context }: ReadoutProps): React.ReactElement {
  return (
    <div className="bs-readout">
      <span className="bs-lbl">{label}</span>
      <b>{value}</b>
      {context && <span className="bs-readout-ctx">{context}</span>}
    </div>
  )
}
