import React, { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../context/ThemeContext'
import BackToTop from '../components/BackToTop'
import BrandMotion from '../components/BrandMotion'
import { nextHeroClip } from '../components/heroRotation'
import { Logo } from '../components/Logo'
import ModuleJourney from '../components/landing/ModuleJourney'
import LandingGuide from '../components/landing/LandingGuide'
import useReducedMotion from '../components/landing/useReducedMotion'
import { AGENTS, BAND, CAPTURE, ECOSYSTEM_LINKS, LANDING_MEDIA_DIR, MEDIA, MODULES, NAV_LINKS } from '../components/landing/landingData'
import '../styles/landing-c.css'

// Pick once per document with a rotation independent of the sign-in page.
const heroClip = nextHeroClip({
  clips: ['signal-chamber', 'coastal-relay', 'project-lines', 'hands', 'workflow'],
  storageKey: 'entomate.landing.hero.previous',
})

/**
 * Public landing page, direction C "Minutes" (2026-11-21).
 * Sections: 01 hero, band, 02 module journey, 03 minutes specimen,
 * 04 agents, 05 capture, 06 close, 07 user guide, footer.
 */
export default function LandingPage() {
  const { isSignedIn, loading: isLoading } = useAuth()
  const { isLight, toggleMode } = useTheme()
  const reducedMotion = useReducedMotion()
  const [navSolid, setNavSolid] = useState(false)

  // Nav turns solid after the hero, except while the pinned journey fills the screen.
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const journey = document.getElementById('modules')
      const r = journey?.getBoundingClientRect()
      const insideJourney = r && !journey.classList.contains('is-static') && r.top <= 0 && r.bottom >= window.innerHeight
      setNavSolid(window.scrollY > window.innerHeight * 0.6 && !insideJourney)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  if (!isLoading && isSignedIn) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className={`lc-page${isLight ? ' is-light' : ''}`}>
      <a className="lc-skip" href="#lc-main">Skip to content</a>

      <header className={`lc-nav lc-wrap${navSolid ? ' is-solid' : ''}`}>
        <a className="lc-brand" href="#lc-main" aria-label="Entomate, back to top"><Logo size="sm" /></a>
        <nav className="lc-nav-links" aria-label="Sections">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href}><span className="lc-n">{l.n}</span>{l.label}</a>
          ))}
        </nav>
        <div className="lc-nav-r">
          <button type="button" className="lc-theme" onClick={toggleMode} aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}>
            {isLight ? 'Dark' : 'Light'}
          </button>
          <Link className="lc-signin" to="/sign-in">Sign in</Link>
          <Link className="lc-btn is-primary" to="/sign-in?mode=signup">Start free</Link>
        </div>
      </header>

      <main id="lc-main">
        {/* 01 Hero */}
        <section className="lc-hero lc-media lc-wrap" aria-labelledby="lc-h1">
          <BrandMotion clip={heroClip} mediaDirectory={LANDING_MEDIA_DIR} className="lc-hero-film" />
          <div className="lc-scrim" aria-hidden="true" />
          <div className="lc-in">
            <div className="lc-rule lc-eyebrow"><span>01 · Meeting intelligence that executes</span></div>
            <h1 id="lc-h1">Meetings end. <em>The work shouldn’t.</em></h1>
            <p className="lc-lede">
              Record in your browser, upload audio, or send Meet Mate to your call.
              Entomate turns recordings into searchable minutes and action items you can track in projects or route through workflows.
            </p>
            <div className="lc-ctas">
              <Link className="lc-btn is-primary" to="/sign-in?mode=signup">Start free <span aria-hidden="true">→</span></Link>
              <a className="lc-btn" href="#modules">See how it works</a>
            </div>
            <div className="lc-status lc-mono"><span>Early access</span><span>Web</span><span>entomate.logosvision.org</span></div>
          </div>
          <div className="lc-cue" aria-hidden="true"><b>Scroll</b><span className="lc-mono">{MODULES.length} modules below</span></div>
        </section>

        {/* Band: four facts, each shipped */}
        <ul className="lc-band" aria-label="Entomate at a glance">
          {BAND.map((b) => (
            <li key={b.label}>
              <div className="lc-v">{b.value}</div>
              <div className="lc-l">{b.label}{b.note && <span className="lc-note">{b.note}</span>}</div>
            </li>
          ))}
        </ul>

        {/* 02 Modules */}
        <ModuleJourney reducedMotion={reducedMotion} />

        {/* 03 Shows its work: a sample set of minutes */}
        <section className="lc-pad lc-wrap" id="work" aria-labelledby="lc-work-h">
          <div className="lc-sh">
            <span className="lc-n">03</span>
            <h2 id="lc-work-h">Every meeting, minuted.</h2>
            <p>Read the transcript, decisions and action items together. Jump to the moment a decision was made, or review a follow-up email before it goes out.</p>
          </div>
          <div className="lc-minutes">
            <div className="lc-doc">
              <div className="lc-eyebrow">Sample minutes · Q4 roadmap review · 10:00–10:46</div>
              <div className="lc-dh"><span className="lc-n">2</span><h3>Decisions</h3></div>
              <div className="lc-li"><span className="lc-n">2.1</span><div>Ship transcript ingestion before the notes editor</div><div className="lc-m"><span className="lc-mono">at 12:20</span></div></div>
              <div className="lc-li"><span className="lc-n">2.2</span><div>Move the Pulse handoff to January</div><div className="lc-m"><span className="lc-mono">at 23:40</span></div></div>
              <div className="lc-dh"><span className="lc-n">3</span><h3>Actions</h3></div>
              <div className="lc-li">
                <span className="lc-n">3.1</span><div>Write the ingestion spec</div>
                <div className="lc-m"><span>Priya S.</span><span className="lc-mono">Mon 24 Nov</span><span><span className="lc-sq lc-sq--ai" aria-hidden="true" />Priority set by the Priority agent</span></div>
              </div>
              <div className="lc-li">
                <span className="lc-n">3.2</span><div>Draft the January Pulse handoff plan</div>
                <div className="lc-m"><span>Jon B.</span><span className="lc-mono">Fri 28 Nov</span><span><span className="lc-sq lc-sq--ai" aria-hidden="true" />Date set by the Deadline agent</span></div>
              </div>
            </div>
            <div className="lc-side">
              <div className="lc-dh"><span className="lc-n">4</span><h3>Transcript</h3></div>
              <div className="lc-tr"><span className="lc-tc">12:04</span><div><b>Priya S.</b> So my proposal: ingestion first, then notes. I can own the spec.</div></div>
              <div className="lc-tr"><span className="lc-tc">12:20</span><div><b>Frankie</b> Agreed. Let’s make that the call.</div></div>
              <div className="lc-tr"><span className="lc-tc">23:40</span><div><b>Frankie</b> Pulse can wait until January.</div></div>
              <p className="lc-foot">Ask a question about this meeting, or search across meetings by exact words or meaning.</p>
            </div>
          </div>
        </section>

        {/* 04 Agents · glyphs */}
        <section id="agents" aria-labelledby="lc-agents-h">
          <div className="lc-agents-img lc-media">
            <img className="lc-bg" src={MEDIA('glyphs').poster} alt="" loading="lazy" />
            <div className="lc-scrim" aria-hidden="true" />
            <div className="lc-cap lc-eyebrow">Four agents. One signal.</div>
          </div>
          <div className="lc-pad lc-wrap lc-agents-body">
            <div className="lc-sh">
              <span className="lc-n">04</span>
              <h2 id="lc-agents-h">Four agents recommend the next step.</h2>
              <p>Each recommendation carries a reason and a confidence score, one click away on the action item. Anything the agents change after a meeting is yours to edit.</p>
            </div>
            <ul className="lc-agents">
              {AGENTS.map((a) => (
                <li key={a.n}><span className="lc-n">{a.n}</span><h3>{a.head}</h3><p>{a.body}</p></li>
              ))}
            </ul>
          </div>
        </section>

        {/* 05 Capture · Meet Mate notetaker */}
        <section className="lc-pad lc-wrap" id="capture" aria-labelledby="lc-capture-h">
          <div className="lc-sh">
            <span className="lc-n">05</span>
            <h2 id="lc-capture-h">Let Meet Mate take minutes.</h2>
            <p>Workspace owners and admins can send Meet Mate to Google Meet, Zoom or Microsoft Teams, or set it to join eligible calls from a connected Google Calendar.</p>
          </div>
          <ul className="lc-agents lc-agents--live">
            {CAPTURE.map((c) => (
              <li key={c.n}><span className="lc-n">{c.n}</span><h3>{c.head}</h3><p>{c.body}</p></li>
            ))}
          </ul>
        </section>

        {/* 06 Close */}
        <section className="lc-close lc-media" id="start" aria-labelledby="lc-close-h">
          <BrandMotion clip="glass-torus" mediaDirectory={LANDING_MEDIA_DIR} className="lc-close-film" />
          <div className="lc-scrim" aria-hidden="true" />
          <div className="lc-in">
            <div className="lc-eyebrow">06 · Start free</div>
            <h2 id="lc-close-h">Ready to turn meetings <em>into motion?</em></h2>
            <div className="lc-ctas">
              <Link className="lc-btn is-primary" to="/sign-in?mode=signup">Start free <span aria-hidden="true">→</span></Link>
              <a className="lc-btn" href="https://qntmecos.com" target="_blank" rel="noopener noreferrer">Explore the ecosystem</a>
            </div>
            <p className="lc-where lc-mono">entomate.logosvision.org · Web</p>
          </div>
        </section>

        {/* 07 User guide */}
        <LandingGuide />
      </main>

      <footer className="lc-footer lc-wrap">
        <div className="lc-g">
          <div>
            <div className="lc-brand"><Logo size="sm" /></div>
            <p className="lc-about">Meeting intelligence from Quantum Ecosystems. One of three apps with Logos Vision and Pulse.</p>
          </div>
          <div>
            <h4>Product</h4>
            <a href="#modules">Modules</a><a href="#agents">Agents</a><a href="#work">Minutes</a><a href="#capture">Notetaker</a><a href="#guide">User guide</a>
          </div>
          <div>
            <h4>Ecosystem</h4>
            {ECOSYSTEM_LINKS.map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a>
            ))}
          </div>
          <div>
            <h4>Help &amp; trust</h4>
            <a href="#guide">Docs</a>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/data-deletion">Data deletion</Link>
          </div>
        </div>
        <div className="lc-fine"><span>© 2026 Quantum Ecosystems</span></div>
      </footer>

      <BackToTop />
    </div>
  )
}
