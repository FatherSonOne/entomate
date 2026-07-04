// EnhancedLoadingScreen.jsx
// Neural Catalyst loading animation — unique to Entomate's AI meeting intelligence brand
// Features: Orbiting intelligence nodes, pulsing neural connections, progress ring, stage messaging
// Brand: Void Crimson — Electric Crimson #FF2D6B · Neon Mint #00F5D4 · Crimson-bright #FF6699
// (amber #FFB800 and phosphor #A0FF32 are reserved signals; never used as loader decoration)

import React, { useEffect, useState, useRef } from 'react'
import { useLoading } from '../contexts/LoadingContext'

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

  // Progress ring
  const ringSize = 200
  const ringCenter = ringSize / 2
  const ringRadius = 88
  const circumference = 2 * Math.PI * ringRadius
  const strokeDashoffset = circumference - (progress / 100) * circumference

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
    <div
      className={`${inline ? 'h-full w-full' : 'fixed inset-0 z-[9999]'} flex items-center justify-center`}
      role="status"
      aria-live="polite"
      aria-label={`Loading: ${stageLabel} - ${Math.round(progress)}% complete`}
    >
      <div className="en-loading-bg" />

      <div className="en-loading-content">
        {/* Logo + Progress Ring Container */}
        <div className="en-loading-logo-container">
          {/* SVG Progress Ring */}
          <svg className="en-loading-progress-ring" viewBox={`0 0 ${ringSize} ${ringSize}`} aria-hidden="true">
            <defs>
              <linearGradient id="en-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FF2D6B" />
                <stop offset="50%" stopColor="#00F5D4" />
                <stop offset="100%" stopColor="#FF6699" />
              </linearGradient>
            </defs>

            {/* Background ring */}
            <circle cx={ringCenter} cy={ringCenter} r={ringRadius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />

            {/* Tick marks */}
            {Array.from({ length: 40 }).map((_, i) => {
              const angle = (i * 360) / 40 - 90
              const rad = (angle * Math.PI) / 180
              const isMajor = i % 10 === 0
              const innerR = isMajor ? ringRadius - 8 : ringRadius - 5
              const outerR = ringRadius + (isMajor ? 4 : 2)
              const lit = (i / 40) * 100 <= progress
              return (
                <line
                  key={i}
                  x1={ringCenter + innerR * Math.cos(rad)}
                  y1={ringCenter + innerR * Math.sin(rad)}
                  x2={ringCenter + outerR * Math.cos(rad)}
                  y2={ringCenter + outerR * Math.sin(rad)}
                  stroke={lit ? '#FF2D6B' : 'rgba(255,255,255,0.08)'}
                  strokeWidth={isMajor ? 2 : 1}
                  strokeLinecap="round"
                  style={{ opacity: lit ? 0.9 : 0.3, transition: 'stroke 0.3s, opacity 0.3s' }}
                />
              )
            })}

            {/* Progress arc */}
            <circle
              cx={ringCenter}
              cy={ringCenter}
              r={ringRadius}
              fill="none"
              stroke="url(#en-ring-grad)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{
                transform: 'rotate(-90deg)',
                transformOrigin: 'center',
                transition: 'stroke-dashoffset 0.4s ease-out',
                filter: 'drop-shadow(0 0 6px #FF2D6B)',
              }}
            />

            {/* Progress head glow */}
            {progress > 0 && progress < 100 && (
              <circle
                cx={ringCenter + ringRadius * Math.cos(((progress / 100) * 360 - 90) * (Math.PI / 180))}
                cy={ringCenter + ringRadius * Math.sin(((progress / 100) * 360 - 90) * (Math.PI / 180))}
                r="5"
                fill="#FF2D6B"
                style={{
                  filter: 'drop-shadow(0 0 8px #FF2D6B)',
                  transition: 'cx 0.4s ease-out, cy 0.4s ease-out',
                }}
              />
            )}
          </svg>

          {/* Neural Catalyst Logo Animation */}
          <div className="en-loading-logo-inner">
            <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="en-loading-neural-logo">
              <defs>
                <radialGradient id="en-catalyst-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#FF2D6B" stopOpacity="1" />
                  <stop offset="40%" stopColor="#FF2D6B" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#FF6699" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="en-neural-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FF2D6B" stopOpacity="0.7" />
                  <stop offset="50%" stopColor="#00F5D4" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#FF6699" stopOpacity="0.3" />
                </linearGradient>
              </defs>

              {/* Orbital rings — faint structure */}
              <circle cx="60" cy="60" r="48" stroke="#FF2D6B" strokeWidth="0.3" fill="none" opacity="0.12" />
              <circle cx="60" cy="60" r="36" stroke="#00F5D4" strokeWidth="0.4" fill="none" opacity="0.10" />
              <circle cx="60" cy="60" r="24" stroke="#FF6699" strokeWidth="0.5" fill="none" opacity="0.08" />

              {/* Neural connection lines — pulsing */}
              <line className="en-neural-line en-neural-line-1" x1="60" y1="60" x2="60" y2="12" stroke="url(#en-neural-grad)" strokeWidth="0.8" />
              <line className="en-neural-line en-neural-line-2" x1="60" y1="60" x2="101" y2="36" stroke="url(#en-neural-grad)" strokeWidth="0.8" />
              <line className="en-neural-line en-neural-line-3" x1="60" y1="60" x2="101" y2="84" stroke="url(#en-neural-grad)" strokeWidth="0.8" />
              <line className="en-neural-line en-neural-line-4" x1="60" y1="60" x2="60" y2="108" stroke="url(#en-neural-grad)" strokeWidth="0.8" />
              <line className="en-neural-line en-neural-line-5" x1="60" y1="60" x2="19" y2="84" stroke="url(#en-neural-grad)" strokeWidth="0.8" />
              <line className="en-neural-line en-neural-line-6" x1="60" y1="60" x2="19" y2="36" stroke="url(#en-neural-grad)" strokeWidth="0.8" />

              {/* Orbiting intelligence nodes */}
              <circle className="en-orbit-node en-orbit-node-1" cx="60" cy="12" r="4" fill="#FF2D6B" />
              <circle className="en-orbit-node en-orbit-node-2" cx="101" cy="36" r="3.5" fill="#00F5D4" />
              <circle className="en-orbit-node en-orbit-node-3" cx="101" cy="84" r="3" fill="#FF6699" />
              <circle className="en-orbit-node en-orbit-node-4" cx="60" cy="108" r="4" fill="#FF2D6B" />
              <circle className="en-orbit-node en-orbit-node-5" cx="19" cy="84" r="3.5" fill="#00F5D4" />
              <circle className="en-orbit-node en-orbit-node-6" cx="19" cy="36" r="3" fill="#FF6699" />

              {/* Data pulse particles traveling along connections */}
              <circle className="en-data-pulse en-data-pulse-1" r="1.5" fill="#FF2D6B">
                <animateMotion dur="2.4s" repeatCount="indefinite" path="M60,60 L60,12" />
              </circle>
              <circle className="en-data-pulse en-data-pulse-2" r="1.5" fill="#00F5D4">
                <animateMotion dur="2.8s" repeatCount="indefinite" begin="0.4s" path="M60,60 L101,36" />
              </circle>
              <circle className="en-data-pulse en-data-pulse-3" r="1.5" fill="#FF6699">
                <animateMotion dur="3.2s" repeatCount="indefinite" begin="0.8s" path="M60,60 L101,84" />
              </circle>
              <circle className="en-data-pulse en-data-pulse-4" r="1.5" fill="#FF2D6B">
                <animateMotion dur="2.6s" repeatCount="indefinite" begin="1.2s" path="M60,60 L60,108" />
              </circle>
              <circle className="en-data-pulse en-data-pulse-5" r="1.5" fill="#00F5D4">
                <animateMotion dur="3s" repeatCount="indefinite" begin="1.6s" path="M60,60 L19,84" />
              </circle>
              <circle className="en-data-pulse en-data-pulse-6" r="1.5" fill="#FF6699">
                <animateMotion dur="2.2s" repeatCount="indefinite" begin="2s" path="M60,60 L19,36" />
              </circle>

              {/* Central catalyst core */}
              <circle cx="60" cy="60" r="14" className="en-catalyst-outer" fill="url(#en-catalyst-glow)" />
              <circle cx="60" cy="60" r="8" className="en-catalyst-core" fill="#FF2D6B" />
              <circle cx="60" cy="60" r="3" className="en-catalyst-spark" fill="white" />
            </svg>
          </div>
        </div>

        {/* Progress percentage */}
        <div className="en-loading-progress-text">
          <span className="en-loading-progress-number">{Math.round(progress)}</span>
          <span className="en-loading-progress-percent">%</span>
        </div>

        {/* Stage label */}
        <div className="en-loading-stage-label" key={stageLabel}>
          {stageLabel}
        </div>

        {/* Loading dots */}
        <div className="en-loading-dots">
          <span className="en-loading-dot en-loading-dot-1" />
          <span className="en-loading-dot en-loading-dot-2" />
          <span className="en-loading-dot en-loading-dot-3" />
        </div>

        {/* Version badge */}
        <div className={`en-loading-version-badge ${inline ? '' : 'en-loading-version-fixed'}`}>
          <span className="en-loading-version-label">ENTOMATE</span>
          <span className="en-loading-version-divider">|</span>
          <span className="en-loading-version-number">v1.0</span>
        </div>
      </div>

      <style>{`
        /* ── Background ──────────────────────────────── */
        .en-loading-bg {
          position: absolute;
          inset: 0;
          background: #080808;
          background-image:
            radial-gradient(ellipse 80% 60% at 50% 40%, rgba(255,45,107,0.05) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 30% 70%, rgba(0,212,180,0.04) 0%, transparent 50%),
            radial-gradient(ellipse 40% 40% at 70% 30%, rgba(155,109,255,0.03) 0%, transparent 40%);
        }

        .en-loading-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 16px;
          max-height: 100vh;
          max-height: 100dvh;
          animation: en-loading-fade-in 0.6s ease-out;
        }

        @keyframes en-loading-fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── Logo + Ring Container ────────────────────── */
        .en-loading-logo-container {
          position: relative;
          width: 200px;
          height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .en-loading-progress-ring {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }

        .en-loading-logo-inner {
          width: 140px;
          height: 140px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .en-loading-neural-logo {
          width: 140px;
          height: 140px;
        }

        @media (max-height: 600px) {
          .en-loading-logo-container { width: 150px; height: 150px; }
          .en-loading-logo-inner,
          .en-loading-neural-logo { width: 105px; height: 105px; }
        }

        /* ── Neural Connection Lines — pulse opacity ── */
        .en-neural-line {
          animation: en-neural-pulse 2.4s ease-in-out infinite;
        }
        .en-neural-line-1 { animation-delay: 0s; }
        .en-neural-line-2 { animation-delay: 0.4s; }
        .en-neural-line-3 { animation-delay: 0.8s; }
        .en-neural-line-4 { animation-delay: 1.2s; }
        .en-neural-line-5 { animation-delay: 1.6s; }
        .en-neural-line-6 { animation-delay: 2s; }

        @keyframes en-neural-pulse {
          0%, 100% { opacity: 0.15; stroke-width: 0.5; }
          50% { opacity: 0.7; stroke-width: 1.2; }
        }

        /* ── Orbiting Intelligence Nodes ─────────────── */
        .en-orbit-node {
          animation: en-node-breathe 2s ease-in-out infinite;
          filter: drop-shadow(0 0 4px currentColor);
        }
        .en-orbit-node-1 { animation-delay: 0s; }
        .en-orbit-node-2 { animation-delay: 0.33s; }
        .en-orbit-node-3 { animation-delay: 0.66s; }
        .en-orbit-node-4 { animation-delay: 1s; }
        .en-orbit-node-5 { animation-delay: 1.33s; }
        .en-orbit-node-6 { animation-delay: 1.66s; }

        @keyframes en-node-breathe {
          0%, 100% { opacity: 0.5; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.15); }
        }

        /* ── Data Pulse Particles ─────────────────────── */
        .en-data-pulse {
          opacity: 0;
          animation: en-pulse-travel 2.4s ease-in-out infinite;
        }
        .en-data-pulse-1 { animation-delay: 0s; animation-duration: 2.4s; }
        .en-data-pulse-2 { animation-delay: 0.4s; animation-duration: 2.8s; }
        .en-data-pulse-3 { animation-delay: 0.8s; animation-duration: 3.2s; }
        .en-data-pulse-4 { animation-delay: 1.2s; animation-duration: 2.6s; }
        .en-data-pulse-5 { animation-delay: 1.6s; animation-duration: 3s; }
        .en-data-pulse-6 { animation-delay: 2s; animation-duration: 2.2s; }

        @keyframes en-pulse-travel {
          0% { opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }

        /* ── Central Catalyst Core ────────────────────── */
        .en-catalyst-outer {
          transform-origin: 60px 60px;
          animation: en-catalyst-breathe 2s ease-in-out infinite;
        }

        .en-catalyst-core {
          transform-origin: 60px 60px;
          animation: en-catalyst-pulse 2s ease-in-out infinite;
          filter: drop-shadow(0 0 10px #FF2D6B);
        }

        .en-catalyst-spark {
          transform-origin: 60px 60px;
          animation: en-catalyst-spark 2s ease-in-out infinite;
        }

        @keyframes en-catalyst-breathe {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.35); opacity: 0.7; }
        }

        @keyframes en-catalyst-pulse {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.15); opacity: 1; }
        }

        @keyframes en-catalyst-spark {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.5); opacity: 1; }
        }

        /* ── Progress Text ────────────────────────────── */
        .en-loading-progress-text {
          display: flex;
          align-items: baseline;
          gap: 2px;
          padding: 4px 0;
          font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
        }

        .en-loading-progress-number {
          font-size: 2.5rem;
          font-weight: 700;
          line-height: 1.2;
          letter-spacing: -0.02em;
          background: linear-gradient(135deg, #FF2D6B 0%, #00F5D4 50%, #FF6699 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 0 20px rgba(255,45,107,0.3));
        }

        .en-loading-progress-percent {
          font-size: 1.25rem;
          font-weight: 500;
          color: rgba(255,45,107,0.5);
        }

        /* ── Stage Label ──────────────────────────────── */
        .en-loading-stage-label {
          font-size: 0.95rem;
          font-weight: 500;
          color: rgba(148, 163, 184, 0.8);
          letter-spacing: 0.04em;
          animation: en-stage-fade 0.3s ease-out;
        }

        @keyframes en-stage-fade {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── Loading Dots ─────────────────────────────── */
        .en-loading-dots {
          display: flex;
          gap: 6px;
          justify-content: center;
        }

        .en-loading-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: linear-gradient(135deg, #FF2D6B, #00F5D4);
          animation: en-dot-bounce 1.4s ease-in-out infinite;
        }

        .en-loading-dot-1 { animation-delay: 0s; }
        .en-loading-dot-2 { animation-delay: 0.16s; }
        .en-loading-dot-3 { animation-delay: 0.32s; }

        @keyframes en-dot-bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1.2); opacity: 1; }
        }

        /* ── Version Badge ────────────────────────────── */
        .en-loading-version-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 16px;
          background: rgba(8, 8, 8, 0.8);
          border: 1px solid rgba(255, 45, 107, 0.12);
          border-radius: 999px;
          backdrop-filter: blur(8px);
        }

        .en-loading-version-fixed {
          margin-top: 8px;
        }

        .en-loading-version-label {
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          background: linear-gradient(135deg, #FF2D6B, #00F5D4);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .en-loading-version-divider {
          color: rgba(148, 163, 184, 0.2);
          font-size: 0.7rem;
        }

        .en-loading-version-number {
          font-size: 0.65rem;
          font-weight: 500;
          color: rgba(148, 163, 184, 0.5);
          letter-spacing: 0.05em;
        }
      `}</style>
    </div>
  )
}
