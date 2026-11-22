import { useEffect, useState } from 'react'

/** Phone layout: drawers become bottom sheets below this width. */
export const PHONE_QUERY = '(max-width: 767.98px)'

/** Subscribe to a CSS media query. Returns false during SSR. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false
  )

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(query)
    const update = (): void => setMatches(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [query])

  return matches
}
