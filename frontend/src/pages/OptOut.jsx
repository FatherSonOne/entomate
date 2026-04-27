import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Logo } from '../components/Logo'

/**
 * Public opt-out landing page (P1.7 Slice 2).
 *
 * Linked from the pre-meeting opt-out email sent to attendees. The token
 * in the URL resolves on the backend via sha256 lookup; this page never
 * sees a session id, workspace id, or meeting URL — only the recipient's
 * own email address and the organizer's display name.
 */
export default function OptOut() {
  const { token } = useParams()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [ctx, setCtx] = useState(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/consent/opt-out/${encodeURIComponent(token)}`)
        if (!res.ok) {
          if (cancelled) return
          setLoadError(res.status === 404 ? 'invalid_or_expired' : 'lookup_failed')
          setLoading(false)
          return
        }
        const data = await res.json()
        if (cancelled) return
        setCtx(data)
        if (data.alreadyOptedOut) setSubmitted(true)
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        setLoadError('network_error')
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [token])

  async function handleOptOut(e) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`/api/consent/opt-out/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined })
      })
      if (!res.ok) {
        setSubmitError(res.status === 404 ? 'invalid_or_expired' : 'submit_failed')
        return
      }
      setSubmitted(true)
    } catch (err) {
      setSubmitError('network_error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="legal-page">
      <nav>
        <div className="container">
          <Link to="/" className="nav-logo">
            <Logo variant="mark" size="sm" withText={true} />
          </Link>
          <div className="nav-cta">
            <Link to="/privacy" className="btn-ghost">Privacy</Link>
            <Link to="/terms" className="btn-ghost">Terms</Link>
          </div>
        </div>
      </nav>

      <main className="legal-main">
        <div className="container">
          <header className="legal-header">
            <span className="eyebrow">Recording Opt-Out</span>
            <h1>Opt out of recording</h1>
          </header>

          {loading && (
            <section className="legal-intro">
              <p className="muted">Loading…</p>
            </section>
          )}

          {!loading && loadError && (
            <section className="legal-intro">
              <h2 style={{ marginTop: 0 }}>This opt-out link isn't valid</h2>
              <p>
                The link may have expired, been mistyped, or already been
                cancelled by the meeting organizer. If you believe this is
                an error, reply directly to the email you received or
                contact the organizer.
              </p>
              <p className="muted" style={{ marginTop: 16 }}>
                Error: <code>{loadError}</code>
              </p>
            </section>
          )}

          {!loading && !loadError && ctx && (
            <>
              {!submitted ? (
                <section className="legal-intro">
                  <p>
                    Hi <strong>{ctx.email}</strong>,
                  </p>
                  <p>
                    {ctx.organizerName ? <strong>{ctx.organizerName}</strong> : 'A meeting host'}
                    {' '}is launching <strong>Meet Mate</strong>, an AI notetaker,
                    in an upcoming meeting you're invited to.
                  </p>
                  <p>
                    Click below to opt out of being recorded. The organizer
                    will be notified and decides what to do next — they may
                    continue with the bot, ask you in person, or stop the
                    bot. The legal obligation to honor your opt-out rests
                    with them.
                  </p>
                </section>
              ) : null}

              {submitted && (
                <section className="legal-intro">
                  <h2 style={{ marginTop: 0 }}>You're opted out</h2>
                  <p>
                    {ctx.organizerName ? <strong>{ctx.organizerName}</strong> : 'The meeting organizer'}
                    {' '}has been notified that <strong>{ctx.email}</strong>{' '}
                    opted out of recording. They decide whether to continue
                    or stop the bot.
                  </p>
                  <p>
                    If you change your mind, reply directly to the email or
                    speak with the organizer.
                  </p>
                </section>
              )}

              {!submitted && (
                <section>
                  <form onSubmit={handleOptOut}>
                    <label htmlFor="reason" style={{
                      display: 'block', marginBottom: 8, fontWeight: 500, fontSize: 14
                    }}>
                      Reason (optional, shared with the organizer)
                    </label>
                    <textarea
                      id="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. I'd prefer not to be recorded for this conversation."
                      maxLength={1000}
                      rows={4}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '12px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-body)',
                        fontSize: 14,
                        lineHeight: 1.5,
                        resize: 'vertical'
                      }}
                    />
                    {submitError && (
                      <p style={{ color: 'var(--crimson)', fontSize: 14, marginTop: 12 }}>
                        Couldn't record your opt-out: <code>{submitError}</code>. Please try again or reply to the email directly.
                      </p>
                    )}
                    <div style={{ marginTop: 24 }}>
                      <button
                        type="submit"
                        disabled={submitting}
                        style={{
                          padding: '14px 28px',
                          background: 'var(--crimson)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 'var(--radius-md)',
                          fontFamily: 'var(--font-body)',
                          fontSize: 15,
                          fontWeight: 600,
                          cursor: submitting ? 'not-allowed' : 'pointer',
                          opacity: submitting ? 0.6 : 1
                        }}
                      >
                        {submitting ? 'Recording…' : 'Opt out of recording'}
                      </button>
                    </div>
                  </form>
                </section>
              )}
            </>
          )}

          <footer className="legal-footer">
            <Link to="/" className="btn-ghost">← Back to home</Link>
            <Link to="/privacy" className="btn-ghost">Privacy policy →</Link>
          </footer>
        </div>
      </main>

      <style>{`
        .legal-page {
          --crimson:      #FF2D6B;
          --crimson-glow: rgba(255, 45, 107, 0.35);
          --mint:         #00F5D4;
          --amber:        #FFB800;
          --abyss:        #040404;
          --surface:      #101010;
          --elevated:     #181818;
          --border:       rgba(255, 255, 255, 0.07);
          --text-primary: #F8F0F3;
          --text-secondary: #C8AAB8;
          --text-muted:   #7A6070;
          --font-display: 'Syne', sans-serif;
          --font-body:    'Space Grotesk', system-ui, sans-serif;
          --font-mono:    'JetBrains Mono', monospace;
          --radius-md:    10px;
          --radius-lg:    16px;
          font-family: var(--font-body);
          background: var(--abyss);
          color: var(--text-primary);
          line-height: 1.7;
          min-height: 100vh;
        }
        .legal-page .container { max-width: 720px; margin: 0 auto; padding: 0 24px; }
        .legal-page nav {
          position: sticky; top: 0; z-index: 100; height: 64px;
          display: flex; align-items: center;
          background: rgba(4, 4, 4, 0.85);
          backdrop-filter: blur(20px) saturate(160%);
          -webkit-backdrop-filter: blur(20px) saturate(160%);
          border-bottom: 1px solid var(--border);
        }
        .legal-page nav .container {
          max-width: 1200px;
          display: flex; align-items: center; justify-content: space-between; width: 100%;
        }
        .legal-page .nav-logo { display: flex; align-items: center; text-decoration: none; }
        .legal-page .nav-cta { display: flex; gap: 12px; }
        .legal-page .btn-ghost {
          padding: 8px 20px;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 14px; font-weight: 500;
          background: transparent; text-decoration: none;
          transition: all 150ms ease;
        }
        .legal-page .btn-ghost:hover {
          border-color: rgba(255, 45, 107, 0.3);
          color: var(--text-primary);
        }
        .legal-page .legal-main { padding: 64px 0 96px; }
        .legal-page .legal-header { margin-bottom: 32px; }
        .legal-page .eyebrow {
          display: inline-block;
          font-family: var(--font-mono);
          font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase;
          color: var(--crimson);
          padding: 6px 12px;
          border: 1px solid rgba(255, 45, 107, 0.25);
          border-radius: 999px;
          margin-bottom: 16px;
        }
        .legal-page h1 {
          font-family: var(--font-display);
          font-size: clamp(32px, 6vw, 48px); line-height: 1.1;
          margin: 0 0 12px;
        }
        .legal-page h2 {
          font-family: var(--font-display);
          font-size: 22px; margin: 24px 0 12px; color: var(--text-primary);
        }
        .legal-page .muted { color: var(--text-muted); font-size: 14px; }
        .legal-page .legal-intro {
          padding: 24px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          margin-bottom: 24px;
        }
        .legal-page .legal-intro p { margin: 0 0 12px; color: var(--text-secondary); font-size: 15px; }
        .legal-page .legal-intro p:last-child { margin-bottom: 0; }
        .legal-page strong { color: var(--text-primary); }
        .legal-page section { margin-bottom: 24px; }
        .legal-page code {
          font-family: var(--font-mono); font-size: 12px;
          padding: 2px 6px;
          background: var(--elevated);
          border: 1px solid var(--border);
          border-radius: 4px;
          color: var(--mint);
        }
        .legal-page label { color: var(--text-secondary); }
        .legal-page .legal-footer {
          display: flex; justify-content: space-between; gap: 12px;
          margin-top: 64px; padding-top: 32px;
          border-top: 1px solid var(--border);
          flex-wrap: wrap;
        }
        @media (max-width: 600px) {
          .legal-page .legal-main { padding: 32px 0 64px; }
          .legal-page h1 { font-size: 32px; }
        }
      `}</style>
    </div>
  )
}
