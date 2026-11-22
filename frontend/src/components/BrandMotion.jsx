import React, { useEffect, useRef, useState } from 'react'
import './BrandMotion.css'

/** Decorative brand footage: still first, opt-in motion when reduced motion is set. */
export default function BrandMotion({ clip = 'hands', className = '', controls = true }) {
  const ref = useRef(null)
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const base = `/brand-lab/assets/motion/${clip}`

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (event) => { if (event.matches) setPlaying(false) }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const video = ref.current
    if (!video) return
    let visible = false
    const sync = () => {
      if (playing && visible && !document.hidden && !failed) {
        if (!video.getAttribute('src')) video.src = `${base}.mp4`
        video.play().catch(() => setPlaying(false))
      } else video.pause()
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      sync()
    }, { threshold: 0.05 })
    observer.observe(video)
    document.addEventListener('visibilitychange', sync)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', sync)
      video.pause()
    }
  }, [base, playing, failed])

  return (
    <div className={`brand-motion ${ready && !failed ? 'brand-motion-ready' : ''} ${className}`}>
      <img className="brand-motion-poster" src={`${base}.jpg`} alt="" aria-hidden="true" />
      <video key={clip} ref={ref} className="brand-motion-video" muted loop playsInline
        preload="none" poster={`${base}.jpg`} aria-hidden="true"
        onLoadedData={() => { setReady(true); setFailed(false) }}
        onError={() => { setFailed(true); setReady(false) }} />
      {controls && !failed && (
        <button type="button" className="brand-motion-control" onClick={() => setPlaying(value => !value)}
          aria-label={playing ? 'Pause background animation' : 'Play background animation'}>
          <span aria-hidden="true">{playing ? 'Ⅱ' : '▷'}</span>{' '}
          <span className="brand-motion-label">{playing ? 'Pause motion' : 'Play motion'}</span>
        </button>
      )}
    </div>
  )
}
