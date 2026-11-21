import React, { useCallback, useEffect, useRef, useState } from 'react'
import { MODULES, STATUS, MEDIA } from './landingData'

const PHONE_MAX = 760
const VH_PER_MODULE = 80

/**
 * Section 02: the pinned module journey (qntmecos.com "Signal Spine" pattern).
 * The section is tall; an inner panel sticks to the viewport while scroll
 * progress picks the active module, crossfading its footage and sheet.
 * On phones and with reduced motion it falls back to a static stack.
 * Keep every ancestor free of transform and overflow:hidden, or sticky breaks.
 */
export default function ModuleJourney({ reducedMotion }) {
  const sectionRef = useRef(null)
  const progRef = useRef(null)
  const videoRefs = useRef([])
  const [active, setActive] = useState(0)
  const [isStatic, setIsStatic] = useState(true)

  // Decide pinned vs static on mount and resize.
  useEffect(() => {
    const decide = () => setIsStatic(reducedMotion || window.innerWidth <= PHONE_MAX)
    decide()
    window.addEventListener('resize', decide)
    return () => window.removeEventListener('resize', decide)
  }, [reducedMotion])

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
      if (!isStatic && i === active && !reducedMotion) {
        video.preload = 'auto'
        video.play().catch(() => {})
      } else {
        video.pause()
      }
    })
  }, [active, isStatic, reducedMotion])

  const goTo = useCallback((i) => {
    const el = sectionRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const total = rect.height - window.innerHeight
    window.scrollTo({
      top: window.scrollY + rect.top + ((i + 0.5) / MODULES.length) * total,
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }, [reducedMotion])

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
        {MODULES.map((m, i) => (
          <div key={m.name} className={`lc-layer${i === active ? ' is-on' : ''}`} aria-hidden="true">
            <video
              ref={(node) => { videoRefs.current[i] = node }}
              className="lc-bg"
              muted
              loop
              playsInline
              preload="none"
              poster={MEDIA(m.media).poster}
            >
              <source src={MEDIA(m.media).video} type="video/mp4" />
            </video>
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
                <img className="lc-thumb" src={MEDIA(m.media).poster} alt="" loading="lazy" />
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
