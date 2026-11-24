import React, { useEffect, useRef, useState } from 'react'
import { useMotionPlayback } from './bench/motion'
import './BrandMotion.css'

/** Decorative brand footage: still first, opt-in motion when reduced motion is set. */
export default function BrandMotion({ clip = 'hands', className = '', controls = true, mediaDirectory = '/brand-lab/assets/motion', responsive = false, priority = false }) {
  const ref = useRef(null)
  const [playing, setPlaying, reduced] = useMotionPlayback()
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const base = `${mediaDirectory}/${clip}`

  useEffect(() => {
    const video = ref.current
    if (!video) return
    let visible = false
    const sync = () => {
      if (playing && visible && !document.hidden && !failed) {
        if (!video.getAttribute('src')) {
          const compact = responsive && window.matchMedia('(max-width: 760px)').matches
          video.src = `${base}${compact ? '-mobile' : ''}.mp4`
        }
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
  }, [base, playing, failed, responsive, setPlaying])

  return (
    <div className={`brand-motion ${ready && !failed && (!reduced || playing) ? 'brand-motion-ready' : ''} ${className}`}>
      <picture>
        {responsive && <source media="(max-width: 760px)" srcSet={`${base}-mobile.webp`} />}
        <img className="brand-motion-poster" src={`${base}.jpg`} alt="" aria-hidden="true"
          loading={priority ? 'eager' : 'lazy'} fetchpriority={priority ? 'high' : undefined} decoding="async" />
      </picture>
      <video key={clip} ref={ref} className="brand-motion-video" muted loop playsInline
        preload="none" aria-hidden="true"
        onLoadedData={() => { setReady(true); setFailed(false) }}
        onError={() => { setFailed(true); setReady(false) }} />
      {controls && !failed && (
        <button type="button" className="brand-motion-control" onClick={() => setPlaying(!playing)}
          aria-label={playing ? 'Pause background animation' : 'Play background animation'}>
          <span aria-hidden="true">{playing ? 'Ⅱ' : '▷'}</span>{' '}
          <span className="brand-motion-label">{playing ? 'Pause motion' : 'Play motion'}</span>
        </button>
      )}
    </div>
  )
}
