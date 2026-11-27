import React, { useLayoutEffect, useState } from 'react'
import { Display, Key } from '../bench'
import { useMotionPlayback } from '../bench/motion'
import AnimatedLoadingLogo from '../AnimatedLoadingLogo'
import { LOGO_FAMILIES, logoAsset, logosInFamily } from '../../services/logoSystem'

export default function LogoMotionGallery(): React.ReactElement {
  const [playAll, setPlayAll, reduced] = useMotionPlayback()
  const [choices, setChoices] = useState<Partial<Record<string, boolean>>>({})

  useLayoutEffect(() => { setChoices({}) }, [reduced])

  const toggleAll = (): void => {
    setPlayAll(!playAll)
    setChoices({})
  }

  return (
    <section className="lp-gallery" aria-labelledby="lp-gallery-title">
      <div className="lp-gallery-head">
        <h4 id="lp-gallery-title" className="bs-h3">Logo and animation gallery</h4>
        <Key onClick={toggleAll}>{playAll ? 'Pause all' : 'Play all'}</Key>
      </div>
      {LOGO_FAMILIES.map((family) => (
        <section key={family.id} aria-labelledby={`lp-gallery-${family.id}`}>
          <h5 id={`lp-gallery-${family.id}`} className="bs-group bs-lbl">{family.label}</h5>
          <ul className="lp-gallery-cards">
            {logosInFamily(family.id).map((logo) => {
              const playing = choices[logo.id] ?? playAll
              return (
                <li key={logo.id} className="lp-gallery-card">
                  <div className="lp-gallery-views">
                    <figure>
                      <Display className="lp-gallery-stage">
                        <img src={logoAsset(logo.id, 256)} alt="" loading="lazy" width={128} height={128} />
                      </Display>
                      <figcaption className="bs-lbl">Logo</figcaption>
                    </figure>
                    <figure>
                      <Display className="lp-gallery-stage">
                        <AnimatedLoadingLogo logoId={logo.id} size={256} controls={false} playing={playing} />
                      </Display>
                      <figcaption className="bs-lbl">Loading animation</figcaption>
                    </figure>
                  </div>
                  <div className="lp-gallery-caption">
                    <div>
                      <h6 className="bs-h3">{logo.name}</h6>
                      <p className="lp-note">{logo.motion}</p>
                    </div>
                    <Key aria-label={`${playing ? 'Pause' : 'Play'} ${logo.name} loading animation`}
                      onClick={() => setChoices((current) => ({ ...current, [logo.id]: !playing }))}>
                      {playing ? 'Pause' : 'Play'}
                    </Key>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </section>
  )
}
