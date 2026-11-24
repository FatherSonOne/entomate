import React, { useEffect, useMemo, useRef, useState } from 'react'
import { LOGO_MOTIONS, renderLogoMotion } from './logoMotion'
import { CIRCUIT_FINISH, CIRCUIT_MARK_IDS, renderCircuitMark } from './circuitMarks'
import { isLogoId, logoAsset, useLogoSystem } from '../services/logoSystem'
import { prefersReducedMotion } from './bench/motion'
import './AnimatedLoadingLogo.css'

/**
 * The animated mark of a logo system. Uses the system picked in
 * Settings > Appearance unless `logoId` is given (the picker's previews).
 * `size` picks the artwork resolution: 512 for small stages, 1024 full screen.
 * `controls={false}` drops the Pause key (previews inside another control).
 */
export default function AnimatedLoadingLogo({ logoId, size = 512, controls = true }) {
  const picked = useLogoSystem().id
  const id = isLogoId(logoId) ? logoId : picked
  const artRef = useRef(null)
  const [playing, setPlaying] = useState(() => !prefersReducedMotion())
  const [manual, setManual] = useState(false)
  const [supported, setSupported] = useState(true)
  const [failed, setFailed] = useState(false)
  // The circuit marks are drawn in vector; the rest animate cut-outs of their artwork
  const markup = useMemo(() => (CIRCUIT_MARK_IDS.includes(id)
    ? renderCircuitMark(id, CIRCUIT_FINISH, 6, LOGO_MOTIONS[id].name)
    : renderLogoMotion(id, logoAsset(id, size), 6, LOGO_MOTIONS[id].name)), [id, size])

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
    // Paused (or reduced motion): show the whole still mark, not a frame with parts cut away
    svg.classList.toggle('motion-still', !playing)
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
      {controls && supported && !failed && (
        <button className="en-app-loading-motion-control" type="button"
          onClick={() => {
            if (!playing) setManual(true)
            setPlaying(value => !value)
          }}>
          {playing ? 'Pause loading animation' : 'Play loading animation'}
        </button>
      )}
    </div>
  )
}
