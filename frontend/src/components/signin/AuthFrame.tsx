import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Faceplate, Key, Signal, Tag, TitleRule } from '../bench'
import BrandMotion from '../BrandMotion'
import { EntomateMark, Wordmark } from '../Logo'
import { nextHeroClip } from '../heroRotation'
import { SIGNIN_TIPS, nextTagline, nextTipIndex } from '../../services/signInRotation'
import '../../styles/sign-in.css'

// Pick the sign-in film and headline once per document load.
const heroClip = nextHeroClip() ?? 'hands'
const tagline = nextTagline()
const firstTip = nextTipIndex()

const pad = (n: number): string => String(n).padStart(2, '0')

/** One numbered tip from the catalog; Next tip steps through it. */
function TipLine(): React.ReactElement {
  const [index, setIndex] = useState(firstTip)
  return (
    <aside className="si-tip" aria-label="Tip">
      <div className="si-tip-h">
        <span className="si-lbl">Tip <b>{pad(index + 1)}</b> / {pad(SIGNIN_TIPS.length)}</span>
        <Key size="sm" onClick={() => setIndex((i) => (i + 1) % SIGNIN_TIPS.length)}>Next tip</Key>
      </div>
      <p aria-live="polite">{SIGNIN_TIPS[index]}</p>
    </aside>
  )
}

export interface AuthFrameProps {
  /** Title rule text ("Sign in", "Create account"…). */
  title: string
  /** Title rule actions: the mode switch or a way back. */
  actions?: React.ReactNode
  children: React.ReactNode
}

/**
 * Sign-in layout, Slate direction C "Film" (2026-11-22): the landing's
 * dark media zone on the left (hero film and headline, both rotating per load, two lines of sample
 * minutes), the Slate faceplate with the form on the right. On phone the
 * film becomes a band above the plate. Always Void Crimson (.bs-vc), so
 * it reads as the step between the landing and the app.
 */
export function AuthFrame({ title, actions, children }: AuthFrameProps): React.ReactElement {
  return (
    <div className="si-page bs-tokens bs-vc">
      <section className="si-film" aria-labelledby="si-film-h">
        <BrandMotion clip={heroClip} className="si-film-bg" />
        <div className="si-scrim" aria-hidden="true" />
        <div className="si-film-top">
          <Link to="/" className="si-brand" aria-label="Entomate home">
            <EntomateMark size={30} alt="" />
            <Wordmark width={118} />
          </Link>
          <Link to="/" className="bs-key sm si-home">← Home</Link>
        </div>
        <div className="si-film-copy">
          <div className="si-eyebrow">
            <span>Meeting intelligence that executes</span>
          </div>
          <h2 id="si-film-h">{tagline.lead} <em>{tagline.accent}</em></h2>
          <ul className="si-minutes" aria-label="Sample minutes">
            <li className="is-decision">
              <span>Ship transcript ingestion before the notes editor</span>
              <span className="si-minutes-m"><Signal tone="brand">Decision</Signal><time>12:20</time></span>
            </li>
            <li>
              <span>Draft the Q1 hiring plan · Dana · Fri</span>
              <span className="si-minutes-m"><Tag tone="ai">AI 92%</Tag></span>
            </li>
          </ul>
        </div>
      </section>

      <main className="si-side">
        <Faceplate className="si-plate">
          <TitleRule title={title} meta="Entomate · Early access" actions={actions} />
          <div className="si-body">{children}</div>
          <TipLine />
          <footer className="si-foot">
            <span>Ecosystem</span>
            <a href="https://crm.logosvision.org" target="_blank" rel="noopener noreferrer">Logos Vision</a>
            <a href="https://pulse.logosvision.org" target="_blank" rel="noopener noreferrer">Pulse</a>
            <b>Entomate</b>
          </footer>
        </Faceplate>
      </main>
    </div>
  )
}

export interface AuthProblemLineProps {
  head: string
  children: React.ReactNode
}

/** An auth error: crimson tick, LED + word, then the cause and next step. */
export function AuthProblemLine({ head, children }: AuthProblemLineProps): React.ReactElement {
  return (
    <div className="si-err" role="alert">
      <Signal tone="brand">{head}</Signal>
      <p>{children}</p>
    </div>
  )
}
