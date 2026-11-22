import React, { useEffect, useRef } from 'react'
import { useLoading } from '../contexts/LoadingContext'
import AnimatedLoadingLogo from './AnimatedLoadingLogo'
import { Wordmark } from './Logo'
import { isLogoId, logoById, useLogoSystem } from '../services/logoSystem'
import { loaderMounted, loaderUnmounted } from '../services/loaderHandoff'
import './EnhancedLoadingScreen.css'

/*
 * Loading screen, Bench Swiss "Instrument" (Settings > Appearance, 2026-11-22).
 * The logo system's animation fills the screen, centred, on black (its motion
 * colours only read on a dark ground). The wordmark, the system name and the
 * status rows sit small in the corners. Status rows say what is really
 * happening for the caller; there is no invented percentage.
 */
const STAGE_ROWS = {
  session: [['Session', 'live', 'Checking'], ['Workspace', 'off', 'Waiting']],
  signin: [['Sign-in', 'live', 'Signing in'], ['Workspace', 'off', 'Waiting']],
  page: [['Session', 'mint', 'Done'], ['Page', 'live', 'Loading']],
  preview: [['Session', 'mint', 'Done'], ['Workspace', 'live', 'Loading'], ['Today', 'off', 'Waiting']],
}

/**
 * @param {object} props
 * @param {boolean} [props.autoAnimate=true] true when the caller has no real progress to report.
 *   false reads the stage label and progress from LoadingContext.
 * @param {'session'|'signin'|'page'|'preview'} [props.stage='session'] what the caller is waiting on.
 * @param {string} [props.logoId] show this logo system instead of the one in use (picker preview).
 * @param {() => void} [props.onClose] preview only: shows a Close key and closes on Escape.
 */
export default function EnhancedLoadingScreen({ autoAnimate = true, stage = 'session', logoId, onClose }) {
  const loadingContext = useLoading()
  const picked = useLogoSystem()
  const logo = isLogoId(logoId) ? logoById(logoId) : picked

  // Real loaders (not the picker preview) hand off to the app when the last one goes
  const logoRef = useRef(logo.id)
  logoRef.current = logo.id
  useEffect(() => {
    if (onClose) return undefined
    loaderMounted()
    return () => loaderUnmounted(logoRef.current)
  }, [onClose])

  useEffect(() => {
    if (!onClose) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const real = !autoAnimate
  const progress = Math.max(0, Math.min(100, Math.round(loadingContext.progress || 0)))
  const label = real ? loadingContext.currentStageLabel : (STAGE_ROWS[stage] || STAGE_ROWS.session).find(([, tone]) => tone === 'live')?.[2] || 'Loading'
  const rows = real
    ? [[String(loadingContext.currentStageLabel || 'Loading').replace(/\.+$/, ''), 'live', `${progress}%`]]
    : (STAGE_ROWS[stage] || STAGE_ROWS.session)

  return (
    <div className={`en-loader${onClose ? ' en-loader--preview' : ''}`} role={onClose ? 'dialog' : 'status'}
      aria-live={onClose ? undefined : 'polite'} aria-modal={onClose ? 'true' : undefined}
      aria-label={onClose ? `${logo.name} loading screen preview` : `Loading: ${label}`} data-logo={logo.id}>
      <div className="en-loader-stage">
        <AnimatedLoadingLogo logoId={logo.id} size={1024} />
      </div>

      <div className="en-loader-corner en-loader-tl en-signal-loader-wordmark"><Wordmark width={120} /></div>

      <div className="en-loader-corner en-loader-tr">
        <span className="en-loader-lbl">EN-01 · {logo.name}</span>
        <span className="en-loader-lbl">{logo.motion}</span>
        {onClose && <button type="button" className="en-loader-close" onClick={onClose} autoFocus>Close preview</button>}
      </div>

      <div className="en-loader-corner en-loader-bl">
        <ul className="en-loader-rows">
          {rows.map(([name, tone, word]) => (
            <li key={name}>
              <span>{name}</span>
              <span className="en-loader-sig"><i className={`en-loader-led en-loader-led--${tone}`} aria-hidden="true" />{word}</span>
            </li>
          ))}
        </ul>
        {real && (
          <div className="en-signal-loader-track" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
    </div>
  )
}
