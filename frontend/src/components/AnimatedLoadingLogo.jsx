import React, { useEffect, useMemo, useRef, useState } from 'react'
import { nextLoadingLogo } from './loadingLogoRotation'
import { LOGO_MOTIONS, renderLogoMotion } from './logoMotion'
import './AnimatedLoadingLogo.css'

// All loader instances share one direction until the next full app load.
// Keeping this outside React also prevents Strict Mode from advancing twice.
const appLoadingLogo = nextLoadingLogo()

export default function AnimatedLoadingLogo() {
  const artRef = useRef(null)
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [manual, setManual] = useState(false)
  const [supported, setSupported] = useState(true)
  const [failed, setFailed] = useState(false)
  const markup = useMemo(() => renderLogoMotion(
    appLoadingLogo,
    `/brand-lab/assets/illustrated/${appLoadingLogo}.png`,
    6,
    LOGO_MOTIONS[appLoadingLogo].name,
  ), [])

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = event => {
      if (event.matches) {
        setPlaying(false)
        setManual(false)
      }
    }
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])

  useEffect(() => {
    const svg = artRef.current?.querySelector('svg')
    if (!svg || failed) return
    if (typeof svg.pauseAnimations !== 'function') {
      setSupported(false)
      return
    }
    let visible = false
    svg.pauseAnimations()
    svg.classList.toggle('motion-opt-in', manual)
    const sync = () => {
      if (playing && visible && !document.hidden) svg.unpauseAnimations()
      else svg.pauseAnimations()
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      sync()
    }, { threshold: 0.02 })
    const image = svg.querySelector('image')
    const error = () => setFailed(true)
    image?.addEventListener('error', error)
    observer.observe(svg)
    document.addEventListener('visibilitychange', sync)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', sync)
      image?.removeEventListener('error', error)
      svg.pauseAnimations()
    }
  }, [playing, manual, failed])

  return (
    <div className={`en-app-loading-logo ${supported ? '' : 'en-app-loading-still'}`} data-loading-logo={appLoadingLogo}>
      {failed ? (
        <img className="en-app-loading-logo-art" src="/favicon.svg" alt="" aria-hidden="true" />
      ) : (
        <div className="en-app-loading-logo-art" ref={artRef} aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: markup }} />
      )}
      {supported && !failed && (
        <button className="en-app-loading-motion-control" type="button"
          aria-label={playing ? 'Pause loading animation' : 'Play loading animation'}
          onClick={() => {
            if (!playing) setManual(true)
            setPlaying(value => !value)
          }}>
          {playing ? 'Ⅱ Pause animation' : '▷ Play animation'}
        </button>
      )}
    </div>
  )
}
