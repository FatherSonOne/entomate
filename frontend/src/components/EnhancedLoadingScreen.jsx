import React, { useEffect, useState, useRef } from 'react'
import { useLoading } from '../contexts/LoadingContext'
import AnimatedLoadingLogo from './AnimatedLoadingLogo'
import { Wordmark } from './Logo'

export default function EnhancedLoadingScreen({ autoAnimate = true, inline = false }) {
  const loadingContext = useLoading()
  const [displayProgress, setDisplayProgress] = useState(0)
  const animationRef = useRef(null)
  const startTimeRef = useRef(null)

  useEffect(() => {
    if (!autoAnimate) {
      setDisplayProgress(loadingContext.progress)
      return
    }
    const duration = 6000
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

    const tick = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp
      const elapsed = timestamp - startTimeRef.current
      const raw = Math.min(elapsed / duration, 1)
      setDisplayProgress(easeOutCubic(raw) * 100)
      if (raw < 1) animationRef.current = requestAnimationFrame(tick)
    }
    animationRef.current = requestAnimationFrame(tick)
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current) }
  }, [autoAnimate, loadingContext.progress])

  const progress = autoAnimate ? displayProgress : loadingContext.progress

  // Stage labels
  const stageMessages = [
    'Authenticating...',
    'Restoring session...',
    'Loading intelligence...',
    'Syncing services...',
    'Almost ready...',
  ]
  const stageIndex = Math.min(Math.floor(progress / 20), stageMessages.length - 1)
  const stageLabel = autoAnimate ? stageMessages[stageIndex] : loadingContext.currentStageLabel

  return (
    <div className={`en-signal-loader ${inline ? 'en-signal-inline' : 'en-signal-full'}`}
      role="status" aria-live="polite" aria-label={`Loading: ${stageLabel}`}>
      <div className="en-signal-loader-content">
        <AnimatedLoadingLogo />
        <div className="en-signal-loader-wordmark"><Wordmark width={178} /></div>
        <div className="en-signal-loader-track" aria-hidden="true">
          <span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
        <p className="en-signal-loader-label">{stageLabel}</p>
        <span className="en-signal-loader-percent" aria-hidden="true">{Math.round(progress)}%</span>
      </div>
      <style>{`
        .en-signal-loader { display: flex; align-items: center; justify-content: center; background: #080808; color: #f8f0f2; }
        .en-signal-full { position: fixed; inset: 0; z-index: 9999; }
        .en-signal-inline { width: 100%; min-height: min(560px, 100svh); height: 100%; }
        .en-signal-loader-content { width: min(500px, 92vw); text-align: center; padding: 36px 12px; }
        .en-signal-loader-wordmark { display: flex; align-items: center; width: 178px; height: 36px; margin: 0 auto; }
        .en-signal-loader-track { width: 220px; height: 2px; background: #312a30; margin: 32px auto 20px; }
        .en-signal-loader-track span { display: block; height: 2px; background: #ff2d6b; transition: width 180ms linear; }
        .en-signal-loader-label { margin: 0 0 12px; font: 12px/1.5 system-ui, sans-serif; color: #b9aeb6; }
        .en-signal-loader-percent { font: 11px/1.5 monospace; color: #00f5d4; }
        @media (prefers-reduced-motion: reduce) { .en-signal-loader-track span { transition: none; } }
      `}</style>
    </div>
  )
}
