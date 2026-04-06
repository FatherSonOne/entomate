import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Navigate } from 'react-router-dom'

export default function SignInPage() {
  const { signInWithOAuth, signIn, signUp, isSignedIn, loading } = useAuth()
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginMethod, setLoginMethod] = useState(null)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [isSignupMode, setIsSignupMode] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState(null)

  // If already signed in, redirect to dashboard
  if (!loading && isSignedIn) {
    return <Navigate to="/dashboard" replace />
  }

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true)
    setLoginMethod('google')
    setError(null)
    try {
      const { error } = await signInWithOAuth('google')
      if (error) throw error
    } catch (e) {
      setError(e.message || 'Google login failed')
      setIsLoggingIn(false)
      setLoginMethod(null)
    }
  }

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setIsLoggingIn(true)
    setLoginMethod('email')
    setError(null)

    try {
      if (isSignupMode) {
        if (!name.trim()) throw new Error('Please enter your name')
        const { error } = await signUp(email, password, { name })
        if (error) throw error
      } else {
        const { error } = await signIn(email, password)
        if (error) throw error
      }
    } catch (err) {
      setError(err.message || 'Authentication failed')
      setIsLoggingIn(false)
      setLoginMethod(null)
    }
  }

  return (
    <div className="entomate-signin-shell">
      {/* Left brand panel */}
      <div className="entomate-signin-brand" aria-hidden="true">
        <div className="entomate-signin-grid" />
        <div className="entomate-signin-aurora entomate-signin-aurora-1" />
        <div className="entomate-signin-aurora entomate-signin-aurora-2" />

        <div className="entomate-signin-brand-content">
          {/* Logo mark */}
          <div className="entomate-signin-logomark">
            <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" width="48" height="48">
              <polyline points="6,30 6,20 9,16 11,14 11,11 12,14 13,11 14,14 15,10 16,14 17,11 17,15"
                fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <polygon points="6,30 6,20 10,22 12,26 10,30" fill="#dc2626" opacity="0.2"/>
              <polyline points="30,30 30,20 27,16 25,14 25,11 24,14 23,11 22,14 21,10 20,14 19,11 19,15"
                fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <polygon points="30,30 30,20 26,22 24,26 26,30" fill="#dc2626" opacity="0.2"/>
              <rect x="14" y="15.5" width="8" height="1.5" rx="0.75" fill="#dc2626"/>
              <rect x="13" y="18" width="10" height="1.5" rx="0.75" fill="#dc2626" opacity="0.7"/>
              <circle cx="18" cy="13" r="2.5" fill="#FFB800" opacity="0.9">
                <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2.2s" repeatCount="indefinite"/>
                <animate attributeName="r" values="2.5;3;2.5" dur="2.2s" repeatCount="indefinite"/>
              </circle>
            </svg>
          </div>

          <p className="entomate-signin-brand-name">entomate</p>
          <h2 className="entomate-signin-tagline">
            Your workflows,<br />fully automated.
          </h2>
          <p className="entomate-signin-sub">
            The Hands of the Trifecto — connecting every tool,
            automating every task, orchestrating your entire workspace.
          </p>

          <ul className="entomate-signin-bullets">
            {[
              'AI agents that act, not just advise',
              '7+ native integrations',
              'Smart automations triggered by any event',
              'Real-time task & deadline intelligence',
            ].map((text) => (
              <li key={text} className="entomate-signin-bullet">
                <span className="entomate-signin-bullet-dot" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="entomate-signin-brand-footer">
          <span>The Hands of the Trifecto</span>
          <span className="entomate-signin-trifecto-links">
            <a href="https://crm.logosvision.org" target="_blank" rel="noopener noreferrer">Logos Vision</a>
            <span>·</span>
            <a href="https://pulse.logosvision.org" target="_blank" rel="noopener noreferrer">Pulse</a>
            <span>·</span>
            <strong>Entomate</strong>
          </span>
        </div>
      </div>

      {/* Right auth panel */}
      <div className="entomate-signin-auth">
        <div className="entomate-signin-auth-inner">
          <a href="/" className="entomate-signin-home-link">
            ← Back to home
          </a>

          <div className="entomate-signin-card">
            <div className="entomate-signin-card-header">
              <h2 className="entomate-signin-card-title">Welcome Back</h2>
              <p className="entomate-signin-card-subtitle">Sign in to continue to Entomate</p>
            </div>

            {error && (
              <div className="entomate-signin-error">{error}</div>
            )}

            {!showEmailForm ? (
              <div className="entomate-signin-btn-group">
                {/* Google Login */}
                <button
                  onClick={handleGoogleLogin}
                  disabled={isLoggingIn}
                  className="entomate-signin-social-btn"
                >
                  {isLoggingIn && loginMethod === 'google' ? (
                    <>
                      <span className="entomate-signin-spinner" />
                      <span>Connecting to Google...</span>
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>

                <div className="entomate-signin-divider"><span>or</span></div>

                <button
                  onClick={() => setShowEmailForm(true)}
                  disabled={isLoggingIn}
                  className="entomate-signin-email-cta"
                >
                  Sign in with Email
                </button>
              </div>
            ) : (
              <form onSubmit={handleEmailSubmit} className="entomate-signin-btn-group">
                {isSignupMode && (
                  <div className="entomate-signin-field">
                    <label className="entomate-signin-label">Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe"
                      className="entomate-signin-input"
                      required={isSignupMode}
                    />
                  </div>
                )}

                <div className="entomate-signin-field">
                  <label className="entomate-signin-label">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="entomate-signin-input"
                    required
                  />
                </div>

                <div className="entomate-signin-field">
                  <label className="entomate-signin-label">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="entomate-signin-input"
                    required
                    minLength={6}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="entomate-signin-submit-btn"
                >
                  {isLoggingIn && loginMethod === 'email' ? (
                    <>
                      <span className="entomate-signin-spinner" />
                      {isSignupMode ? 'Creating account...' : 'Signing in...'}
                    </>
                  ) : (
                    isSignupMode ? 'Create Account' : 'Sign In'
                  )}
                </button>

                <div className="entomate-signin-form-nav">
                  <button
                    type="button"
                    onClick={() => { setShowEmailForm(false); setError(null) }}
                    className="entomate-signin-back-btn"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsSignupMode(!isSignupMode); setError(null) }}
                    className="entomate-signin-toggle-btn"
                  >
                    {isSignupMode ? 'Already have an account?' : 'Create an account'}
                  </button>
                </div>
              </form>
            )}

            <div className="entomate-signin-terms">
              <p>
                By continuing, you agree to our{' '}
                <a href="https://entomate.app/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> and{' '}
                <a href="https://entomate.app/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
              </p>
            </div>
          </div>

          <div className="entomate-signin-security-badges">
            <span className="entomate-signin-security-badge">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Secure Encryption
            </span>
            <a href="https://entomate.app/privacy" target="_blank" rel="noopener noreferrer" className="entomate-signin-security-badge">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              Privacy Policy
            </a>
          </div>
        </div>
      </div>

      <style>{`
        /* ── DESIGN TOKENS — Void × Crimson ── */
        .entomate-signin-shell {
          --signin-bg: #080808;
          --signin-surface: rgba(255, 255, 255, 0.03);
          --signin-border: rgba(255, 255, 255, 0.08);
          --signin-primary: #dc2626;
          --signin-primary-alt: #b91c1c;
          --signin-primary-soft: rgba(220, 38, 38, 0.12);
          --signin-primary-glow: rgba(220, 38, 38, 0.30);
          --signin-text-main: #fafafa;
          --signin-text-secondary: #b4b4b8;
          --signin-text-muted: #6b7280;

          display: flex;
          min-height: 100vh;
          background: var(--signin-bg);
          font-family: 'Space Grotesk', 'Inter', system-ui, sans-serif;
        }

        /* ── LEFT BRAND ── */
        .entomate-signin-brand {
          position: relative;
          width: 420px;
          flex-shrink: 0;
          overflow: hidden;
          background: #101010;
          border-right: 1px solid rgba(220,38,38,0.15);
          display: flex;
          flex-direction: column;
        }

        .entomate-signin-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(220,38,38,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(220,38,38,0.04) 1px, transparent 1px);
          background-size: 32px 32px;
          pointer-events: none;
        }

        .entomate-signin-aurora {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          animation: signin-drift 12s ease-in-out infinite;
        }
        .entomate-signin-aurora-1 {
          width: 320px; height: 320px;
          top: -60px; left: -80px;
          background: radial-gradient(circle, rgba(220,38,38,0.18), transparent 70%);
        }
        .entomate-signin-aurora-2 {
          width: 240px; height: 240px;
          bottom: 60px; right: -40px;
          background: radial-gradient(circle, rgba(0,245,212,0.1), transparent 70%);
          animation-delay: -5s;
        }

        @keyframes signin-drift {
          0%, 100% { transform: translate(0,0) scale(1); }
          50%       { transform: translate(20px, 15px) scale(1.05); }
        }

        .entomate-signin-brand-content {
          position: relative; z-index: 1;
          flex: 1;
          display: flex; flex-direction: column;
          padding: 48px 40px 32px;
        }

        .entomate-signin-logomark {
          width: 56px; height: 56px;
          background: rgba(220,38,38,0.08);
          border: 1px solid rgba(220,38,38,0.2);
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 24px;
        }

        .entomate-signin-brand-name {
          font-family: 'Syne', 'Space Grotesk', sans-serif;
          font-size: 13px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: #dc2626;
          margin: 0 0 20px;
        }

        .entomate-signin-tagline {
          font-family: 'Syne', sans-serif;
          font-size: 28px; font-weight: 800;
          line-height: 1.2; color: #ffffff;
          margin: 0 0 16px; letter-spacing: -0.01em;
        }

        .entomate-signin-sub {
          font-size: 14px; line-height: 1.7;
          color: rgba(255,248,250,0.55);
          margin: 0 0 32px;
        }

        .entomate-signin-bullets {
          list-style: none; margin: 0; padding: 0;
          display: flex; flex-direction: column; gap: 12px;
        }

        .entomate-signin-bullet {
          display: flex; align-items: center; gap: 10px;
          font-size: 13px; color: rgba(255,248,250,0.7);
        }

        .entomate-signin-bullet-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #dc2626; flex-shrink: 0;
          box-shadow: 0 0 8px rgba(220,38,38,0.6);
        }

        .entomate-signin-brand-footer {
          position: relative; z-index: 1;
          padding: 20px 40px;
          border-top: 1px solid rgba(220,38,38,0.1);
          display: flex; flex-direction: column; gap: 6px;
          font-size: 11px; color: rgba(255,248,250,0.35);
        }

        .entomate-signin-trifecto-links {
          display: flex; align-items: center; gap: 8px;
          color: rgba(255,248,250,0.45);
        }
        .entomate-signin-trifecto-links a {
          color: rgba(255,248,250,0.45);
          text-decoration: none; transition: color 150ms ease;
        }
        .entomate-signin-trifecto-links a:hover { color: #dc2626; }
        .entomate-signin-trifecto-links strong { color: #dc2626; }

        /* ── RIGHT AUTH PANEL ── */
        .entomate-signin-auth {
          flex: 1;
          display: flex; align-items: center; justify-content: center;
          padding: 40px 24px;
          background: #0d0d0d;
        }

        .entomate-signin-auth-inner {
          width: 100%; max-width: 420px;
        }

        .entomate-signin-home-link {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; color: rgba(255,248,250,0.4);
          text-decoration: none; margin-bottom: 24px;
          transition: color 150ms ease; letter-spacing: 0.02em;
        }
        .entomate-signin-home-link:hover { color: #dc2626; }

        /* ── AUTH CARD ── */
        .entomate-signin-card {
          width: 100%;
          background: var(--signin-surface);
          backdrop-filter: blur(24px) saturate(180%);
          border: 1px solid var(--signin-border);
          border-radius: 20px;
          padding: 36px 32px;
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.60);
          animation: signinCardEnter 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes signinCardEnter {
          from { opacity: 0; transform: translateX(16px) translateY(4px); }
          to { opacity: 1; transform: translateX(0) translateY(0); }
        }

        .entomate-signin-card-header {
          text-align: center; margin-bottom: 32px;
        }

        .entomate-signin-card-title {
          font-size: 24px; font-weight: 700;
          color: var(--signin-text-main);
          margin: 0 0 6px; letter-spacing: -0.02em;
        }

        .entomate-signin-card-subtitle {
          font-size: 14px; color: var(--signin-text-secondary); margin: 0;
        }

        /* Error */
        .entomate-signin-error {
          margin-bottom: 16px; padding: 12px;
          background: rgba(239, 68, 68, 0.10);
          border: 1px solid rgba(239, 68, 68, 0.20);
          border-radius: 12px; color: #f87171;
          font-size: 14px; text-align: center;
        }

        /* Button group */
        .entomate-signin-btn-group {
          display: flex; flex-direction: column; gap: 12px;
        }

        /* Google button */
        .entomate-signin-social-btn {
          width: 100%;
          display: flex; align-items: center; justify-content: center; gap: 12px;
          padding: 13px 20px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.10);
          border-radius: 12px;
          color: var(--signin-text-main);
          font-size: 14px; font-weight: 500; font-family: inherit;
          transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }
        .entomate-signin-social-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.16);
          transform: translateY(-1px);
        }
        .entomate-signin-social-btn:active { transform: scale(0.97); }
        .entomate-signin-social-btn:disabled {
          opacity: 0.5; cursor: not-allowed; transform: none;
        }

        /* Divider */
        .entomate-signin-divider {
          position: relative; padding: 12px 0; text-align: center;
        }
        .entomate-signin-divider::before {
          content: ''; position: absolute; top: 50%; left: 0; right: 0;
          height: 1px; background: var(--signin-border);
        }
        .entomate-signin-divider span {
          position: relative; padding: 0 12px;
          background: var(--signin-surface);
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.10em; text-transform: uppercase;
          color: var(--signin-text-muted);
        }

        /* Email CTA */
        .entomate-signin-email-cta {
          width: 100%; padding: 14px 20px;
          background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
          border: none; border-radius: 12px;
          color: white; font-size: 15px; font-weight: 600; font-family: inherit;
          letter-spacing: -0.01em;
          box-shadow: 0 4px 16px rgba(220, 38, 38, 0.35);
          transition: all 150ms cubic-bezier(0.16, 1, 0.3, 1);
          cursor: pointer;
        }
        .entomate-signin-email-cta:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(220, 38, 38, 0.50);
        }
        .entomate-signin-email-cta:active { transform: scale(0.97); }
        .entomate-signin-email-cta:disabled {
          opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none;
        }

        /* Submit button */
        .entomate-signin-submit-btn {
          width: 100%; padding: 14px 20px;
          background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
          border: none; border-radius: 12px;
          color: white; font-size: 15px; font-weight: 600; font-family: inherit;
          letter-spacing: -0.01em;
          box-shadow: 0 4px 16px rgba(220, 38, 38, 0.35);
          transition: all 150ms cubic-bezier(0.16, 1, 0.3, 1);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .entomate-signin-submit-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(220, 38, 38, 0.50);
        }
        .entomate-signin-submit-btn:active { transform: scale(0.97); }
        .entomate-signin-submit-btn:disabled {
          opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none;
        }

        /* Input fields */
        .entomate-signin-field {
          display: flex; flex-direction: column; gap: 8px;
        }
        .entomate-signin-label {
          font-size: 13px; font-weight: 500; color: var(--signin-text-secondary);
        }
        .entomate-signin-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.10);
          border-radius: 10px; padding: 12px 16px;
          color: var(--signin-text-main);
          font-size: 15px; font-family: inherit;
          transition: border-color 150ms ease, box-shadow 150ms ease;
          box-sizing: border-box;
        }
        .entomate-signin-input:focus {
          outline: none;
          border-color: var(--signin-primary);
          box-shadow: 0 0 0 3px var(--signin-primary-soft);
        }
        .entomate-signin-input::placeholder { color: var(--signin-text-muted); }

        /* Form nav */
        .entomate-signin-form-nav {
          display: flex; align-items: center; justify-content: space-between;
          font-size: 14px;
        }
        .entomate-signin-back-btn {
          display: flex; align-items: center; gap: 4px;
          color: var(--signin-text-muted);
          background: none; border: none; cursor: pointer;
          font-size: 14px; font-family: inherit; padding: 0;
          transition: color 150ms ease;
        }
        .entomate-signin-back-btn:hover { color: var(--signin-text-main); }

        .entomate-signin-toggle-btn {
          color: var(--signin-primary);
          background: none; border: none; cursor: pointer;
          font-size: 14px; font-family: inherit; padding: 0;
          transition: color 150ms ease;
        }
        .entomate-signin-toggle-btn:hover { color: var(--signin-primary-alt); }

        /* Terms */
        .entomate-signin-terms {
          margin-top: 24px; text-align: center;
        }
        .entomate-signin-terms p {
          font-size: 12px; color: var(--signin-text-muted); margin: 0;
        }
        .entomate-signin-terms a {
          color: var(--signin-text-muted); text-decoration: underline;
          transition: color 150ms ease;
        }
        .entomate-signin-terms a:hover { color: var(--signin-text-secondary); }

        /* Security badges */
        .entomate-signin-security-badges {
          display: flex; gap: 20px; margin-top: 24px;
        }
        .entomate-signin-security-badge {
          display: flex; align-items: center; gap: 6px;
          font-size: 11px; color: var(--signin-text-muted);
          text-decoration: none; transition: color 150ms ease;
        }
        .entomate-signin-security-badge:hover { color: var(--signin-text-secondary); }

        /* Spinner */
        .entomate-signin-spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: signin-spin 0.6s linear infinite;
        }
        @keyframes signin-spin { to { transform: rotate(360deg); } }

        /* ── RESPONSIVE ── */
        @media (max-width: 800px) {
          .entomate-signin-brand { display: none; }
          .entomate-signin-auth { background: #080808; }
        }

        @media (prefers-reduced-motion: reduce) {
          .entomate-signin-card,
          .entomate-signin-social-btn,
          .entomate-signin-email-cta,
          .entomate-signin-submit-btn {
            animation: none !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  )
}
