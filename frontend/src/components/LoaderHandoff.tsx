import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { logoAsset } from '../services/logoSystem'
import { onLoaderExit } from '../services/loaderHandoff'
import './LoaderHandoff.css'

const reducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Size of the loader's centred art, as EnhancedLoadingScreen.css draws it: min(94vmin, 100vw). */
function loaderArtSize(): number {
  const { innerWidth: w, innerHeight: h } = window
  return Math.min(0.94 * Math.min(w, h), w)
}

/** The shell's brand mark that is on screen now (rail on desktop, toolbar on phone). */
function visibleBrandMark(): DOMRect | null {
  for (const el of document.querySelectorAll<HTMLElement>('[data-brand-mark]')) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight) return r
  }
  return null
}

/* The full-canvas art carries padding around the symbol; the shell uses a tight
   crop. Landing the canvas at this multiple of the target puts the symbol on it. */
const CANVAS_TO_CROP = 1.7
const EASE = 'cubic-bezier(0.2, 0.7, 0.1, 1)'

/**
 * When the last loading screen goes, its mark shrinks into the shell's brand
 * mark while the black ground fades off the app underneath. Mounted once at
 * the app root. With reduced motion it is a short fade, no movement.
 */
export default function LoaderHandoff(): React.ReactElement | null {
  const [logoId, setLogoId] = useState<string | null>(null)
  const groundRef = useRef<HTMLDivElement>(null)
  const markRef = useRef<HTMLImageElement>(null)

  useEffect(() => onLoaderExit((id) => setLogoId(id)), [])

  useEffect(() => {
    const ground = groundRef.current
    const mark = markRef.current
    if (!logoId || !ground || !mark) return undefined
    let cancelled = false
    const animations: Animation[] = []
    const done = (): void => { if (!cancelled) setLogoId(null) }

    if (typeof ground.animate !== 'function') {
      done()
      return undefined
    }

    const size = loaderArtSize()
    mark.style.width = `${size}px`
    mark.style.height = `${size}px`

    if (reducedMotion()) {
      const fade = ground.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'linear', fill: 'forwards' })
      animations.push(fade, mark.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }))
      fade.finished.then(done, done)
      return () => { cancelled = true; animations.forEach((a) => a.cancel()) }
    }

    // Wait one frame so the shell has laid out before measuring its mark
    const frame = requestAnimationFrame(() => {
      if (cancelled) return
      const target = visibleBrandMark()
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      let flight: Animation
      if (target) {
        const dx = target.left + target.width / 2 - cx
        const dy = target.top + target.height / 2 - cy
        const scale = (target.width * CANVAS_TO_CROP) / size
        flight = mark.animate([
          { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
          { opacity: 1, offset: 0.72 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scale})`, opacity: 0 },
        ], { duration: 640, easing: EASE, fill: 'forwards' })
      } else {
        flight = mark.animate([
          { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
          { transform: 'translate(-50%, -50%) scale(0.6)', opacity: 0 },
        ], { duration: 380, easing: EASE, fill: 'forwards' })
      }
      animations.push(flight, ground.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 460, delay: 60, easing: 'ease-out', fill: 'forwards' }))
      flight.finished.then(done, done)
    })
    return () => { cancelled = true; cancelAnimationFrame(frame); animations.forEach((a) => a.cancel()) }
  }, [logoId])

  if (!logoId) return null
  return createPortal(
    <div className="en-handoff" aria-hidden="true">
      <div className="en-handoff-ground" ref={groundRef} />
      <img className="en-handoff-mark" ref={markRef} src={logoAsset(logoId, 1024)} alt="" />
    </div>,
    document.body,
  )
}
