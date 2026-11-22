import React, { useEffect, useMemo, useRef, useState } from 'react'
import { LOGO_MOTIONS, renderLogoMotion } from './logoMotion'
import { isLogoId, logoAsset, useLogoSystem } from '../services/logoSystem'
import './AnimatedLoadingLogo.css'

/**
 * The animated mark of a logo system. Uses the system picked in
 * Settings > Appearance unless `logoId` is given (the picker's previews).
 * `size` picks the artwork resolution: 512 for small stages, 1024 full screen.
 */
export default function AnimatedLoadingLogo({ logoId, size = 512 }) {
  const picked = useLogoSystem().id
  const id = isLogoId(logoId) ? logoId : picked
  const artRef = useRef(null)
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [manual, setManual] = useState(false)
  const [supported, setSupported] = useState(true)
  const [failed, setFailed] = useState(false)
  const markup = useMemo(() => renderLogoMotion(id, logoAsset(id, size), 6, LOGO_MOTIONS[id].name), [id, size])

  useEffect(() => { setFailed(false) }, [id])

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
  }, [playing, manual, failed, markup])

  return (
    <div className={`en-app-loading-logo ${supported ? '' : 'en-app-loading-still'}`} data-loading-logo={id}>
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
          {playing ? 'Pause motion' : 'Play motion'}
        </button>
      )}
    </div>
  )
}
