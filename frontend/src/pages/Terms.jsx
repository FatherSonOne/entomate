import React from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'
import BackToTop from '../components/BackToTop'

export default function Terms() {
  const lastUpdated = 'April 27, 2026'

  return (
    <div className="legal-page">
      <BackToTop />
      <nav>
        <div className="container">
          <Link to="/" className="nav-logo">
            <Logo variant="mark" size="sm" withText={true} />
          </Link>
          <div className="nav-cta">
            <Link to="/" className="btn-ghost">Home</Link>
            <Link to="/privacy" className="btn-ghost">Privacy</Link>
          </div>
        </div>
      </nav>

      <main className="legal-main">
        <div className="container">
          <header className="legal-header">
            <span className="eyebrow">Legal</span>
            <h1>Terms of Service</h1>
            <p className="muted">Last updated: {lastUpdated}</p>
          </header>

          <section className="legal-intro">
            <p>
              These Terms of Service (<strong>“Terms”</strong>) govern your
              access to and use of Entomate (the <strong>“Service”</strong>),
              operated by Entomate and part of the Trifecto ecosystem
              alongside Logos Vision and Pulse. By creating an account, signing
              in, or otherwise using the Service, you agree to these Terms. If
              you’re accepting on behalf of an organization, you represent
              that you have authority to bind that organization.
            </p>
          </section>

          <section>
            <h2>1. The Service</h2>
            <p>
              Entomate is an AI-powered meeting intelligence platform that
              captures meeting content, generates transcripts and summaries,
              extracts action items, automates follow-ups, and integrates with
              third-party productivity tools (calendar, chat, CRM). Features
              and pricing may change; we’ll give reasonable notice of material
              changes.
            </p>
          </section>

          <section>
            <h2>2. Eligibility and Accounts</h2>
            <ul>
              <li>You must be at least 16 years old to use the Service.</li>
              <li>
                You are responsible for maintaining the confidentiality of
                your credentials and for all activity under your account.
              </li>
              <li>
                Notify us promptly at{' '}
                <a href="mailto:fm1@qntmecos.com">fm1@qntmecos.com</a>{' '}
                if you believe your account has been compromised.
              </li>
              <li>
                You may not share a single user seat among multiple
                individuals.
              </li>
            </ul>
          </section>

          <section>
            <h2>3. Your Content</h2>
            <p>
              “Customer Content” means everything you or your users upload,
              record, or submit to the Service — including audio, transcripts,
              notes, tasks, projects, and messages. You retain all rights to
              Customer Content. You grant Entomate a worldwide, non-exclusive,
              royalty-free license to host, process, transmit, display, and
              otherwise use Customer Content solely to operate and improve the
              Service for you. We will not use Customer Content to train
              foundational AI models.
            </p>
            <p>
              You represent that you have all rights, consents, and
              authorizations necessary for Entomate to process Customer
              Content as described.
            </p>
          </section>

          <section>
            <h2>4. Meeting Recording Consent and the Meet Mate Bot</h2>
            <p className="legal-pending-review">
              <em>
                Effective {lastUpdated} — pending counsel review.
              </em>
            </p>
            <p>
              Entomate operates an AI notetaker called <strong>Meet Mate</strong>{' '}
              that joins meetings as a visible participant, captures audio and
              video, and produces a transcript and summary. Recording
              conversations is regulated in many jurisdictions, including
              several US states (which require all-party consent) and most EU
              member states.{' '}
              <strong>
                You are solely responsible for obtaining any legally required
                consent from meeting participants before launching Meet Mate.
              </strong>
            </p>
            <p>
              To make that obligation explicit, the launch flow requires the
              organizer to affirm that consent has been obtained from all
              participants. We record who acknowledged this and when. The bot
              joins under a clearly identifiable display name and posts a chat
              announcement on join indicating that recording has started, but
              these surfaces alone do not constitute consent. Misuse of the
              recording feature — including launching Meet Mate into a meeting
              where required consent has not been obtained — may violate law
              and these Terms.
            </p>
            <p>
              Per the Privacy Policy, recordings and transcripts are visible
              only to the workspace that launched the bot, and are not used to
              train foundational AI models. Where the organizer provides an
              attendee email list at launch, each external attendee receives
              a pre-meeting email with an opt-out link; the organizer is
              notified of any opt-out. Workspace owners set a recording
              retention window (30 / 90 / 365 days) in Settings, after which
              the Recall.ai-hosted media is deleted permanently. Personal-data
              deletion requests are handled at{' '}
              <Link to="/data-deletion">/data-deletion</Link> with a 72-hour
              action target.
            </p>
          </section>

          <section>
            <h2>5. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Violate any law or infringe any third party’s rights.</li>
              <li>
                Upload content that is illegal, harassing, defamatory, or
                that contains malware.
              </li>
              <li>
                Reverse-engineer, decompile, or attempt to extract source code
                from the Service (except where permitted by law).
              </li>
              <li>
                Probe, scan, or test the vulnerability of the Service without
                our written permission, or attempt to bypass security or
                authentication.
              </li>
              <li>
                Use the Service to build a competing product, or scrape it at
                volume.
              </li>
              <li>
                Exceed rate limits or misuse AI credits; circumvent billing.
              </li>
              <li>
                Record individuals without the consent required by applicable
                law.
              </li>
            </ul>
          </section>

          <section>
            <h2>6. Third-Party Integrations</h2>
            <p>
              When you connect Google Calendar, Slack, a CRM, or another
              third-party service, you authorize Entomate to access your data
              at that provider under the OAuth scopes you grant (for example:{' '}
              <code>calendar</code>, <code>calendar.events</code>,{' '}
              <code>chat:write</code>, <code>channels:read</code>,{' '}
              <code>users:read</code>). Your use of those providers remains
              governed by their own terms. You are responsible for ensuring
              your use of integrations complies with your employer’s policies
              and the provider’s terms.
            </p>
            <p>
              You may revoke any integration at any time from Settings; this
              also revokes the scopes you previously granted.
            </p>
          </section>

          <section>
            <h2>7. AI Output</h2>
            <p>
              Entomate uses machine-learning systems to produce transcripts,
              summaries, suggested tasks, priorities, and automations
              (<strong>“AI Output”</strong>). AI Output may contain
              inaccuracies. You are responsible for reviewing AI Output before
              relying on it for decisions, especially those with legal,
              financial, medical, or safety implications. Entomate does not
              warrant the accuracy, completeness, or suitability of AI Output.
            </p>
          </section>

          <section>
            <h2>8. Plans, Billing, and Trials</h2>
            <ul>
              <li>
                Paid plans are billed in advance on a recurring basis (monthly
                or annually) until canceled.
              </li>
              <li>
                You can cancel at any time from Settings; cancellation takes
                effect at the end of the current billing period. Fees already
                paid are non-refundable except where required by law.
              </li>
              <li>
                Free trials, if offered, convert automatically to a paid plan
                at the end of the trial unless canceled before then.
              </li>
              <li>
                We may change prices with at least 30 days’ notice; changes
                apply to the next renewal.
              </li>
              <li>
                You are responsible for any taxes applicable to your
                subscription.
              </li>
            </ul>
          </section>

          <section>
            <h2>9. Intellectual Property</h2>
            <p>
              Entomate, its logo, and the Service (including all software,
              design, and content we provide) are owned by Entomate and its
              licensors and are protected by intellectual-property laws.
              Except for the rights expressly granted to you in these Terms,
              no license is granted to you.
            </p>
          </section>

          <section>
            <h2>10. Feedback</h2>
            <p>
              If you send us suggestions or feedback, you grant us a
              non-exclusive, perpetual, irrevocable, royalty-free license to
              use that feedback without restriction.
            </p>
          </section>

          <section>
            <h2>11. Suspension and Termination</h2>
            <p>
              We may suspend or terminate your access to the Service if you
              breach these Terms, if required by law, or to protect the
              Service or its users. You may terminate your account at any
              time. On termination, your right to use the Service ends; we
              retain and delete Customer Content as described in our{' '}
              <Link to="/privacy">Privacy Policy</Link>.
            </p>
          </section>

          <section>
            <h2>12. Disclaimers</h2>
            <p>
              The Service is provided <strong>“as is”</strong> and{' '}
              <strong>“as available”</strong> without warranties of any kind,
              whether express, implied, or statutory, including warranties of
              merchantability, fitness for a particular purpose, and
              non-infringement. We do not warrant that the Service will be
              uninterrupted, error-free, or secure, or that AI Output will be
              accurate.
            </p>
          </section>

          <section>
            <h2>13. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Entomate and its
              suppliers will not be liable for indirect, incidental, special,
              consequential, or exemplary damages, or any loss of profits,
              revenue, data, or business opportunities, even if advised of the
              possibility. Our aggregate liability for any claim arising out
              of or relating to the Service will not exceed the greater of
              <strong> (a)</strong> the amount you paid us for the Service in
              the 12 months before the event giving rise to the claim, or{' '}
              <strong>(b) US$100</strong>.
            </p>
          </section>

          <section>
            <h2>14. Indemnification</h2>
            <p>
              You will defend, indemnify, and hold Entomate harmless from any
              third-party claim arising from: (a) Customer Content, (b) your
              use of the Service in violation of these Terms or law, or
              (c) your failure to obtain required recording consent.
            </p>
          </section>

          <section>
            <h2>15. Changes to the Service or Terms</h2>
            <p>
              We may modify the Service or these Terms. We’ll announce
              material changes in the app or by email at least 14 days before
              they take effect. Continued use after that date constitutes
              acceptance.
            </p>
          </section>

          <section>
            <h2>16. Governing Law and Disputes</h2>
            <p>
              These Terms are governed by the laws of the jurisdiction in
              which Entomate is established, without regard to conflict-of-law
              rules. The parties submit to the exclusive jurisdiction of the
              courts located there, except that either party may seek
              injunctive relief in any competent court to protect its
              intellectual-property rights.
            </p>
          </section>

          <section>
            <h2>17. Miscellaneous</h2>
            <ul>
              <li>
                <strong>Entire agreement</strong> — these Terms and the
                Privacy Policy are the complete agreement between us.
              </li>
              <li>
                <strong>Severability</strong> — if any provision is
                unenforceable, the rest remains in force.
              </li>
              <li>
                <strong>No waiver</strong> — failure to enforce is not a
                waiver.
              </li>
              <li>
                <strong>Assignment</strong> — you may not assign these Terms
                without our consent; we may assign them in connection with a
                merger or sale.
              </li>
            </ul>
          </section>

          <section>
            <h2>18. Contact</h2>
            <p>
              Questions? Email{' '}
              <a href="mailto:fm1@qntmecos.com">fm1@qntmecos.com</a>.
            </p>
          </section>

          <footer className="legal-footer">
            <Link to="/" className="btn-ghost">← Back to home</Link>
            <Link to="/privacy" className="btn-ghost">Read Privacy →</Link>
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
        .legal-page .legal-intro p { margin: 0; color: var(--text-secondary); }

        .legal-page section { margin-bottom: 32px; }
        .legal-page h2 {
          font-family: var(--font-display);
          font-size: 24px;
          margin: 32px 0 12px;
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

        .legal-page .legal-pending-review {
          padding: 12px 16px;
          background: rgba(255, 184, 0, 0.06);
          border: 1px solid rgba(255, 184, 0, 0.25);
          border-left: 3px solid var(--amber);
          border-radius: var(--radius-md);
          margin: 0 0 24px;
        }
        .legal-page .legal-pending-review em {
          color: var(--amber);
          font-style: normal;
          font-size: 14px;
        }

        @media (max-width: 600px) {
          .legal-page .legal-main { padding: 32px 0 64px; }
          .legal-page h1 { font-size: 32px; }
        }
      `}</style>
    </div>
  )
}
