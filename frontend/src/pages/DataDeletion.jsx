import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'

/**
 * Public GDPR right-to-delete request form (P1.7 Slice 3).
 *
 * Posts to /api/consent/data-deletion. Submission notifies platform
 * admins; fulfillment is a separate manual step (notify-only model).
 * Confirmation message tells the requester to expect action within 72h.
 */
export default function DataDeletion() {
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [requestId, setRequestId] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/consent/data-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), reason: reason.trim() || undefined })
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.message || body.error || 'submit_failed')
        return
      }
      const data = await res.json()
      setRequestId(data.requestId || null)
      setSubmitted(true)
    } catch (err) {
      setError('network_error')
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
            <span className="eyebrow">Data Deletion</span>
            <h1>Request data deletion</h1>
            <p className="muted">GDPR Article 17 / right to erasure</p>
          </header>

          {!submitted ? (
            <>
              <section className="legal-intro">
                <p>
                  If your email address appears in any Entomate data — for
                  example, you received a Meet Mate opt-out email or your
                  email was on a meeting attendee list — you may request
                  that we delete it.
                </p>
                <p>
                  Submit the form below. The platform admin is notified and
                  will action your request within 72 hours. We delete:
                </p>
                <ul style={{ marginLeft: 20, color: 'var(--text-secondary)', fontSize: 15 }}>
                  <li>Attendee records keyed on this email across all workspaces</li>
                  <li>Recall.ai-hosted recordings and transcripts of meetings you organized through Entomate</li>
                  <li>Associated opt-out tokens and audit metadata</li>
                </ul>
                <p>
                  Some metadata may be retained where law requires (e.g. for
                  audit, fraud prevention, or legal hold). If we deny your
                  request on those grounds, we'll tell you why.
                </p>
              </section>

              <section>
                <form onSubmit={handleSubmit}>
                  <label htmlFor="email" style={{ display: 'block', marginBottom: 8, fontWeight: 500, fontSize: 14 }}>
                    Your email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    maxLength={254}
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
                      marginBottom: 20
                    }}
                  />

                  <label htmlFor="reason" style={{ display: 'block', marginBottom: 8, fontWeight: 500, fontSize: 14 }}>
                    Reason (optional)
                  </label>
                  <textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Briefly, why are you requesting deletion?"
                    maxLength={2000}
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

                  {error && (
                    <p style={{ color: 'var(--crimson)', fontSize: 14, marginTop: 12 }}>
                      Couldn't submit your request: <code>{error}</code>. Please try again or
                      email <a href="mailto:fm1@qntmecos.com">fm1@qntmecos.com</a> directly.
                    </p>
                  )}

                  <div style={{ marginTop: 24 }}>
                    <button
                      type="submit"
                      disabled={submitting || !email.trim()}
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
                      {submitting ? 'Submitting…' : 'Submit deletion request'}
                    </button>
                  </div>
                </form>
              </section>
            </>
          ) : (
            <section className="legal-intro">
              <h2 style={{ marginTop: 0 }}>Request received</h2>
              <p>
                Thanks. Your deletion request for <strong>{email}</strong>{' '}
                has been recorded. The platform admin has been notified
                and will action it within 72 hours.
              </p>
              {requestId && (
                <p className="muted" style={{ fontSize: 13 }}>
                  Reference: <code>{requestId}</code>
                </p>
              )}
              <p style={{ marginTop: 16 }}>
                If we determine your email isn't in our data, we'll let you
                know. If we deny the request under GDPR Art. 17(3) (e.g.
                legal retention obligation), we'll provide a reason.
              </p>
            </section>
          )}

          <footer className="legal-footer">
            <Link to="/privacy" className="btn-ghost">← Privacy policy</Link>
            <Link to="/" className="btn-ghost">Home →</Link>
          </footer>
        </div>
      </main>

      <style>{`
        .legal-page {
          --crimson: #FF2D6B;
          --mint: #00F5D4;
          --amber: #FFB800;
          --abyss: #040404;
          --surface: #101010;
          --elevated: #181818;
          --border: rgba(255, 255, 255, 0.07);
          --text-primary: #F8F0F3;
          --text-secondary: #C8AAB8;
          --text-muted: #7A6070;
          --font-display: 'Syne', sans-serif;
          --font-body: 'Space Grotesk', system-ui, sans-serif;
          --font-mono: 'JetBrains Mono', monospace;
          --radius-md: 10px;
          --radius-lg: 16px;
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
          background: rgba(4,4,4,0.85);
          backdrop-filter: blur(20px) saturate(160%);
          -webkit-backdrop-filter: blur(20px) saturate(160%);
          border-bottom: 1px solid var(--border);
        }
        .legal-page nav .container {
          max-width: 1200px; display: flex; align-items: center; justify-content: space-between; width: 100%;
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
        }
        .legal-page .btn-ghost:hover { border-color: rgba(255,45,107,0.3); color: var(--text-primary); }
        .legal-page .legal-main { padding: 64px 0 96px; }
        .legal-page .legal-header { margin-bottom: 32px; }
        .legal-page .eyebrow {
          display: inline-block;
          font-family: var(--font-mono);
          font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase;
          color: var(--crimson);
          padding: 6px 12px;
          border: 1px solid rgba(255,45,107,0.25);
          border-radius: 999px;
          margin-bottom: 16px;
        }
        .legal-page h1 {
          font-family: var(--font-display);
          font-size: clamp(32px, 6vw, 48px);
          line-height: 1.1; margin: 0 0 12px;
        }
        .legal-page h2 {
          font-family: var(--font-display);
          font-size: 22px;
          margin: 24px 0 12px;
          color: var(--text-primary);
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
        .legal-page a { color: var(--crimson); text-decoration: none; border-bottom: 1px dashed rgba(255,45,107,0.35); }
        .legal-page a:hover { color: var(--text-primary); border-bottom-color: var(--crimson); }
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
