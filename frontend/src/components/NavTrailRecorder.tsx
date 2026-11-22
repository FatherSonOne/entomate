import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { recordNavigation, type NavLocation } from '../services/navTrail'

/**
 * Remembers where each detail page was opened from, for its breadcrumbs.
 * Renders nothing; mounted once inside the router.
 */
export default function NavTrailRecorder(): null {
  const location = useLocation()
  const navType = useNavigationType()
  const prevRef = useRef<NavLocation | null>(null)

  useEffect(() => {
    const state = location.state as { crumb?: unknown } | null
    recordNavigation(prevRef.current, location, navType, state?.crumb === true)
    prevRef.current = { pathname: location.pathname, search: location.search }
  }, [location, navType])

  return null
}
