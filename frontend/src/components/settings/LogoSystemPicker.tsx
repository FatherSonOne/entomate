import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Display, GroupHead, Key, Signal } from '../bench'
import AnimatedLoadingLogo from '../AnimatedLoadingLogo'
import EnhancedLoadingScreen from '../EnhancedLoadingScreen'
import { Wordmark } from '../Logo'
import {
  LOGO_FAMILIES, logoAsset, logosInFamily, setLogo, useLogoSystem,
  type LogoSystem,
} from '../../services/logoSystem'
import '../../styles/logo-picker.css'

/** Default identity, and the one on the landing page; noted on their cards. */
const CARD_NOTES: Readonly<Record<string, string>> = {
  'relay-orbits': 'Default',
  aperture: 'Landing page',
}

function SizeProof({ logo, compact = false }: { logo: LogoSystem; compact?: boolean }): React.ReactElement {
  const icon = compact ? 32 : 56
  return (
    <div className={compact ? 'lp-proof lp-proof--compact' : 'lp-proof'}>
      <figure>
        <Display className="lp-proof-icon"><img src={logoAsset(logo.id, 128)} alt="" width={icon} height={icon} /></Display>
        <figcaption className="bs-lbl">App icon</figcaption>
      </figure>
      <figure>
        <span className="lp-lockup lp-lockup--28"><img src={logoAsset(logo.id, 'small')} alt="" width={28} height={28} /><Wordmark width={96} /></span>
        <figcaption className="bs-lbl">Menu · 28</figcaption>
      </figure>
      <figure>
        <span className="lp-lockup lp-lockup--22"><img src={logoAsset(logo.id, 'small')} alt="" width={22} height={22} /><Wordmark width={76} /></span>
        <figcaption className="bs-lbl">Toolbar · 22</figcaption>
      </figure>
    </div>
  )
}

/**
 * Settings > Appearance: pick the logo system (mark + wordmark). Each system
 * brings its own loading animation. A preview card per system, grouped by
 * family; a pick applies at once (rail, toolbar, loading screen), and the
 * picked card plays its loading motion in place.
 */
export default function LogoSystemPicker(): React.ReactElement {
  const inUse = useLogoSystem()
  const [preview, setPreview] = useState<boolean>(false)
  const nowRef = useRef<HTMLDivElement>(null)
  /** The pinned bar shows once the "In use" strip has scrolled out of view. */
  const [pinned, setPinned] = useState<boolean>(false)

  useEffect(() => {
    const el = nowRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setPinned(!entry.isIntersecting && entry.boundingClientRect.top < 0)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="lp">
      <div className="lp-now" ref={nowRef}>
        <Display className="lp-now-disp">
          <span className="bs-lbl lp-corner lp-corner--l">Loading screen · live</span>
          <span className="bs-lbl lp-corner lp-corner--r">{inUse.motion}</span>
          <AnimatedLoadingLogo logoId={inUse.id} size={512} controls={false} />
        </Display>
        <div className="lp-now-side">
          <div>
            <Signal tone="brand">In use</Signal>
            <div className="lp-now-name">{inUse.name}</div>
            <p className="lp-note">{inUse.note}</p>
          </div>
          <SizeProof logo={inUse} />
          <div className="lp-actions">
            <Key variant="primary" onClick={() => setPreview(true)}>Preview loading screen</Key>
          </div>
        </div>
      </div>

      <div className="lp-list">
      {/* Pinned while browsing: the pick's icon and wordmark at real size */}
      <div className="lp-pin" data-on={pinned} aria-hidden={!pinned}>
        <div className="lp-pin-bar">
          <div className="lp-pin-name">
            <Signal tone="brand">In use</Signal>
            <span className="bs-h3">{inUse.name}</span>
          </div>
          <SizeProof logo={inUse} compact />
          <Key variant="primary" tabIndex={pinned ? 0 : -1} onClick={() => setPreview(true)}>Preview</Key>
        </div>
      </div>

      <div role="radiogroup" aria-label="Logo system">
        {LOGO_FAMILIES.map((family) => {
          const logos = logosInFamily(family.id)
          return (
            <section key={family.id} className="lp-family" aria-label={family.label}>
              <GroupHead label={family.label} count={`${logos.length} systems`} />
              <div className="lp-cards">
                {logos.map((logo) => {
                  const on = logo.id === inUse.id
                  return (
                    <button key={logo.id} type="button" role="radio" aria-checked={on}
                      className="lp-card" onClick={() => setLogo(logo.id)}>
                      <Display className="lp-card-disp">
                        {/* The picked card plays its loading motion in place, so it stays in view while browsing */}
                        {on
                          ? <AnimatedLoadingLogo logoId={logo.id} size={512} controls={false} />
                          : <img src={logoAsset(logo.id, 256)} alt="" loading="lazy" width={128} height={128} />}
                      </Display>
                      <span className="lp-card-meta">
                        <span className="bs-h3">{logo.name}</span>
                        {on ? <Signal tone="brand">In use</Signal> : CARD_NOTES[logo.id] && <span className="bs-lbl">{CARD_NOTES[logo.id]}</span>}
                      </span>
                      <span className="lp-lockup lp-lockup--22" aria-hidden="true">
                        <img src={logoAsset(logo.id, 'small')} alt="" width={22} height={22} loading="lazy" />
                        <Wordmark width={86} />
                      </span>
                      <span className="bs-lbl">Loading · {logo.motion}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
      </div>

      {preview && createPortal(
        <EnhancedLoadingScreen stage="preview" logoId={inUse.id} onClose={() => setPreview(false)} />,
        document.body,
      )}
    </div>
  )
}
