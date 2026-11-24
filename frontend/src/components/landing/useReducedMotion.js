import { useEffect, useState } from 'react'
import { prefersReducedMotion } from '../bench/motion'

const QUERY = '(prefers-reduced-motion: reduce)'

/** True when the OS or Entomate preference asks for reduced motion. */
export default function useReducedMotion() {
  const [reduced, setReduced] = useState(prefersReducedMotion)
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const update = () => setReduced(prefersReducedMotion())
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributeFilter: ['data-motion'] })
    mq.addEventListener('change', update)
    return () => {
      observer.disconnect()
      mq.removeEventListener('change', update)
    }
  }, [])
  return reduced
}
