import React, { useEffect, useSyncExternalStore } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { rememberLabel, subscribeTrail, trailFor, trailVersion } from '../../services/navTrail'

export interface BreadcrumbsProps {
  /** The current page's name (meeting or project title). Not a link. */
  current: string
}

/**
 * Detail-page breadcrumbs: the way back to where the page was opened from
 * (Projects / Acme rollout / Kickoff), or the page's section when there is no
 * trail. Mono caps, sits above the title inside TitleRule. On phones only the
 * nearest link shows, as "← Projects".
 */
export function Breadcrumbs({ current }: BreadcrumbsProps): React.ReactElement {
  const { pathname } = useLocation()
  // Re-render when the trail is written (the recorder runs after this page renders).
  useSyncExternalStore(subscribeTrail, trailVersion, trailVersion)
  const trail = trailFor(pathname)

  // Name this page for crumbs on the pages opened from it.
  useEffect(() => {
    if (current) rememberLabel(pathname, current)
  }, [pathname, current])

  return (
    <nav aria-label="Breadcrumb" className="bs-crumbs">
      <ol>
        {trail.map((c, i) => (
          <li key={c.to} className={i === trail.length - 1 ? 'bs-crumbs-up' : undefined}>
            <Link to={c.to} state={{ crumb: true }} className="bs-crumbs-link">
              <span className="bs-crumbs-back" aria-hidden="true">←</span>
              <span className="bs-crumbs-label">{c.label}</span>
            </Link>
            <span className="bs-crumbs-sep" aria-hidden="true">/</span>
          </li>
        ))}
        <li className="bs-crumbs-here" aria-current="page"><span className="bs-crumbs-label">{current}</span></li>
      </ol>
    </nav>
  )
}
