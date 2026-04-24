import React from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'
import BackToTop from '../components/BackToTop'

export default function PrivacyPolicy() {
  const lastUpdated = 'April 22, 2026'

  return (
    <div className="legal-page">
      <BackToTop />
      {/* ── NAV ── */}
      <nav>
        <div className="container">
          <Link to="/" className="nav-logo">
            <Logo variant="mark" size="sm" withText={true} />
          </Link>
          <div className="nav-cta">
            <Link to="/" className="btn-ghost">Home</Link>
            <Link to="/terms" className="btn-ghost">Terms</Link>
          </div>
        </div>
      </nav>

      <main className="legal-main">
        <div className="container">
          <header className="legal-header">
            <span className="eyebrow">Legal</span>
            <h1>Privacy Policy</h1>
            <p className="muted">Last updated: {lastUpdated}</p>
          </header>

          <section className="legal-intro">
            <p>
              Entomate (<strong>“Entomate,” “we,” “us,” or “our”</strong>) builds
              an AI-powered meeting intelligence platform that captures meeting
              content, extracts action items, and integrates with the tools your
              team already uses. This Privacy Policy explains what personal data
              we collect, why we collect it, how we use and share it, and the
              choices you have. Entomate is part of the <em>Trifecto</em>{' '}
              ecosystem alongside Logos Vision and Pulse.
            </p>
            <p>
              By using Entomate (the “Service”), you agree to the processing
              described here. If you do not agree, please do not use the Service.
            </p>
          </section>

          <section>
            <h2>1. Information We Collect</h2>

            <h3>1.1 Information You Provide</h3>
            <ul>
              <li>
                <strong>Account data</strong> — name, email, password hash,
                avatar, organization name, role, and timezone (provided via
                Clerk authentication).
              </li>
              <li>
                <strong>Meeting content</strong> — audio you choose to record,
                transcripts generated from that audio, notes, chat messages,
                uploaded files, meeting titles, and participant information.
              </li>
              <li>
                <strong>Tasks, projects, and workflows</strong> — content you
                create in the app including task descriptions, priorities,
                deadlines, goals, assignments, and automation configurations.
              </li>
              <li>
                <strong>Billing information</strong> — handled by our payment
                processor; we store only the minimum needed to operate the
                subscription (plan, status, last 4 digits of card).
              </li>
              <li>
                <strong>Support and feedback</strong> — messages you send us.
              </li>
            </ul>

            <h3>1.2 Information From Third-Party Integrations</h3>
            <p>
              When you connect an integration, we receive data through the
              scopes you grant at the provider’s consent screen:
            </p>
            <ul>
              <li>
                <strong>Google Calendar</strong> — scopes{' '}
                <code>https://www.googleapis.com/auth/calendar</code> and{' '}
                <code>https://www.googleapis.com/auth/calendar.events</code>.
                We use these to list your calendars, read events relevant to
                your meetings, and create or modify events you schedule through
                Entomate. We do <strong>not</strong> read events outside your
                working context, and we never sell or transfer this data. Our
                use of Google user data complies with the{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements.
              </li>
              <li>
                <strong>Slack</strong> — scopes <code>chat:write</code>,{' '}
                <code>channels:read</code>, and <code>users:read</code>. We
                post messages and notifications you configure (e.g.,
                action-item summaries), read channel names for routing, and
                resolve user identities so notifications reach the right
                person.
              </li>
              <li>
                <strong>CRM providers</strong> — when connected, we read and
                write the records you specify (contacts, deals, notes) to sync
                meeting outcomes and follow-ups.
              </li>
              <li>
                <strong>Ecosystem Bridge</strong> — if you are also a user of
                Logos Vision or Pulse (the Trifecto ecosystem), you may grant
                cross-app data sharing so action items, contacts, or meeting
                context flow between products. Sharing is opt-in per workspace.
              </li>
            </ul>

            <h3>1.3 Device and Usage Data (Collected Automatically)</h3>
            <ul>
              <li>
                Device and browser information (user agent, OS, screen size),
                IP address, and approximate location derived from IP.
              </li>
              <li>
                Usage events — pages viewed, features used, errors encountered,
                timestamps, and session identifiers.
              </li>
              <li>
                Cookies and similar technologies used for authentication,
                session management, preference storage, and security.
              </li>
              <li>
                Microphone access only when you explicitly start a recording;
                audio is not captured in the background.
              </li>
            </ul>
          </section>

          <section>
            <h2>2. How We Use Your Information</h2>
            <ul>
              <li>Provide, maintain, and improve the Service.</li>
              <li>
                Transcribe audio, summarize meetings, extract action items,
                suggest priorities and deadlines, and generate reports using
                AI.
              </li>
              <li>
                Authenticate users, prevent abuse, enforce our Terms, and
                secure the platform.
              </li>
              <li>
                Deliver notifications you’ve configured (email, Slack,
                in-app).
              </li>
              <li>Process payments and manage your subscription.</li>
              <li>Respond to support requests and communicate updates.</li>
              <li>
                Comply with legal obligations and enforce our legal rights.
              </li>
            </ul>
            <p>
              We do <strong>not</strong> use your meeting content to train
              foundational AI models, and we do <strong>not</strong> sell your
              personal information.
            </p>
          </section>

          <section>
            <h2>3. AI Processing and Subprocessors</h2>
            <p>
              Entomate uses large language models and speech-to-text providers
              to generate transcripts, summaries, and action items. When you
              send content through an AI-powered feature, that content is
              transmitted to the relevant provider under a data-processing
              agreement that prohibits training on your data:
            </p>
            <ul>
              <li>
                <strong>OpenAI</strong> and/or <strong>Google Gemini</strong> —
                transcription, summarization, and agent reasoning.
              </li>
              <li>
                <strong>Supabase</strong> — database and authenticated file
                storage for your workspace data.
              </li>
              <li>
                <strong>Clerk</strong> — identity and session management.
              </li>
              <li>
                <strong>Cloud hosting providers</strong> — application compute,
                storage, and CDN.
              </li>
              <li>
                <strong>Sentry</strong> — error tracking (IP and stack traces
                only; we scrub request bodies).
              </li>
            </ul>
            <p>
              A full, current list of subprocessors is available on request.
            </p>
          </section>

          <section>
            <h2>4. Meeting Recording and Consent</h2>
            <p>
              You are responsible for obtaining consent from all participants
              before recording any meeting. Many jurisdictions require
              all-party consent for audio recording. Entomate provides visible
              recording indicators, but the legal obligation to notify
              participants rests with you.
            </p>
          </section>

          <section>
            <h2>5. How We Share Information</h2>
            <ul>
              <li>
                <strong>Within your workspace</strong> — meeting content,
                tasks, and analytics are visible to members of your
                organization based on your role settings.
              </li>
              <li>
                <strong>With subprocessors</strong> — as described in §3, under
                contractual confidentiality and security obligations.
              </li>
              <li>
                <strong>With integrations you connect</strong> — only the data
                you direct us to send (e.g., posting a summary to Slack).
              </li>
              <li>
                <strong>For legal reasons</strong> — when required by law,
                legal process, or to protect rights, safety, or property.
              </li>
              <li>
                <strong>In a business transfer</strong> — if Entomate is
                acquired, merged, or reorganized, your data may transfer under
                this Policy.
              </li>
            </ul>
          </section>

          <section>
            <h2>6. Data Retention</h2>
            <p>
              We retain workspace data for as long as your account is active.
              You may delete meetings, transcripts, tasks, and projects at any
              time; deletions are propagated from backups on a rolling 30-day
              schedule. On account deletion, we remove personal data within 90
              days except where retention is required for legal, tax, or
              security reasons.
            </p>
          </section>

          <section>
            <h2>7. Security</h2>
            <p>
              We use encryption in transit (TLS 1.2+) and at rest, row-level
              security on our database, scoped API tokens, rate limiting, and
              routine vulnerability scanning. No system is perfectly secure; if
              we become aware of a breach affecting your data, we will notify
              you as required by law.
            </p>
          </section>

          <section>
            <h2>8. Your Rights</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul>
              <li>Access, correct, or export your personal data.</li>
              <li>
                Delete your data or restrict/object to certain processing.
              </li>
              <li>Withdraw consent for optional processing at any time.</li>
              <li>
                Disconnect any integration, revoking the scopes previously
                granted.
              </li>
              <li>
                Lodge a complaint with your local data protection authority.
              </li>
            </ul>
            <p>
              To exercise these rights, contact{' '}
              <a href="mailto:privacy@entomate.app">privacy@entomate.app</a>.
              Workspace admins can fulfil most requests directly from Settings.
            </p>
          </section>

          <section>
            <h2>9. International Transfers</h2>
            <p>
              Entomate operates globally. We transfer personal data across
              borders under appropriate safeguards (e.g., the EU Standard
              Contractual Clauses and the UK IDTA).
            </p>
          </section>

          <section>
            <h2>10. Children</h2>
            <p>
              Entomate is not directed to children under 16 and we do not
              knowingly collect personal information from them.
            </p>
          </section>

          <section>
            <h2>11. Changes to This Policy</h2>
            <p>
              We may update this Policy. Material changes will be announced in
              the app or by email at least 14 days before they take effect.
              The “Last updated” date above always reflects the current version.
            </p>
          </section>

          <section>
            <h2>12. Contact</h2>
            <p>
              Questions or requests? Email{' '}
              <a href="mailto:privacy@entomate.app">privacy@entomate.app</a>.
            </p>
          </section>

          <footer className="legal-footer">
            <Link to="/" className="btn-ghost">← Back to home</Link>
            <Link to="/terms" className="btn-ghost">Read Terms →</Link>
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

        .legal-page .container {
          max-width: 820px;
          margin: 0 auto;
          padding: 0 24px;
        }

        .legal-page nav {
          position: sticky;
          top: 0;
          z-index: 100;
          height: 64px;
          display: flex;
          align-items: center;
          background: rgba(4, 4, 4, 0.85);
          backdrop-filter: blur(20px) saturate(160%);
          -webkit-backdrop-filter: blur(20px) saturate(160%);
          border-bottom: 1px solid var(--border);
        }
        .legal-page nav .container {
          max-width: 1200px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }
        .legal-page .nav-logo {
          display: flex;
          align-items: center;
          text-decoration: none;
          transition: filter 300ms ease;
        }
        .legal-page .nav-logo:hover {
          filter: drop-shadow(0 0 12px rgba(255, 45, 107, 0.5));
        }
        .legal-page .nav-cta { display: flex; gap: 12px; }

        .legal-page .btn-ghost {
          padding: 8px 20px;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: 500;
          background: transparent;
          text-decoration: none;
          transition: all 150ms ease;
        }
        .legal-page .btn-ghost:hover {
          border-color: rgba(255, 45, 107, 0.3);
          color: var(--text-primary);
        }

        .legal-page .legal-main { padding: 64px 0 96px; }

        .legal-page .legal-header { margin-bottom: 48px; }
        .legal-page .eyebrow {
          display: inline-block;
          font-family: var(--font-mono);
          font-size: 12px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--crimson);
          padding: 6px 12px;
          border: 1px solid rgba(255, 45, 107, 0.25);
          border-radius: 999px;
          margin-bottom: 16px;
        }
        .legal-page h1 {
          font-family: var(--font-display);
          font-size: clamp(36px, 6vw, 56px);
          line-height: 1.1;
          margin: 0 0 12px;
        }
        .legal-page .muted { color: var(--text-muted); font-size: 14px; }

        .legal-page .legal-intro {
          padding: 24px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          margin-bottom: 32px;
        }
        .legal-page .legal-intro p { margin: 0 0 12px; color: var(--text-secondary); }
        .legal-page .legal-intro p:last-child { margin-bottom: 0; }

        .legal-page section { margin-bottom: 32px; }
        .legal-page h2 {
          font-family: var(--font-display);
          font-size: 24px;
          margin: 32px 0 12px;
          color: var(--text-primary);
        }
        .legal-page h3 {
          font-family: var(--font-display);
          font-size: 17px;
          margin: 24px 0 8px;
          color: var(--text-primary);
        }
        .legal-page p, .legal-page li {
          color: var(--text-secondary);
          font-size: 15px;
        }
        .legal-page ul { padding-left: 22px; margin: 8px 0 16px; }
        .legal-page li { margin-bottom: 8px; }
        .legal-page strong { color: var(--text-primary); }
        .legal-page a {
          color: var(--crimson);
          text-decoration: none;
          border-bottom: 1px dashed rgba(255, 45, 107, 0.35);
          transition: all 150ms ease;
        }
        .legal-page a:hover {
          color: var(--text-primary);
          border-bottom-color: var(--crimson);
        }
        .legal-page code {
          font-family: var(--font-mono);
          font-size: 12px;
          padding: 2px 6px;
          background: var(--elevated);
          border: 1px solid var(--border);
          border-radius: 4px;
          color: var(--mint);
          word-break: break-all;
        }

        .legal-page .legal-footer {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 64px;
          padding-top: 32px;
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
