import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Display, Drawer, GroupHead, Key, PHONE_QUERY, Signal, useMediaQuery } from '../bench'
import AnimatedLoadingLogo from '../AnimatedLoadingLogo'
import EnhancedLoadingScreen from '../EnhancedLoadingScreen'
import { Wordmark } from '../Logo'
import {
  LOGO_FAMILIES, logoAsset, logosInFamily, setLogo, useLogoSystem,
  type LogoSystem,
} from '../../services/logoSystem'
import '../../styles/logo-picker.css'

/** The side panel: 400px wide, 18px from the viewport edge (bench-swiss.css). */
const PANEL_EDGE = 400 + 18
/** Air between the cards and the panel when it does cover them. */
const PANEL_GAP = 20

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
 * brings its own loading animation. A sticky "In use" bar sits over a preview
 * card per system, grouped by family; a pick applies at once (rail, toolbar,
 * loading screen). The live preview lives in a right side panel that stays
 * open beside the grid, so it can be watched while switching. On phone it is a
 * sheet and the picked card plays its motion in place instead.
 */
export default function LogoSystemPicker(): React.ReactElement {
  const inUse = useLogoSystem()
  const isPhone = useMediaQuery(PHONE_QUERY)
  const [preview, setPreview] = useState<boolean>(false)
  const [panel, setPanel] = useState<boolean>(false)
  /** Once closed by hand, a pick no longer reopens the panel until asked. */
  const closedByHand = useRef<boolean>(false)

  const pick = (id: string): void => {
    setLogo(id)
    if (!isPhone && !closedByHand.current) setPanel(true)
  }
  const openPanel = (): void => { closedByHand.current = false; setPanel(true) }
  const closePanel = useCallback((): void => {
    // Esc while the full-screen preview is up closes only the preview
    if (preview) return
    closedByHand.current = true
    setPanel(false)
  }, [preview])
  const docked = panel && !isPhone

  // Measure how far the docked panel covers this column and pad only that much,
  // so the cards keep every column that still fits beside it.
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = rootRef.current
    if (!el || !docked) return undefined
    const measure = (): void => {
      const panelLeft = window.innerWidth - PANEL_EDGE
      const overlap = Math.max(0, Math.ceil(el.getBoundingClientRect().right - panelLeft + PANEL_GAP))
      el.style.setProperty('--lp-overlap', `${overlap}px`)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => { window.removeEventListener('resize', measure); el.style.removeProperty('--lp-overlap') }
  }, [docked])

  return (
    <div className="lp" data-panel={docked} ref={rootRef}>
      {/* Sticky: the pick's icon and wordmark at real size, and the panel key */}
      <div className="lp-bar">
        <div className="lp-bar-name">
          <Signal tone="brand">In use</Signal>
          <span className="bs-h3">{inUse.name}</span>
        </div>
        <SizeProof logo={inUse} compact />
        <Key variant={panel ? undefined : 'primary'} aria-expanded={panel}
          onClick={() => (panel ? closePanel() : openPanel())}>
          {panel ? 'Hide preview' : 'Show preview'}
        </Key>
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
                      className="lp-card" onClick={() => pick(logo.id)}>
                      <Display className="lp-card-disp">
                        {/* With the panel docked the motion plays there; otherwise the picked card plays it in place */}
                        {on && !docked
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

      <Drawer open={panel} onClose={closePanel} label="Loading screen · live" modal={false} className="bs-tokens lp-panel"
        footer={<Key variant="primary" onClick={() => setPreview(true)}>Full-screen preview</Key>}>
        <Display className="lp-panel-disp">
          <span className="bs-lbl lp-corner lp-corner--r">{inUse.motion}</span>
          {panel && <AnimatedLoadingLogo logoId={inUse.id} size={512} controls={false} />}
        </Display>
        <div className="lp-panel-meta">
          <Signal tone="brand">In use</Signal>
          <div className="lp-now-name">{inUse.name}</div>
          <p className="lp-note">{inUse.note}</p>
        </div>
        <SizeProof logo={inUse} />
      </Drawer>

      {preview && createPortal(
        <EnhancedLoadingScreen stage="preview" logoId={inUse.id} onClose={() => setPreview(false)} />,
        document.body,
      )}
    </div>
  )
}
