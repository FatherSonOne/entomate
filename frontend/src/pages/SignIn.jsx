import { SignIn } from '@clerk/clerk-react'

export default function SignInPage() {
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
                fill="none" stroke="#FF2D6B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <polygon points="6,30 6,20 10,22 12,26 10,30" fill="#FF2D6B" opacity="0.2"/>
              <polyline points="30,30 30,20 27,16 25,14 25,11 24,14 23,11 22,14 21,10 20,14 19,11 19,15"
                fill="none" stroke="#FF2D6B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <polygon points="30,30 30,20 26,22 24,26 26,30" fill="#FF2D6B" opacity="0.2"/>
              <rect x="14" y="15.5" width="8" height="1.5" rx="0.75" fill="#FF2D6B"/>
              <rect x="13" y="18" width="10" height="1.5" rx="0.75" fill="#FF2D6B" opacity="0.7"/>
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
              '24+ native integrations',
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
          <div className="entomate-signin-clerk-wrap">
            <SignIn
              routing="path"
              path="/sign-in"
              signUpUrl="/sign-up"
              afterSignInUrl="/dashboard"
              appearance={{
                elements: {
                  rootBox: 'mx-auto w-full',
                  card: 'shadow-none border-0 bg-transparent p-0',
                  headerTitle: 'text-content-primary font-display',
                  headerSubtitle: 'text-content-secondary',
                  socialButtonsBlockButton: 'border-border-default bg-surface hover:bg-muted text-content-primary',
                  formFieldInput: 'bg-surface border-border-default text-content-primary',
                  footerActionLink: 'text-accent-primary hover:text-accent-primary',
                },
              }}
            />
          </div>
        </div>
      </div>

      <style>{`
        .entomate-signin-shell {
          display: flex;
          min-height: 100vh;
          background: #080808;
          font-family: 'Space Grotesk', sans-serif;
        }

        /* ── LEFT BRAND ── */
        .entomate-signin-brand {
          position: relative;
          width: 420px;
          flex-shrink: 0;
          overflow: hidden;
          background: #101010;
          border-right: 1px solid rgba(255,45,107,0.15);
          display: flex;
          flex-direction: column;
        }

        .entomate-signin-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,45,107,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,45,107,0.04) 1px, transparent 1px);
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
          width: 320px;
          height: 320px;
          top: -60px;
          left: -80px;
          background: radial-gradient(circle, rgba(255,45,107,0.18), transparent 70%);
          animation-delay: 0s;
        }
        .entomate-signin-aurora-2 {
          width: 240px;
          height: 240px;
          bottom: 60px;
          right: -40px;
          background: radial-gradient(circle, rgba(0,245,212,0.1), transparent 70%);
          animation-delay: -5s;
        }

        @keyframes signin-drift {
          0%, 100% { transform: translate(0,0) scale(1); }
          50%       { transform: translate(20px, 15px) scale(1.05); }
        }

        .entomate-signin-brand-content {
          position: relative;
          z-index: 1;
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 48px 40px 32px;
        }

        .entomate-signin-logomark {
          width: 56px;
          height: 56px;
          background: rgba(255,45,107,0.08);
          border: 1px solid rgba(255,45,107,0.2);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
        }

        .entomate-signin-brand-name {
          font-family: 'Syne', 'Space Grotesk', sans-serif;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #FF2D6B;
          margin: 0 0 20px;
        }

        .entomate-signin-tagline {
          font-family: 'Syne', sans-serif;
          font-size: 28px;
          font-weight: 800;
          line-height: 1.2;
          color: #ffffff;
          margin: 0 0 16px;
          letter-spacing: -0.01em;
        }

        .entomate-signin-sub {
          font-size: 14px;
          line-height: 1.7;
          color: rgba(255,248,250,0.55);
          margin: 0 0 32px;
        }

        .entomate-signin-bullets {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .entomate-signin-bullet {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: rgba(255,248,250,0.7);
        }

        .entomate-signin-bullet-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #FF2D6B;
          flex-shrink: 0;
          box-shadow: 0 0 8px rgba(255,45,107,0.6);
        }

        .entomate-signin-brand-footer {
          position: relative;
          z-index: 1;
          padding: 20px 40px;
          border-top: 1px solid rgba(255,45,107,0.1);
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 11px;
          color: rgba(255,248,250,0.35);
        }

        .entomate-signin-trifecto-links {
          display: flex;
          align-items: center;
          gap: 8px;
          color: rgba(255,248,250,0.45);
        }

        .entomate-signin-trifecto-links a {
          color: rgba(255,248,250,0.45);
          text-decoration: none;
          transition: color 150ms ease;
        }
        .entomate-signin-trifecto-links a:hover {
          color: #FF2D6B;
        }
        .entomate-signin-trifecto-links strong {
          color: #FF2D6B;
        }

        /* ── RIGHT AUTH ── */
        .entomate-signin-auth {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          background: #0d0d0d;
        }

        .entomate-signin-auth-inner {
          width: 100%;
          max-width: 480px;
        }

        .entomate-signin-home-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: rgba(255,248,250,0.4);
          text-decoration: none;
          margin-bottom: 24px;
          transition: color 150ms ease;
          letter-spacing: 0.02em;
        }
        .entomate-signin-home-link:hover {
          color: #FF2D6B;
        }

        .entomate-signin-clerk-wrap {
          width: 100%;
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 800px) {
          .entomate-signin-brand {
            display: none;
          }
          .entomate-signin-auth {
            background: #080808;
          }
        }
      `}</style>
    </div>
  )
}
