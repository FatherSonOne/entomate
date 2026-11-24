import React, { useCallback, useEffect, useRef, useState } from 'react'
import { MODULES, STATUS, MEDIA, LANDING_MEDIA_DIR } from './landingData'
import BrandMotion from '../BrandMotion'
import { smoothScrollBehavior } from '../bench/motion'

const PHONE_MAX = 760
const PIN_MIN_HEIGHT = 640
const VH_PER_MODULE = 80

/**
 * Section 02: the pinned module journey (qntmecos.com "Signal Spine" pattern).
 * The section is tall; an inner panel sticks to the viewport while scroll
 * progress picks the active module, crossfading its footage and sheet.
 * On phones, in short windows and with reduced motion it uses a stack of cards.
 * Selected mobile cards play inline when motion is enabled.
 * Keep every ancestor free of transform and overflow:hidden, or sticky breaks.
 */
export default function ModuleJourney({ reducedMotion }) {
  const sectionRef = useRef(null)
  const progRef = useRef(null)
  const videoRefs = useRef([])
  const [active, setActive] = useState(0)
  const [layout, setLayout] = useState('static')
  const [inView, setInView] = useState(false)
  const isStatic = reducedMotion || layout !== 'pinned'
  const playMobileMotion = !reducedMotion && layout === 'mobile'

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return undefined
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting))
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  // Keep narrow screens and landscape phones in the card layout.
  useEffect(() => {
    const decide = () => {
      const short = window.innerHeight < PIN_MIN_HEIGHT
      const mobile = window.innerWidth <= PHONE_MAX || (short && window.matchMedia('(pointer: coarse)').matches)
      setLayout(mobile ? 'mobile' : short ? 'static' : 'pinned')
    }
    decide()
    window.addEventListener('resize', decide)
    return () => window.removeEventListener('resize', decide)
  }, [])

  // Scroll progress → active module (pinned mode only).
  useEffect(() => {
    if (isStatic) return undefined
    let frame = 0
    const update = () => {
      frame = 0
      const el = sectionRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const total = rect.height - window.innerHeight
      const p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0
      if (progRef.current) progRef.current.style.transform = `scaleX(${p})`
      setActive(Math.min(MODULES.length - 1, Math.floor(p * MODULES.length * 0.999)))
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [isStatic])

  // Play only the active module's footage.
  useEffect(() => {
    videoRefs.current.forEach((video, i) => {
      if (!video) return
      if (inView && !isStatic && i === active && !reducedMotion) {
        if (!video.hasAttribute('src')) {
          const media = MEDIA(MODULES[i].media)
          video.poster = media.poster
          video.src = media.video
        }
        video.play().catch(() => {})
      } else {
        video.pause()
      }
    })
  }, [active, inView, isStatic, reducedMotion])

  const goTo = useCallback((i) => {
    const el = sectionRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const total = rect.height - window.innerHeight
    window.scrollTo({
      top: window.scrollY + rect.top + ((i + 0.5) / MODULES.length) * total,
      behavior: smoothScrollBehavior(),
    })
  }, [])

  const onRailKey = useCallback((e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const next = (active + (e.key === 'ArrowDown' ? 1 : -1) + MODULES.length) % MODULES.length
    goTo(next)
    document.getElementById(`lc-tab-${next}`)?.focus()
  }, [active, goTo])

  const sectionHeight = isStatic ? undefined : { height: `${MODULES.length * VH_PER_MODULE + 20}vh` }

  return (
    <section
      ref={sectionRef}
      className={`lc-journey lc-media${isStatic ? ' is-static' : ''}`}
      id="modules"
      aria-labelledby="lc-modules-h"
      style={sectionHeight}
    >
      <h2 id="lc-modules-h" className="lc-sr">02 · Modules</h2>
      <div className="lc-pin">
        {!isStatic && MODULES.map((m, i) => (
          <div key={m.name} className={`lc-layer${i === active ? ' is-on' : ''}`} aria-hidden="true">
            <video
              ref={(node) => { videoRefs.current[i] = node }}
              className="lc-bg"
              muted
              loop
              playsInline
              preload="none"
            />
          </div>
        ))}
        <div className="lc-shade" aria-hidden="true" />

        <div className="lc-jgrid">
          <div className="lc-rail">
            <span className="lc-eyebrow">02 · Modules</span>
            <div role="tablist" aria-label="Modules" aria-orientation="vertical" onKeyDown={onRailKey}>
              {MODULES.map((m, i) => (
                <button
                  key={m.name}
                  id={`lc-tab-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  aria-controls={`lc-panel-${i}`}
                  tabIndex={i === active ? 0 : -1}
                  onClick={() => goTo(i)}
                >
                  <span className="lc-n">0{i + 1}</span>{m.name}
                </button>
              ))}
            </div>
            <div className="lc-prog" aria-hidden="true"><i ref={progRef} /></div>
          </div>

          <div className="lc-sheets">
            {MODULES.map((m, i) => (
              <article
                key={m.name}
                id={`lc-panel-${i}`}
                role={isStatic ? undefined : 'tabpanel'}
                aria-labelledby={isStatic ? undefined : `lc-tab-${i}`}
                aria-hidden={!isStatic && i !== active ? true : undefined}
                className={`lc-sheet${isStatic || i === active ? ' is-on' : ''}`}
              >
                {isStatic && (
                  <div className="lc-thumb">
                    {playMobileMotion && m.mobileMotion ? (
                      <BrandMotion clip={m.media} mediaDirectory={LANDING_MEDIA_DIR} responsive />
                    ) : inView && (
                      <img src={MEDIA(m.media).poster} alt="" loading="lazy" decoding="async" />
                    )}
                  </div>
                )}
                <div className={`lc-k lc-k--${m.sig}`}>
                  <span className={`lc-sq lc-sq--${m.sig}`} aria-hidden="true" />{m.kicker}
                </div>
                <h3><span className="lc-n">02.{i + 1}</span>{m.head}</h3>
                <p className="lc-tag">{m.tag}</p>
                <ul>
                  {m.features.map(([label, status], j) => (
                    <li key={label}>
                      <span className="lc-n">{i + 1}.{j + 1}</span>
                      <span>{label}</span>
                      <span className={`lc-st ${STATUS[status].cls}`}>{STATUS[status].label}</span>
                    </li>
                  ))}
                </ul>
                <div className="lc-src">Source: {m.src}</div>
              </article>
            ))}
          </div>
        </div>

        <div className="lc-legend lc-mono" aria-hidden="true"><span>✓ shipped</span><span>○ planned</span></div>
      </div>
    </section>
  )
}
