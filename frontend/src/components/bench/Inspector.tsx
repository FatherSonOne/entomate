import React from 'react'

export interface InspectorField {
  label: string
  value: React.ReactNode
}

export interface InspectorProps {
  title?: React.ReactNode
  fields: ReadonlyArray<InspectorField>
  /** Extra content under the fields (the agent's reason). */
  children?: React.ReactNode
  /** Override / Accept keys. */
  actions?: React.ReactNode
}

/** Sunk panel in the context column for the selected row. */
export function Inspector({ title, fields, children, actions }: InspectorProps): React.ReactElement {
  return (
    <section className="bs-inspector">
      {title && <div className="bs-h3">{title}</div>}
      <dl>
        {fields.map((f) => (
          <div className="bs-field" key={f.label}>
            <dt className="bs-lbl">{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
      {children}
      {actions && <div className="bs-inspector-acts">{actions}</div>}
    </section>
  )
}
