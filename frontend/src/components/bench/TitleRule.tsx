import React from 'react'

export interface TitleRuleProps {
  /** Module or record name. Never numbered. */
  title: React.ReactNode
  /** Mono caps meta, top right (dates, counts, breadcrumb). Wrap emphasis in <b>. */
  meta?: React.ReactNode
  /** Page actions: keys, a filter switch. One primary key at most. */
  actions?: React.ReactNode
  /** Heading id, for aria-labelledby on the page region. */
  id?: string
  /** Detail pages: <Breadcrumbs>, shown above the title. */
  crumbs?: React.ReactNode
}

/** Every screen opens with a title rule: name, meta and actions, then a 2px ink rule. */
export function TitleRule({ title, meta, actions, id, crumbs }: TitleRuleProps): React.ReactElement {
  return (
    <header className="bs-title">
      {crumbs && <div className="bs-title-crumbs">{crumbs}</div>}
      <h1 id={id}>{title}</h1>
      {(meta || actions) && (
        <div className="bs-title-meta">
          {meta && <span className="bs-crumb">{meta}</span>}
          {actions && <div className="bs-title-acts">{actions}</div>}
        </div>
      )}
    </header>
  )
}
