import React from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'
import BackToTop from '../components/BackToTop'

export default function PrivacyPolicy() {
  const lastUpdated = 'November 23, 2026'

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
              choices you have. Entomate is part of a product
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
                <strong>Account data</strong> — name, email, avatar, organization
                name, role, and time zone. Supabase Auth handles sign-in and
                password credentials. If you use Google sign-in, we receive
                the profile information you authorize Google to share.
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
                <strong>Ask Entomate conversations</strong> — your prompts and
                responses are saved in your account’s chat history so you can
                reopen or delete conversations.
              </li>
              <li>
                <strong>Billing information</strong> — Stripe processes payments
                and collects payment details. Entomate keeps workspace plan
                information, Stripe customer and subscription identifiers,
                and records of bot-hour purchases and usage.
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
                We use these permissions to show calendar events and to
                create or modify events when you use calendar actions in
                Entomate. When you ask for a briefing or calendar answer,
                Ask Entomate can send relevant event details, such as the
                title, time, location, agenda, and meeting link, to Google
                Gemini to generate your answer. Details included in an answer
                may remain in your chat history until you delete it. If you
                turn on Meet Mate auto-join, we use the meeting link and time
                to schedule the bot through Recall.ai and may use invitee
                email addresses to send recording notices and opt-out links.
                We store authorization tokens so the features you enable can
                keep working. Disconnecting Google Calendar removes the
                connection from Entomate. You can also revoke access in your
                Google Account. Our use and transfer of Google user data
                adheres to the{' '}
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
                Logos Vision or Pulse (its sister products), you may grant
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
                Deliver recording notices, meeting follow-ups, and
                notifications you’ve configured (email, Slack, in-app).
                Follow-up emails can be sent automatically after meetings.
                Recipients may come from the calendar invitation,
                the bot’s attendee list, or action-item owners. You can
                review the draft, change recipients, or turn off automatic
                sending in the meeting’s Follow-up tab.
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
                transcription of meetings you record in the browser,
                summarization, action-item extraction, and agent reasoning.
              </li>
              <li>
                <strong>Recall.ai</strong> — meeting bot infrastructure for
                Meet/Zoom/Teams. Recall hosts the audio + video recording and
                runs transcription on our behalf. Recall does not retain content
                for training; data is processed under their DPA.
              </li>
              <li>
                <strong>Deepgram</strong> — real-time speech-to-text and
                speaker diarization for the meeting bot. Audio is streamed via
                Recall under our Deepgram credential.
              </li>
              <li>
                <strong>Supabase</strong> — authentication, database, and
                authenticated file storage for your workspace data.
              </li>
              <li>
                <strong>Stripe</strong> — checkout, payments, and subscription
                management.
              </li>
              <li>
                <strong>Resend</strong> — delivers recording notices, opt-out
                links, and meeting follow-up emails when configured.
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
            <p>
              <strong>Live captions (optional)</strong> — when you record a
              meeting in the browser, you can turn on live captions. They come
              from your browser’s own speech recognition, not from Entomate: in
              Google Chrome, for example, the audio is sent to Google to be
              recognized. That service is part of your browser and is covered
              by its maker’s terms, not by our subprocessor agreements.
              Captions are off until you turn them on, and Entomate does not
              save them.
            </p>
          </section>

          <section>
            <h2>4. Meeting Recording, Consent, and the Meet Mate Bot</h2>
            <p className="legal-pending-review">
              <em>
                This section describes current recording practices and
                remains pending counsel review.
              </em>
            </p>

            <h3>4.1 What the bot does</h3>
            <p>
              Entomate operates an AI notetaker called <strong>Meet Mate</strong>{' '}
              that joins meetings as a visible participant. When launched,
              Meet Mate:
            </p>
            <ul>
              <li>Joins the meeting using a clearly identifiable display name.</li>
              <li>
                Posts a chat message on join announcing that recording has
                started and identifying the meeting host on whose behalf the
                bot is recording.
              </li>
              <li>
                Captures the meeting’s audio (and video, where the platform
                provides it) and produces a transcript with speaker labels.
              </li>
              <li>
                Surfaces notes, summaries, and action items to the meeting
                host and their workspace.
              </li>
            </ul>

            <h3>4.2 Where the data lives</h3>
            <ul>
              <li>
                <strong>Audio + video recording</strong> — hosted by{' '}
                <strong>Recall.ai</strong> (US-West-2 region).
              </li>
              <li>
                <strong>Transcript</strong> — generated by{' '}
                <strong>Deepgram</strong> via Recall and stored alongside the
                recording.
              </li>
              <li>
                <strong>Notes, summaries, action items</strong> — stored in
                Entomate’s database (Supabase, US-West-2).
              </li>
            </ul>

            <h3>4.3 Who sees it</h3>
            <p>
              Access to recordings, transcripts, and summaries inside
              Entomate follows workspace permissions. You can choose to share
              a recap or send a follow-up outside the workspace. Personal
              meeting notes are private by default and excluded from
              follow-up emails. Entomate does not sell recordings or use
              them to train foundational AI models.
            </p>

            <h3>4.4 Consent — your responsibility</h3>
            <p>
              You are responsible for notifying participants and obtaining
              any required consent before recording. When sending Meet Mate
              manually, the organizer confirms consent in the launch flow.
              Workspace owners and admins who enable calendar auto-join
              acknowledge that they will notify invitees. Entomate records
              the acknowledgment. The bot’s name and chat announcement provide
              notice in the meeting.
            </p>
            <p>
              Workspace administrators can declare a consent posture in{' '}
              <em>Settings → Workspace → Data and privacy → Consent rules</em>{' '}
              (<strong>permissive</strong>, <strong>all-party (US two-party
              states)</strong>, or <strong>GDPR (EU + UK)</strong>). The
              setting surfaces a stronger consent prompt at bot launch. It
              does not override the organizer's legal obligations.
            </p>

            <h3>4.5 Opting out</h3>
            <p>
              Meet Mate can send opt-out links to attendee email addresses
              provided by the organizer or available from a connected
              calendar. Using the link records your opt-out and notifies
              the organizer. The organizer is responsible for responding,
              including stopping or removing the bot when needed. You can
              also ask the organizer directly.
            </p>
            <p>
              During transcript import, Entomate removes speech from
              opted-out participants it can match to the transcript by
              email. To request deletion of personal data, use the form
              described in §8.
            </p>

            <h3>4.6 Retention</h3>
            <p>
              Recordings and transcripts are retained per your workspace’s
              policy. Default retention is described in §6 (Data Retention).
              A workspace can set its retention to 30, 90 or 365 days in
              Settings. A daily job deletes recordings and transcripts that
              are older than that setting.
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
              <strong>Workspace data</strong> — we retain meeting records,
              tasks, and projects while your account is active. The recording
              and transcript retention windows are described below. You may
              delete workspace records at any time. Deletions are propagated
              from backups on a rolling 30-day schedule. On
              account deletion, we remove personal data within 90 days
              except where retention is required for legal, tax, or
              security reasons.
            </p>
            <p>
              <strong>Meet Mate recordings + transcripts</strong> — workspace
              owners and admins set a retention window of <strong>30, 90, or
              365 days</strong> in <em>Settings → Workspace → Data and privacy</em>{' '}
              (default 90). After that window, the Recall.ai-hosted
              recording and transcript are deleted, the URLs are cleared,
              and the transcript copy in Entomate is removed. The meeting
              record, summaries, and action items can remain after the
              sweep. Already-deleted recordings cannot be restored.
            </p>
            <p>
              <strong>Meetings recorded in the browser</strong> — the audio is
              kept in our authenticated file storage so that you can play it
              beside the transcript, through links that expire within an hour.
              It is deleted after the same retention window (30, 90, or 365
              days; default 90), when the meeting is deleted, or sooner when
              someone with access to the meeting chooses{' '}
              <em>Remove audio</em>. The transcript stays until the retention
              window ends.
            </p>
            <p>
              Retention enforcement runs as a daily sweep; changes apply on
              the next sweep.
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
                Disconnect integrations in Settings. To revoke permissions
                at the provider, use the provider’s account settings.
              </li>
              <li>
                Lodge a complaint with your local data protection authority.
              </li>
            </ul>
            <p>
              To request deletion of your personal data (GDPR Article 17 /
              right to erasure), use the dedicated form at{' '}
              <Link to="/data-deletion">/data-deletion</Link>. We action
              requests within 72 hours; the platform admin may deny under
              Article 17(3) (e.g. legal retention obligation) with a
              documented reason.
            </p>
            <p>
              For all other rights — access, correction, export, restriction,
              consent withdrawal — contact{' '}
              <a href="mailto:fm1@qntmecos.com">fm1@qntmecos.com</a>.
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
              <a href="mailto:fm1@qntmecos.com">fm1@qntmecos.com</a>.
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
          --text-muted:   #A28697;
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
