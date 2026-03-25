import React, { useEffect, useRef } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LandingPage() {
  const { isSignedIn, loading: isLoading } = useAuth()
  const isLoaded = !isLoading
  const landingRef = useRef(null)

  // Load Google Fonts
  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap'
    document.head.appendChild(link)

    const preconnect1 = document.createElement('link')
    preconnect1.rel = 'preconnect'
    preconnect1.href = 'https://fonts.googleapis.com'
    document.head.appendChild(preconnect1)

    const preconnect2 = document.createElement('link')
    preconnect2.rel = 'preconnect'
    preconnect2.href = 'https://fonts.gstatic.com'
    preconnect2.crossOrigin = 'anonymous'
    document.head.appendChild(preconnect2)

    return () => {
      document.head.removeChild(link)
      document.head.removeChild(preconnect1)
      document.head.removeChild(preconnect2)
    }
  }, [])

  // IntersectionObserver for agent card factor bars animation
  useEffect(() => {
    if (!landingRef.current) return

    const factorWidths = {
      'factor-w-90': '90%',
      'factor-w-78': '78%',
      'factor-w-95': '95%',
      'factor-w-62': '62%',
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.querySelectorAll('.factor-fill').forEach((bar) => {
              const wClass = [...bar.classList].find((c) => factorWidths[c])
              const target = wClass ? factorWidths[wClass] : '0%'
              bar.style.width = '0%'
              requestAnimationFrame(() => {
                bar.style.width = target
              })
            })
          }
        })
      },
      { threshold: 0.4 }
    )

    const agentCards = landingRef.current.querySelectorAll('.agent-card')
    agentCards.forEach((el) => observer.observe(el))

    // Smooth nav active state
    const sections = landingRef.current.querySelectorAll('section[id]')
    const navLinks = landingRef.current.querySelectorAll('.nav-links a')

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            navLinks.forEach((link) => {
              const href = link.getAttribute('href')
              link.style.color =
                href === '#' + entry.target.id ? 'var(--text-primary)' : ''
            })
          }
        })
      },
      { threshold: 0.5 }
    )

    sections.forEach((s) => sectionObserver.observe(s))

    return () => {
      observer.disconnect()
      sectionObserver.disconnect()
    }
  }, [])

  if (isLoaded && isSignedIn) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="landing-page" ref={landingRef}>

      {/* ── NAVIGATION ── */}
      <nav>
        <div className="container">
          <a href="#" className="nav-logo">
            <div className="nav-logo-mark">
              <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                <polyline points="6,30 6,20 9,16 11,14 11,11 12,14 13,11 14,14 15,10 16,14 17,11 17,15" fill="none" stroke="#FF2D6B" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <polygon points="6,30 6,20 10,22 12,26 10,30" fill="#FF2D6B" opacity="0.25" />
                <polyline points="30,30 30,20 27,16 25,14 25,11 24,14 23,11 22,14 21,10 20,14 19,11 19,15" fill="none" stroke="#FF2D6B" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <polygon points="30,30 30,20 26,22 24,26 26,30" fill="#FF2D6B" opacity="0.25" />
                <rect x="14" y="16" width="8" height="1.5" rx="0.75" fill="#FF2D6B" />
                <rect x="14" y="19" width="6" height="1.5" rx="0.75" fill="#FF2D6B" opacity="0.7" />
                <rect x="14" y="22" width="8" height="1.5" rx="0.75" fill="#FF2D6B" />
                <circle cx="18" cy="14" r="2.5" fill="#FFB800" opacity="0.9">
                  <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle cx="18" cy="14" r="4" fill="#FFB800" opacity="0.15">
                  <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.15;0;0.15" dur="2s" repeatCount="indefinite" />
                </circle>
              </svg>
            </div>
            <span className="nav-logo-text">entomate</span>
          </a>

          <ul className="nav-links">
            <li><a href="#trifecto">The Trifecto</a></li>
            <li><a href="#features">Features</a></li>
            <li><a href="#integrations">Integrations</a></li>
            <li><a href="#guide">User Guide</a></li>
            <li><a href="#logos">Branding</a></li>
          </ul>

          <div className="nav-cta">
            <Link to="/sign-in" className="btn-ghost">Sign In</Link>
            <Link to="/sign-in" className="btn-primary">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero">
        <div className="hero-aurora">
          <div className="aurora-blob aurora-blob-1"></div>
          <div className="aurora-blob aurora-blob-2"></div>
          <div className="aurora-blob aurora-blob-3"></div>
        </div>
        <div className="hero-grid"></div>

        <div className="container">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="hero-badge-dot"></span>
              The Hands of the Trifecto
            </div>

            <h1>
              Automate<br />
              <span className="highlight">everything</span><br />
              that matters.
            </h1>

            <p className="hero-sub">
              Entomate connects your meetings, tasks, and team into intelligent workflows.
              165+ automations, 4 AI agents, and deep integrations — all from a single visual canvas.
            </p>

            <div className="hero-actions">
              <Link to="/sign-in" className="btn-primary btn-large">Start Automating Free</Link>
              <a href="#features" className="btn-ghost btn-large">See All Features &rarr;</a>
            </div>

            <div className="hero-stats">
              <div className="stat-item">
                <span className="stat-num">165<span>+</span></span>
                <span className="stat-label">Features Built</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-num">62<span>+</span></span>
                <span className="stat-label">AI-Powered</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-num">4</span>
                <span className="stat-label">AI Agents</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-num">&infin;</span>
                <span className="stat-label">Workflows Possible</span>
              </div>
            </div>
          </div>
        </div>

        {/* Brand hero visual — Animated Hands of the Trifecto */}
        <div className="hero-visual">
          <div className="hero-visual-wrap">
            {/* Background glow */}
            <div className="hands-bg-glow"></div>

            {/* Scan line overlay */}
            <div className="hands-scan-line"></div>

            {/* Animated SVG particles & neural arcs */}
            <svg className="hands-particles" viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg">
              {/* Neural arcs between hand centers — calibrated to fingertip meeting point (400, 210) */}
              <path d="M280 220 Q400 150 520 220" fill="none" stroke="#FF2D6B" strokeWidth="1.5" strokeDasharray="300" strokeDashoffset="300" opacity="0.6">
                <animate attributeName="stroke-dashoffset" values="300;0;300" dur="4s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0;0.7;0" dur="4s" repeatCount="indefinite"/>
              </path>
              <path d="M260 210 Q400 120 540 210" fill="none" stroke="#00F5D4" strokeWidth="1" strokeDasharray="350" strokeDashoffset="350" opacity="0.4">
                <animate attributeName="stroke-dashoffset" values="350;0;350" dur="4s" begin="0.5s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0;0.5;0" dur="4s" begin="0.5s" repeatCount="indefinite"/>
              </path>
              <path d="M290 235 Q400 190 510 235" fill="none" stroke="#FFB800" strokeWidth="1" strokeDasharray="260" strokeDashoffset="260" opacity="0.5">
                <animate attributeName="stroke-dashoffset" values="260;0;260" dur="4s" begin="1s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0;0.6;0" dur="4s" begin="1s" repeatCount="indefinite"/>
              </path>

              {/* Center neural node — at fingertip meeting point */}
              <circle cx="400" cy="210" r="4" fill="#FF2D6B">
                <animate attributeName="r" values="4;10;4" dur="2s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.8;1;0.8" dur="2s" repeatCount="indefinite"/>
              </circle>

              {/* Ripple rings from center */}
              <circle cx="400" cy="210" r="4" fill="none" stroke="#FF2D6B" strokeWidth="1.5" opacity="0.8">
                <animate attributeName="r" values="4;60" dur="2.5s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.8;0" dur="2.5s" repeatCount="indefinite"/>
              </circle>
              <circle cx="400" cy="210" r="4" fill="none" stroke="#FFB800" strokeWidth="1" opacity="0.6">
                <animate attributeName="r" values="4;60" dur="2.5s" begin="0.8s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.6;0" dur="2.5s" begin="0.8s" repeatCount="indefinite"/>
              </circle>
              <circle cx="400" cy="210" r="4" fill="none" stroke="#00F5D4" strokeWidth="0.8" opacity="0.5">
                <animate attributeName="r" values="4;60" dur="2.5s" begin="1.6s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.5;0" dur="2.5s" begin="1.6s" repeatCount="indefinite"/>
              </circle>

              {/* Left hand energy particles */}
              <circle cx="140" cy="220" r="3" fill="#FF2D6B" opacity="0.9">
                <animate attributeName="cx" values="140;300" dur="3s" repeatCount="indefinite"/>
                <animate attributeName="cy" values="220;212" dur="3s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.9;0" dur="3s" repeatCount="indefinite"/>
                <animate attributeName="r" values="3;1" dur="3s" repeatCount="indefinite"/>
              </circle>
              <circle cx="160" cy="200" r="2" fill="#00F5D4" opacity="0.7">
                <animate attributeName="cx" values="160;290" dur="3s" begin="0.4s" repeatCount="indefinite"/>
                <animate attributeName="cy" values="200;208" dur="3s" begin="0.4s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.7;0" dur="3s" begin="0.4s" repeatCount="indefinite"/>
              </circle>

              {/* Right hand energy particles */}
              <circle cx="660" cy="220" r="3" fill="#FF2D6B" opacity="0.9">
                <animate attributeName="cx" values="660;500" dur="3s" repeatCount="indefinite"/>
                <animate attributeName="cy" values="220;212" dur="3s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.9;0" dur="3s" repeatCount="indefinite"/>
                <animate attributeName="r" values="3;1" dur="3s" repeatCount="indefinite"/>
              </circle>
              <circle cx="640" cy="200" r="2" fill="#FFB800" opacity="0.7">
                <animate attributeName="cx" values="640;510" dur="3s" begin="0.6s" repeatCount="indefinite"/>
                <animate attributeName="cy" values="200;208" dur="3s" begin="0.6s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.7;0" dur="3s" begin="0.6s" repeatCount="indefinite"/>
              </circle>

              {/* Lightning arc flashes */}
              <path d="M315 245 L335 238 L325 250 L345 244" stroke="#FFD040" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0">
                <animate attributeName="opacity" values="0;0;1;0;0" dur="5s" repeatCount="indefinite"/>
              </path>
              <path d="M455 244 L475 250 L465 238 L485 245" stroke="#FFD040" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0">
                <animate attributeName="opacity" values="0;0;0;1;0" dur="5s" repeatCount="indefinite"/>
              </path>

              {/* Subtle circuit lines */}
              <line x1="0" y1="80" x2="800" y2="80" stroke="#00F5D4" strokeWidth="0.5" strokeDasharray="4 8" opacity="0.1"/>
              <line x1="0" y1="420" x2="800" y2="420" stroke="#00F5D4" strokeWidth="0.5" strokeDasharray="4 8" opacity="0.1"/>
            </svg>

            {/* Hero hands image */}
            <div className="hero-hands-img">
              <img src="/logos/logo-c-hero.png" alt="Entomate — The Hands of the Trifecto" />
            </div>

            {/* Workflow trail — clockwise arc connecting trigger → AI → action around the hands */}
            <svg className="wf-trail-line" viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg">
              <path d="M160 90 Q400 60 620 160 Q700 300 580 410"
                    fill="none" stroke="url(#trail-grad)" strokeWidth="1" strokeDasharray="6 4" opacity="0.35">
                <animate attributeName="stroke-dashoffset" values="0;-40" dur="3s" repeatCount="indefinite"/>
              </path>
              <defs>
                <linearGradient id="trail-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FF2D6B"/>
                  <stop offset="50%" stopColor="#FFB800"/>
                  <stop offset="100%" stopColor="#00F5D4"/>
                </linearGradient>
              </defs>
            </svg>
            <div className="wf-node trigger wf-node-hero-trigger">
              <span className="wf-node-dot"></span>
              meeting_ended
            </div>
            <div className="wf-node ai wf-node-hero-ai">
              <span className="wf-node-dot"></span>
              &#10022; Priority Agent
            </div>
            <div className="wf-node action wf-node-hero-action">
              <span className="wf-node-dot"></span>
              &rarr; Slack + CRM
            </div>
          </div>
        </div>
      </section>

      {/* ── THE TRIFECTO ── */}
      <section className="trifecto" id="trifecto">
        <div className="container">
          <div className="trifecto-header">
            <div className="section-label">The Trifecto</div>
            <h2 className="section-title">Three apps.<br />One unified intelligence.</h2>
            <p className="section-sub trifecto-sub">
              Logos Vision, Pulse, and Entomate are built to work together as a complete
              operational stack for modern teams.
            </p>
          </div>

          <div className="trifecto-grid">
            {/* Logos Vision */}
            <div className="trifecto-card">
              <div className="trifecto-icon logos-vision">&#129504;</div>
              <div className="trifecto-product-name">Logos Vision</div>
              <div className="trifecto-product-role">The Mind</div>
              <p>
                AI-powered CRM that remembers everything, surfaces insights, and keeps your
                deals, contacts, and relationships moving forward with intelligent scoring.
              </p>
              <a href="https://crm.logosvision.org" className="trifecto-link" target="_blank" rel="noopener noreferrer">
                Visit Logos Vision &rarr;
              </a>
            </div>

            {/* Pulse */}
            <div className="trifecto-card">
              <div className="trifecto-icon pulse">&#128172;</div>
              <div className="trifecto-product-name">Pulse</div>
              <div className="trifecto-product-role">The Voice</div>
              <p>
                Real-time team communication with 6 Vox modes, voice threads, and deep
                integration into your workflow — so every conversation becomes actionable.
              </p>
              <a href="https://pulse.logosvision.org" className="trifecto-link" target="_blank" rel="noopener noreferrer">
                Visit Pulse &rarr;
              </a>
            </div>

            {/* Entomate - ACTIVE */}
            <div className="trifecto-card active">
              <div className="trifecto-icon entomate">&#9889;</div>
              <div className="trifecto-product-name">Entomate</div>
              <div className="trifecto-product-role active">The Hands — You Are Here</div>
              <p>
                Visual workflow automation, 4 specialized AI agents, and 10+ integrations
                that turn your meetings and decisions into executed action — automatically.
              </p>
              <a href="#features" className="trifecto-link crimson-link">
                Explore Features &rarr;
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURE PILLARS ── */}
      <section className="pillars" id="features">
        <div className="container">
          <div className="pillars-header">
            <div className="section-label">Core Capabilities</div>
            <h2 className="section-title">Built for teams who<br />move fast.</h2>
            <p className="section-sub">
              Every feature is designed around one principle: time between decision and execution should be zero.
            </p>
          </div>

          <div className="pillars-grid">
            {/* Pillar 1: Meeting Intelligence */}
            <div className="pillar-card">
              <div className="pillar-accent crimson">&#127897;&#65039;</div>
              <h3>Meeting Intelligence</h3>
              <p>
                Upload recordings, get instant transcripts, AI summaries, extracted decisions,
                and action items — all searchable with semantic AI.
              </p>
              <ul className="feature-list">
                <li>Audio transcription via Gemini / OpenAI</li>
                <li>Automatic summary + key points extraction</li>
                <li>Sentiment analysis per meeting</li>
                <li>RAG-powered Q&amp;A on any meeting</li>
                <li>CRM + Slack sync in one click</li>
                <li>Full-text + semantic search</li>
              </ul>
            </div>

            {/* Pillar 2: Workflow Automation */}
            <div className="pillar-card">
              <div className="pillar-accent mint">&#9889;</div>
              <h3>Visual Workflow Builder</h3>
              <p>
                Drag-and-drop node canvas with conditional logic, expression editor, webhook
                support, dry-run testing, and automatic version history.
              </p>
              <ul className="feature-list">
                <li>Node-based automation canvas</li>
                <li>6 trigger types incl. cron + webhooks</li>
                <li>Conditional branching &amp; expressions</li>
                <li>Dry-run testing before activation</li>
                <li>Full execution trace &amp; debug logs</li>
                <li>Secrets vault for API credentials</li>
              </ul>
            </div>

            {/* Pillar 3: AI Agents */}
            <div className="pillar-card">
              <div className="pillar-accent amber">&#10022;</div>
              <h3>AI Agent Orchestra</h3>
              <p>
                Four specialized agents — Assignment, Priority, Deadline, Follow-up — each with
                explainability cards, confidence scores, and a feedback loop that learns.
              </p>
              <ul className="feature-list">
                <li>Assignment Agent — skill-based matching</li>
                <li>Priority Agent — context-aware scoring</li>
                <li>Deadline Agent — capacity-aware dates</li>
                <li>Follow-up Agent — pattern detection</li>
                <li>Explanation cards with factor analysis</li>
                <li>User feedback &rarr; model improvement</li>
              </ul>
            </div>

            {/* Pillar 4: Task & Goals */}
            <div className="pillar-card">
              <div className="pillar-accent crimson">&#9989;</div>
              <h3>Tasks &amp; OKRs</h3>
              <p>
                Full task lifecycle from creation to completion, with AI-recommended priority,
                assignment and deadlines — plus full OKR goal tracking with quarterly views.
              </p>
              <ul className="feature-list">
                <li>AI priority + assignment + deadline</li>
                <li>Multi-status workflow (Open &rarr; Done)</li>
                <li>Hierarchical OKR goal tracking</li>
                <li>Key results with progress %</li>
                <li>Goal–task linking</li>
                <li>Quarterly planning views</li>
              </ul>
            </div>

            {/* Pillar 5: Analytics */}
            <div className="pillar-card">
              <div className="pillar-accent mint">&#128202;</div>
              <h3>Intelligence &amp; Analytics</h3>
              <p>
                Morning briefing, deal risk alerts, relationship health scores, and a full
                analytics dashboard measuring time saved by automation.
              </p>
              <ul className="feature-list">
                <li>Daily intelligence briefing</li>
                <li>Deal risk + urgency scoring</li>
                <li>Relationship sentiment trends</li>
                <li>Team performance metrics</li>
                <li>AI effectiveness dashboard</li>
                <li>7d / 30d / 90d / 1y trend analysis</li>
              </ul>
            </div>

            {/* Pillar 6: Integrations */}
            <div className="pillar-card">
              <div className="pillar-accent amber">&#128279;</div>
              <h3>Deep Integrations</h3>
              <p>
                Bidirectional sync with Slack, Salesforce, HubSpot, Google Calendar, and
                webhooks — with an integration health monitor and secrets vault.
              </p>
              <ul className="feature-list">
                <li>Slack — post recaps &amp; alerts</li>
                <li>Salesforce / HubSpot CRM sync</li>
                <li>Google Calendar OAuth</li>
                <li>Inbound + outbound webhooks</li>
                <li>Email action item delivery</li>
                <li>Integration health monitoring</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── DEEP FEATURE: AI EXPLAINABILITY ── */}
      <section className="deep-features">
        <div className="container">

          {/* Feature 1: Task AI */}
          <div className="deep-grid deep-grid-spaced">
            <div className="deep-visual">
              <div className="ui-mockup">
                <div className="mockup-bar">
                  <div className="mockup-dot"></div>
                  <div className="mockup-dot"></div>
                  <div className="mockup-dot"></div>
                </div>
                <div className="mockup-body">
                  <div className="mockup-row">
                    <div className="mockup-avatar"></div>
                    <div className="mockup-line-group">
                      <div className="mockup-line w-full crimson"></div>
                      <div className="mockup-line w-2-3"></div>
                    </div>
                    <div className="mockup-badge high">HIGH</div>
                  </div>
                  <div className="mockup-row">
                    <div className="mockup-avatar mint"></div>
                    <div className="mockup-line-group">
                      <div className="mockup-line w-2-3"></div>
                      <div className="mockup-line w-1-2"></div>
                    </div>
                    <div className="mockup-badge mid">MED</div>
                  </div>
                  <div className="mockup-row">
                    <div className="mockup-avatar amber"></div>
                    <div className="mockup-line-group">
                      <div className="mockup-line w-1-2"></div>
                      <div className="mockup-line w-1-3"></div>
                    </div>
                    <div className="mockup-badge low">LOW</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="deep-copy">
              <div className="section-label">AI Task Management</div>
              <h2 className="section-title deep-section-title">Every task, intelligently prioritized.</h2>
              <p className="deep-body-text">
                Entomate's four AI agents work behind every task. They don't just suggest —
                they explain exactly why, with confidence scores and alternative options you can override.
              </p>

              <div className="deep-feature-item">
                <div className="deep-feature-icon">&#127919;</div>
                <div className="deep-feature-text">
                  <h4>Priority Agent</h4>
                  <p>Analyzes meeting sentiment, deadlines, and business context to assign High/Medium/Low priority automatically.</p>
                </div>
              </div>

              <div className="deep-feature-item">
                <div className="deep-feature-icon">&#128100;</div>
                <div className="deep-feature-text">
                  <h4>Assignment Agent</h4>
                  <p>Matches tasks to team members based on skillset, current workload, and historical performance.</p>
                </div>
              </div>

              <div className="deep-feature-item">
                <div className="deep-feature-icon">&#128197;</div>
                <div className="deep-feature-text">
                  <h4>Deadline Agent</h4>
                  <p>Calculates realistic due dates by factoring in task complexity, team capacity, and sprint commitments.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 2: Agent Explainability */}
          <div className="deep-grid reverse">
            <div className="deep-visual">
              <div className="agent-card">
                <div className="agent-header">
                  <span className="agent-name">&#10022; Priority Agent — Decision Trace</span>
                  <span className="agent-confidence">Confidence: <span className="confidence-num">94%</span></span>
                </div>
                <div className="agent-body">
                  <div className="factor-bar">
                    <span className="factor-label">Meeting sentiment</span>
                    <div className="factor-track">
                      <div className="factor-fill crimson factor-w-90"></div>
                    </div>
                    <span className="factor-pct">90%</span>
                  </div>
                  <div className="factor-bar">
                    <span className="factor-label">Deal urgency</span>
                    <div className="factor-track">
                      <div className="factor-fill amber factor-w-78"></div>
                    </div>
                    <span className="factor-pct">78%</span>
                  </div>
                  <div className="factor-bar">
                    <span className="factor-label">Deadline proximity</span>
                    <div className="factor-track">
                      <div className="factor-fill mint factor-w-95"></div>
                    </div>
                    <span className="factor-pct">95%</span>
                  </div>
                  <div className="factor-bar">
                    <span className="factor-label">Historical pattern</span>
                    <div className="factor-track">
                      <div className="factor-fill crimson factor-w-62"></div>
                    </div>
                    <span className="factor-pct">62%</span>
                  </div>
                  <div className="agent-recommendation">
                    <div className="agent-rec-label">Recommendation</div>
                    <div className="agent-rec-text">Mark "Q1 Proposal Review" as <strong>HIGH</strong> priority — client sentiment was negative and deadline is in 2 days.</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="deep-copy">
              <div className="section-label">Explainable AI</div>
              <h2 className="section-title deep-section-title">AI that shows its work.</h2>
              <p className="deep-body-text">
                Every AI decision in Entomate includes a full explanation card — factor analysis,
                confidence breakdown, and alternative options — so your team stays in control.
              </p>

              <div className="deep-feature-item">
                <div className="deep-feature-icon">&#128202;</div>
                <div className="deep-feature-text">
                  <h4>Factor Analysis</h4>
                  <p>See exactly what data points influenced each recommendation, weighted by importance.</p>
                </div>
              </div>

              <div className="deep-feature-item">
                <div className="deep-feature-icon">&#128260;</div>
                <div className="deep-feature-text">
                  <h4>Feedback Loop</h4>
                  <p>Accept or reject recommendations. Each override teaches the model to improve future suggestions.</p>
                </div>
              </div>

              <div className="deep-feature-item">
                <div className="deep-feature-icon">&#129516;</div>
                <div className="deep-feature-text">
                  <h4>Pattern Learning</h4>
                  <p>Entomate discovers recurring patterns in your workflow and suggests automating them permanently.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── METRICS ── */}
      <section className="metrics">
        <div className="container">
          <div className="metrics-grid">
            <div className="metric-item">
              <div className="metric-num">62<span className="unit">+</span></div>
              <div className="metric-label">AI-powered features across meetings, tasks, workflows, and insights</div>
              <div className="metric-sub">// ai_features_total</div>
            </div>
            <div className="metric-item">
              <div className="metric-num">4</div>
              <div className="metric-label">Specialized AI agents with explainability, confidence scores, and learning</div>
              <div className="metric-sub">// ai_agents_deployed</div>
            </div>
            <div className="metric-item">
              <div className="metric-num">10<span className="unit">+</span></div>
              <div className="metric-label">Third-party integrations: Slack, Salesforce, HubSpot, Google, Webhooks</div>
              <div className="metric-sub">// integrations_live</div>
            </div>
            <div className="metric-item">
              <div className="metric-num">&infin;</div>
              <div className="metric-label">Workflow combinations possible with the visual no-code canvas builder</div>
              <div className="metric-sub">// workflows_possible</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── INTEGRATIONS ── */}
      <section className="integrations" id="integrations">
        <div className="container">
          <div className="integrations-header">
            <div className="section-label">Integrations</div>
            <h2 className="section-title">Connects to everything<br />your team already uses.</h2>
            <p className="section-sub" style={{ margin: '0 auto' }}>
              Slack, Salesforce, HubSpot, Google Calendar, inbound webhooks, outbound webhooks,
              email delivery, and cron scheduling — all configurable from the workflow canvas.
            </p>
          </div>

          <div className="integration-orbit">
            <div className="orbit-ring orbit-ring-1"></div>
            <div className="orbit-ring orbit-ring-2"></div>

            <div className="orbit-center">E</div>

            <div className="integration-chip chip-slack">
              <span className="chip-icon">&#128172;</span> Slack
            </div>
            <div className="integration-chip chip-salesforce">
              <span className="chip-icon">&#9729;&#65039;</span> Salesforce
            </div>
            <div className="integration-chip chip-hubspot">
              <span className="chip-icon">&#129522;</span> HubSpot
            </div>
            <div className="integration-chip chip-gcal">
              <span className="chip-icon">&#128197;</span> Google Calendar
            </div>
            <div className="integration-chip chip-webhook">
              <span className="chip-icon">&#128279;</span> Webhooks
            </div>
            <div className="integration-chip chip-teams">
              <span className="chip-icon">&#128225;</span> Teams
            </div>
            <div className="integration-chip chip-email">
              <span className="chip-icon">&#9993;&#65039;</span> Email
            </div>
            <div className="integration-chip chip-cron">
              <span className="chip-icon">&#9201;&#65039;</span> Cron Jobs
            </div>
          </div>
        </div>
      </section>

      {/* ── LOGO SHOWCASE ── */}
      <section className="logo-showcase" id="logos">
        <div className="container">
          <div className="section-label">Brand Identity</div>
          <h2 className="section-title">Choose a logo direction.</h2>
          <p className="section-sub">
            Four concepts built around the Void x Crimson palette and the
            "Hands of the Trifecto" identity. Click to select.
          </p>

          <div className="logo-confirmed-banner">
            <span className="logo-confirmed-icon">&#10022;</span>
            Option C — "The Hands of the Trifecto" — confirmed direction
          </div>

          <div className="logo-render-grid">
            <div className="logo-render-card featured">
              <div className="logo-render-label">Primary Mark</div>
              <img src="/logos/logo-c-refined.png" alt="Entomate Primary Logo — Refined Hands" />
              <div className="logo-render-caption">Two geometric hands + amber circuit node + E letterform + wordmark</div>
            </div>

            <div className="logo-render-card">
              <div className="logo-render-label">Icon Only</div>
              <img src="/logos/logo-c-icon.png" alt="Entomate Icon Mark" />
              <div className="logo-render-caption">Low-poly hands framing E bars — app icon / favicon usage</div>
            </div>

            <div className="logo-render-card">
              <div className="logo-render-label">Horizontal Lockup</div>
              <img src="/logos/logo-c-horizontal.png" alt="Entomate Horizontal Logo" />
              <div className="logo-render-caption">Compact mark + wordmark + "automate everything" tagline</div>
            </div>

            <div className="logo-render-card">
              <div className="logo-render-label">Light Mode</div>
              <img src="/logos/logo-c-light.png" alt="Entomate Light Mode Logo" className="logo-img-light" />
              <div className="logo-render-caption">Deep crimson on white — print / light UI usage</div>
            </div>
          </div>

          <div className="logo-hero-preview">
            <div className="logo-render-label logo-hero-label">Brand Hero Image — "The Hands of the Trifecto"</div>
            <img src="/logos/logo-c-hero.png" alt="Entomate Hero Brand Image" />
            <p className="logo-render-caption logo-hero-caption">
              Wire-frame geometric hands reaching toward each other, crimson + neon mint energy streaming between fingertips.
              For use in landing pages, pitch decks, and marketing materials.
            </p>
          </div>
        </div>
      </section>

      {/* ── USER GUIDE ── */}
      <section className="guide-preview" id="guide">
        <div className="container">
          <div className="section-label">User Guide</div>
          <h2 className="section-title">Everything you need to know,<br />in one place.</h2>
          <p className="section-sub" style={{ margin: '0 auto', maxWidth: 600 }}>
            Entomate comes with a built-in interactive User Guide covering every feature —
            from meeting recording to AI agents. It updates automatically when new features ship.
          </p>

          <div className="guide-preview-grid">
            {[
              { icon: '🎙️', title: 'Meetings', desc: 'Record, transcribe, and analyze meetings with AI-powered sentiment detection.' },
              { icon: '✅', title: 'Tasks & AI', desc: 'AI suggests assignments, priorities, and deadlines — with full explainability.' },
              { icon: '🔀', title: 'Workflows', desc: 'Visual node-based automations connecting triggers to actions across your tools.' },
              { icon: '🤖', title: 'AI Agents', desc: 'Deploy intelligent bots for assignment, priority detection, and follow-ups.' },
              { icon: '🎯', title: 'Goals & OKRs', desc: 'Track objectives at Company, Team, and Individual levels with key results.' },
              { icon: '🔍', title: 'Search & AI Q&A', desc: 'Semantic search across your workspace with natural-language AI question answering.' },
            ].map((item, i) => (
              <div key={i} className="guide-preview-card">
                <span className="guide-preview-icon">{item.icon}</span>
                <h3 className="guide-preview-title">{item.title}</h3>
                <p className="guide-preview-desc">{item.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Link to="/sign-in" className="btn-primary btn-large">
              Read the Full Guide &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section">
        <div className="container">
          <div className="section-label">Get Started</div>
          <h2>Ready to<br /><span className="cta-highlight">automate</span> everything?</h2>
          <p>
            Join the Trifecto. Connect Entomate to Logos Vision and Pulse
            for a complete operational intelligence stack.
          </p>
          <div className="cta-actions">
            <Link to="/sign-in" className="btn-primary btn-large">Start Free &rarr;</Link>
            <a href="#trifecto" className="btn-ghost btn-large">Meet the Trifecto</a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer>
        <div className="container">
          <div className="footer-inner">
            <div className="footer-left">
              <a href="#" className="nav-logo footer-logo-link">
                <div className="nav-logo-mark">
                  <svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                    <polyline points="6,30 6,20 9,16 11,14 11,11 12,14 13,11 14,14 15,10 16,14 17,11 17,15" fill="none" stroke="#FF2D6B" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    <polygon points="6,30 6,20 10,22 12,26 10,30" fill="#FF2D6B" opacity="0.25" />
                    <polyline points="30,30 30,20 27,16 25,14 25,11 24,14 23,11 22,14 21,10 20,14 19,11 19,15" fill="none" stroke="#FF2D6B" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    <polygon points="30,30 30,20 26,22 24,26 26,30" fill="#FF2D6B" opacity="0.25" />
                    <rect x="14" y="16" width="8" height="1.5" rx="0.75" fill="#FF2D6B" />
                    <rect x="14" y="19" width="6" height="1.5" rx="0.75" fill="#FF2D6B" opacity="0.7" />
                    <rect x="14" y="22" width="8" height="1.5" rx="0.75" fill="#FF2D6B" />
                    <circle cx="18" cy="14" r="2.5" fill="#FFB800" opacity="0.9" />
                  </svg>
                </div>
                <span className="nav-logo-text footer-logo-text">entomate</span>
              </a>
              <span className="footer-text">The Hands of the Trifecto</span>
            </div>

            <div className="footer-links">
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
              <a href="#">Docs</a>
              <a href="#">Status</a>
            </div>

            <div className="trifecto-logos">
              <span className="footer-trifecto-label">part of</span>
              <div className="trifecto-pip lv" title="Logos Vision">L</div>
              <div className="trifecto-pip pulse" title="Pulse">P</div>
              <div className="trifecto-pip ent" title="Entomate">E</div>
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        /* ================================================
           ENTOMATE — VOID x CRIMSON LANDING PAGE
           Scoped under .landing-page
           ================================================ */

        .landing-page {
          --crimson:      #FF2D6B;
          --crimson-dim:  rgba(255, 45, 107, 0.12);
          --crimson-glow: rgba(255, 45, 107, 0.35);
          --mint:         #00F5D4;
          --mint-dim:     rgba(0, 245, 212, 0.10);
          --amber:        #FFB800;
          --amber-dim:    rgba(255, 184, 0, 0.10);
          --void:         #080808;
          --abyss:        #040404;
          --surface:      #101010;
          --elevated:     #181818;
          --border:       rgba(255, 255, 255, 0.07);
          --border-glow:  rgba(255, 45, 107, 0.20);
          --text-primary: #F8F0F3;
          --text-secondary: #C8AAB8;
          --text-muted:   #7A6070;
          --font-display: 'Syne', sans-serif;
          --font-body:    'Space Grotesk', system-ui, sans-serif;
          --font-mono:    'JetBrains Mono', monospace;
          --radius-sm:    6px;
          --radius-md:    10px;
          --radius-lg:    16px;
          --radius-xl:    24px;

          font-family: var(--font-body);
          background: var(--abyss);
          color: var(--text-primary);
          line-height: 1.6;
          overflow-x: hidden;
          position: relative;
        }

        /* ── CANVAS NOISE TEXTURE ── */
        .landing-page::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.035'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 0;
          opacity: 0.5;
        }

        /* ── TYPOGRAPHY ── */
        .landing-page h1, .landing-page h2, .landing-page h3, .landing-page h4 {
          font-family: var(--font-display);
          line-height: 1.15;
        }
        .landing-page code, .landing-page kbd {
          font-family: var(--font-mono);
        }

        /* ── UTILITIES ── */
        .landing-page .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
        }

        .landing-page .crimson { color: var(--crimson); }
        .landing-page .mint    { color: var(--mint); }
        .landing-page .amber   { color: var(--amber); }
        .landing-page .muted   { color: var(--text-muted); }

        /* ── NAV ── */
        .landing-page nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          height: 64px;
          display: flex;
          align-items: center;
          background: rgba(4, 4, 4, 0.85);
          backdrop-filter: blur(20px) saturate(160%);
          -webkit-backdrop-filter: blur(20px) saturate(160%);
          border-bottom: 1px solid var(--border);
        }

        .landing-page nav .container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }

        .landing-page .nav-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }

        .landing-page .nav-logo-mark {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          filter: drop-shadow(0 0 8px rgba(255, 45, 107, 0.5));
          transition: filter 300ms ease;
        }

        .landing-page .nav-logo:hover .nav-logo-mark {
          filter: drop-shadow(0 0 16px rgba(255, 45, 107, 0.8));
        }

        .landing-page .nav-logo-text {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 20px;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }

        .landing-page .nav-links {
          display: flex;
          align-items: center;
          gap: 32px;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .landing-page .nav-links a {
          color: var(--text-secondary);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: color 150ms ease;
        }
        .landing-page .nav-links a:hover { color: var(--text-primary); }

        .landing-page .nav-cta {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .landing-page .btn-ghost {
          padding: 8px 20px;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: 500;
          font-family: var(--font-body);
          background: transparent;
          cursor: pointer;
          transition: all 150ms ease;
          text-decoration: none;
        }
        .landing-page .btn-ghost:hover {
          border-color: rgba(255, 45, 107, 0.3);
          color: var(--text-primary);
        }

        .landing-page .btn-primary {
          padding: 8px 20px;
          border: none;
          border-radius: var(--radius-md);
          background: var(--crimson);
          color: white;
          font-size: 14px;
          font-weight: 600;
          font-family: var(--font-body);
          cursor: pointer;
          transition: all 150ms ease;
          box-shadow: 0 4px 12px var(--crimson-glow);
          text-decoration: none;
        }
        .landing-page .btn-primary:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
          box-shadow: 0 6px 20px var(--crimson-glow);
        }
        .landing-page .btn-primary:active { transform: scale(0.97); }

        .landing-page .btn-large {
          padding: 14px 32px;
          font-size: 16px;
          border-radius: var(--radius-lg);
        }

        /* ── HERO ── */
        .landing-page .hero {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          padding-top: 64px;
          overflow: hidden;
        }

        .landing-page .hero-aurora {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .landing-page .aurora-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          animation: aurora-drift 12s ease-in-out infinite alternate;
          will-change: transform;
        }

        .landing-page .aurora-blob-1 {
          width: 600px;
          height: 400px;
          background: radial-gradient(ellipse, rgba(255, 45, 107, 0.18) 0%, transparent 70%);
          top: -100px;
          left: -100px;
          animation-delay: 0s;
        }
        .landing-page .aurora-blob-2 {
          width: 500px;
          height: 500px;
          background: radial-gradient(ellipse, rgba(0, 245, 212, 0.07) 0%, transparent 70%);
          top: 30%;
          right: -100px;
          animation-delay: -4s;
        }
        .landing-page .aurora-blob-3 {
          width: 400px;
          height: 300px;
          background: radial-gradient(ellipse, rgba(255, 184, 0, 0.06) 0%, transparent 70%);
          bottom: 10%;
          left: 30%;
          animation-delay: -8s;
        }

        @keyframes aurora-drift {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(40px, 30px) scale(1.08); }
        }

        .landing-page .hero-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255, 45, 107, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 45, 107, 0.04) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 40%, black 30%, transparent 100%);
          pointer-events: none;
        }

        .landing-page .hero-content {
          position: relative;
          z-index: 1;
          max-width: 760px;
        }

        .landing-page .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border: 1px solid rgba(255, 45, 107, 0.30);
          border-radius: 100px;
          background: rgba(255, 45, 107, 0.06);
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 500;
          color: var(--crimson);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 28px;
        }

        .landing-page .hero-badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--crimson);
          box-shadow: 0 0 8px var(--crimson);
          animation: pulse-dot 2s ease-in-out infinite;
          will-change: opacity;
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }

        .landing-page .hero h1 {
          font-size: clamp(48px, 6vw, 80px);
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.18;
          color: var(--text-primary);
          margin-bottom: 24px;
          overflow: visible;
        }

        .landing-page .hero h1 .highlight {
          color: var(--crimson);
          text-shadow: 0 0 40px rgba(255, 45, 107, 0.4);
          display: inline-block;
          padding-bottom: 0.05em;
          vertical-align: baseline;
        }

        .landing-page .hero-sub {
          font-size: 20px;
          font-weight: 400;
          color: var(--text-secondary);
          line-height: 1.65;
          max-width: 580px;
          margin-bottom: 40px;
        }

        .landing-page .hero-actions {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .landing-page .hero-stats {
          display: flex;
          align-items: center;
          gap: 32px;
          margin-top: 60px;
          padding-top: 60px;
          border-top: 1px solid var(--border);
        }

        .landing-page .stat-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .landing-page .stat-num {
          font-family: var(--font-display);
          font-size: 28px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.02em;
        }

        .landing-page .stat-num span { color: var(--crimson); }

        .landing-page .stat-label {
          font-size: 12px;
          font-weight: 500;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .landing-page .stat-divider {
          width: 1px;
          height: 40px;
          background: var(--border);
        }

        /* ── HERO VISUAL (right side) — Animated Hands ── */
        .landing-page .hero-visual {
          position: absolute;
          right: -60px;
          top: 50%;
          transform: translateY(-50%);
          width: 900px;
          pointer-events: none;
        }

        .landing-page .hero-visual-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 8/5;
          overflow: visible;
          -webkit-mask-image: radial-gradient(ellipse 85% 80% at 50% 45%, black 50%, transparent 100%);
          mask-image: radial-gradient(ellipse 85% 80% at 50% 45%, black 50%, transparent 100%);
        }

        .landing-page .hands-bg-glow {
          position: absolute;
          inset: -20%;
          background:
            radial-gradient(ellipse 50% 45% at 50% 45%, rgba(255,45,107,0.12) 0%, transparent 70%),
            radial-gradient(ellipse 25% 25% at 30% 55%, rgba(0,245,212,0.06) 0%, transparent 70%),
            radial-gradient(ellipse 25% 25% at 70% 55%, rgba(0,245,212,0.06) 0%, transparent 70%),
            radial-gradient(ellipse 20% 20% at 50% 42%, rgba(255,184,0,0.08) 0%, transparent 60%);
          animation: hands-glow-pulse 4s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes hands-glow-pulse {
          0%, 100% { opacity: 0.7; }
          50%       { opacity: 1; }
        }

        .landing-page .hands-scan-line {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 10;
          overflow: hidden;
        }
        .landing-page .hands-scan-line::after {
          content: '';
          position: absolute;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(255,45,107,0.35), transparent);
          box-shadow: 0 0 12px rgba(255,45,107,0.25);
          animation: hands-scan 4s linear infinite;
        }

        @keyframes hands-scan {
          0%   { transform: translateY(-100%); opacity: 0; }
          5%   { opacity: 0.6; }
          95%  { opacity: 0.6; }
          100% { transform: translateY(300%); opacity: 0; }
        }

        .landing-page .hands-particles {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 5;
        }

        .landing-page .hero-hands-img {
          position: relative;
          z-index: 2;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        .landing-page .hero-hands-img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 30%;
          mix-blend-mode: lighten;
          animation: hands-float 4s ease-in-out infinite;
        }

        @keyframes hands-float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50%       { transform: translateY(-10px) scale(1.015); }
        }

        .landing-page .wf-node {
          position: absolute;
          border-radius: var(--radius-md);
          padding: 6px 10px;
          font-size: 9px;
          font-weight: 600;
          font-family: var(--font-mono);
          display: flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
          backdrop-filter: blur(12px);
          border: 1px solid;
          animation: node-float 6s ease-in-out infinite alternate;
          will-change: transform;
          z-index: 15;
          opacity: 0.85;
          transition: opacity 0.3s ease;
        }
        .landing-page .hero-visual-wrap:hover .wf-node {
          opacity: 1;
        }

        .landing-page .wf-node.trigger {
          background: rgba(255, 45, 107, 0.10);
          border-color: rgba(255, 45, 107, 0.35);
          color: var(--crimson);
          animation-delay: 0s;
        }

        .landing-page .wf-node.action {
          background: rgba(0, 245, 212, 0.08);
          border-color: rgba(0, 245, 212, 0.25);
          color: var(--mint);
          animation-delay: -2s;
        }

        .landing-page .wf-node.ai {
          background: rgba(255, 184, 0, 0.08);
          border-color: rgba(255, 184, 0, 0.25);
          color: var(--amber);
          animation-delay: -4s;
        }

        .landing-page .wf-node-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .landing-page .trigger .wf-node-dot  { background: var(--crimson); box-shadow: 0 0 6px var(--crimson); }
        .landing-page .action .wf-node-dot   { background: var(--mint); box-shadow: 0 0 6px var(--mint); }
        .landing-page .ai .wf-node-dot       { background: var(--amber); box-shadow: 0 0 6px var(--amber); }

        @keyframes node-float {
          from { transform: translateY(0px); }
          to   { transform: translateY(-10px); }
        }

        /* ── SECTION SHARED ── */
        .landing-page section {
          position: relative;
          z-index: 1;
        }

        .landing-page .section-label {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--crimson);
          margin-bottom: 12px;
        }

        .landing-page .section-title {
          font-size: clamp(32px, 4vw, 52px);
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--text-primary);
          margin-bottom: 16px;
        }

        .landing-page .section-sub {
          font-size: 18px;
          color: var(--text-secondary);
          max-width: 560px;
          line-height: 1.65;
        }

        /* ── THE TRIFECTO SECTION ── */
        .landing-page .trifecto {
          padding: 120px 0;
        }

        .landing-page .trifecto-header {
          text-align: center;
          margin-bottom: 80px;
        }

        .landing-page .trifecto-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2px;
          background: var(--border);
          border-radius: var(--radius-xl);
          overflow: hidden;
        }

        .landing-page .trifecto-card {
          background: var(--surface);
          padding: 40px 32px;
          position: relative;
          transition: background 200ms ease;
        }

        .landing-page .trifecto-card:hover { background: var(--elevated); }

        .landing-page .trifecto-card.active {
          background: var(--elevated);
        }

        .landing-page .trifecto-card.active::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--crimson);
          box-shadow: 0 0 20px var(--crimson-glow);
        }

        .landing-page .trifecto-icon {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
          font-size: 22px;
        }

        .landing-page .trifecto-icon.logos-vision {
          background: rgba(139, 92, 246, 0.12);
          border: 1px solid rgba(139, 92, 246, 0.25);
        }

        .landing-page .trifecto-icon.pulse {
          background: rgba(0, 245, 212, 0.10);
          border: 1px solid rgba(0, 245, 212, 0.25);
        }

        .landing-page .trifecto-icon.entomate {
          background: rgba(255, 45, 107, 0.10);
          border: 1px solid rgba(255, 45, 107, 0.25);
        }

        .landing-page .trifecto-product-name {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--text-primary);
          margin-bottom: 6px;
        }

        .landing-page .trifecto-product-role {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.10em;
          color: var(--text-muted);
          margin-bottom: 16px;
          font-family: var(--font-mono);
        }

        .landing-page .trifecto-product-role.active { color: var(--crimson); }

        .landing-page .trifecto-card p {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.7;
        }

        .landing-page .trifecto-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 20px;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          color: var(--text-muted);
          transition: color 150ms ease;
        }
        .landing-page .trifecto-link:hover { color: var(--text-primary); }
        .landing-page .trifecto-link.crimson-link { color: var(--crimson); }
        .landing-page .trifecto-link.crimson-link:hover { color: #FF5585; }

        /* ── FEATURE PILLARS ── */
        .landing-page .pillars {
          padding: 120px 0;
          background: linear-gradient(to bottom, transparent, rgba(255, 45, 107, 0.03) 50%, transparent);
        }

        .landing-page .pillars-header {
          margin-bottom: 64px;
        }

        .landing-page .pillars-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }

        .landing-page .pillar-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: 32px;
          position: relative;
          overflow: hidden;
          transition: border-color 200ms ease, transform 200ms ease;
        }

        .landing-page .pillar-card:hover {
          border-color: var(--border-glow);
          transform: translateY(-4px);
        }

        .landing-page .pillar-card::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--crimson-glow), transparent);
          opacity: 0;
          transition: opacity 200ms ease;
        }

        .landing-page .pillar-card:hover::after { opacity: 1; }

        .landing-page .pillar-accent {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          margin-bottom: 20px;
        }

        .landing-page .pillar-accent.crimson { background: rgba(255, 45, 107, 0.12); border: 1px solid rgba(255, 45, 107, 0.20); }
        .landing-page .pillar-accent.mint    { background: rgba(0, 245, 212, 0.10); border: 1px solid rgba(0, 245, 212, 0.20); }
        .landing-page .pillar-accent.amber   { background: rgba(255, 184, 0, 0.10); border: 1px solid rgba(255, 184, 0, 0.20); }

        .landing-page .pillar-card h3 {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: var(--text-primary);
          margin-bottom: 10px;
        }

        .landing-page .pillar-card p {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.75;
          margin-bottom: 24px;
        }

        .landing-page .feature-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin: 0;
          padding: 0;
        }

        .landing-page .feature-list li {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .landing-page .feature-list li::before {
          content: '\u2192';
          color: var(--crimson);
          flex-shrink: 0;
          font-family: var(--font-mono);
          margin-top: 1px;
        }

        /* ── DEEP FEATURES ── */
        .landing-page .deep-features {
          padding: 120px 0;
        }

        .landing-page .deep-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 80px;
          align-items: center;
        }

        .landing-page .deep-grid.reverse { direction: rtl; }
        .landing-page .deep-grid.reverse > * { direction: ltr; }

        .landing-page .deep-visual {
          position: relative;
        }

        .landing-page .ui-mockup {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          overflow: hidden;
          box-shadow:
            0 40px 80px rgba(0, 0, 0, 0.6),
            0 0 0 1px rgba(255, 45, 107, 0.05) inset;
        }

        .landing-page .mockup-bar {
          height: 40px;
          background: var(--elevated);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          padding: 0 16px;
          gap: 8px;
        }

        .landing-page .mockup-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .landing-page .mockup-dot:nth-child(1) { background: rgba(255, 45, 107, 0.5); }
        .landing-page .mockup-dot:nth-child(2) { background: rgba(255, 184, 0, 0.5); }
        .landing-page .mockup-dot:nth-child(3) { background: rgba(0, 245, 212, 0.5); }

        .landing-page .mockup-body {
          padding: 20px;
        }

        .landing-page .mockup-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: var(--radius-md);
          margin-bottom: 6px;
          border-left: 2px solid transparent;
          transition: all 150ms ease;
        }

        .landing-page .mockup-row:nth-child(1) {
          background: rgba(255, 45, 107, 0.06);
          border-left-color: var(--crimson);
        }

        .landing-page .mockup-row:nth-child(2),
        .landing-page .mockup-row:nth-child(3) {
          background: rgba(255, 255, 255, 0.02);
        }

        .landing-page .mockup-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--crimson), var(--mint));
          flex-shrink: 0;
        }

        .landing-page .mockup-avatar.mint   { background: linear-gradient(135deg, var(--mint), #0088FF); }
        .landing-page .mockup-avatar.amber  { background: linear-gradient(135deg, var(--amber), var(--crimson)); }

        .landing-page .mockup-line-group {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .landing-page .mockup-line {
          height: 8px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 4px;
        }

        .landing-page .mockup-line.w-full { width: 100%; }
        .landing-page .mockup-line.w-2-3 { width: 66%; }
        .landing-page .mockup-line.w-1-2 { width: 50%; }
        .landing-page .mockup-line.w-1-3 { width: 33%; }
        .landing-page .mockup-line.crimson { background: rgba(255, 45, 107, 0.25); }

        .landing-page .mockup-badge {
          padding: 3px 8px;
          border-radius: 100px;
          font-size: 10px;
          font-weight: 700;
          font-family: var(--font-mono);
          flex-shrink: 0;
        }

        .landing-page .mockup-badge.high   { background: rgba(255, 45, 107, 0.15); color: var(--crimson); }
        .landing-page .mockup-badge.mid    { background: rgba(255, 184, 0, 0.15); color: var(--amber); }
        .landing-page .mockup-badge.low    { background: rgba(0, 245, 212, 0.10); color: var(--mint); }

        .landing-page .deep-copy { display: flex; flex-direction: column; gap: 24px; }

        .landing-page .deep-copy .section-label { margin-bottom: 4px; }

        .landing-page .deep-feature-item {
          display: flex;
          gap: 16px;
          padding: 16px;
          border-radius: var(--radius-md);
          border: 1px solid transparent;
          transition: all 150ms ease;
        }

        .landing-page .deep-feature-item:hover {
          background: var(--crimson-dim);
          border-color: var(--border-glow);
        }

        .landing-page .deep-feature-icon {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
          background: var(--elevated);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }

        .landing-page .deep-feature-text h4 {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .landing-page .deep-feature-text p {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        /* ── AGENT EXPLAINABILITY ── */
        .landing-page .agent-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          overflow: hidden;
        }

        .landing-page .agent-header {
          padding: 16px 20px;
          background: var(--elevated);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .landing-page .agent-name {
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 500;
          color: var(--amber);
        }

        .landing-page .agent-confidence {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-muted);
        }

        .landing-page .confidence-num { color: var(--mint); font-weight: 600; }

        .landing-page .agent-body { padding: 20px; }

        .landing-page .factor-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .landing-page .factor-label {
          font-size: 12px;
          color: var(--text-secondary);
          width: 140px;
          flex-shrink: 0;
        }

        .landing-page .factor-track {
          flex: 1;
          height: 4px;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 2px;
          overflow: hidden;
        }

        .landing-page .factor-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 1s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .landing-page .factor-fill.crimson { background: var(--crimson); }
        .landing-page .factor-fill.mint    { background: var(--mint); }
        .landing-page .factor-fill.amber   { background: var(--amber); }

        .landing-page .factor-pct {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-muted);
          width: 32px;
          text-align: right;
        }

        .landing-page .agent-recommendation {
          margin-top: 16px;
          padding: 12px 16px;
          background: rgba(255, 45, 107, 0.06);
          border: 1px solid rgba(255, 45, 107, 0.20);
          border-radius: var(--radius-md);
        }

        .landing-page .agent-rec-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.10em;
          color: var(--crimson);
          margin-bottom: 4px;
          font-family: var(--font-mono);
        }

        .landing-page .agent-rec-text {
          font-size: 13px;
          color: var(--text-primary);
          font-weight: 500;
        }

        /* ── INTEGRATIONS ── */
        .landing-page .integrations {
          padding: 120px 0;
        }

        .landing-page .integrations-header {
          text-align: center;
          margin-bottom: 64px;
        }

        .landing-page .integration-orbit {
          position: relative;
          height: 420px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .landing-page .orbit-center {
          width: 80px;
          height: 80px;
          border-radius: 20px;
          background: var(--crimson);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-display);
          font-size: 36px;
          font-weight: 800;
          color: white;
          box-shadow: 0 0 40px var(--crimson-glow), 0 0 80px rgba(255, 45, 107, 0.15);
          z-index: 5;
          position: relative;
        }

        .landing-page .orbit-ring {
          position: absolute;
          border-radius: 50%;
          border: 1px dashed;
          pointer-events: none;
          animation: ring-spin 30s linear infinite;
          will-change: transform;
        }

        .landing-page .orbit-ring-1 {
          width: 220px;
          height: 220px;
          border-color: rgba(255, 45, 107, 0.20);
          animation-duration: 20s;
        }

        .landing-page .orbit-ring-2 {
          width: 360px;
          height: 360px;
          border-color: rgba(255, 255, 255, 0.08);
          animation-duration: 35s;
          animation-direction: reverse;
        }

        @keyframes ring-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        .landing-page .integration-chip {
          position: absolute;
          background: var(--elevated);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
          transition: all 200ms ease;
        }

        .landing-page .integration-chip:hover {
          border-color: var(--border-glow);
          color: var(--text-primary);
          transform: scale(1.04);
        }

        .landing-page .integration-chip .chip-icon { font-size: 16px; }

        /* Positions */
        .landing-page .chip-slack     { top: 10%;  left: 15%; }
        .landing-page .chip-salesforce{ top: 5%;   right: 18%; }
        .landing-page .chip-hubspot   { top: 35%;  left: 3%; }
        .landing-page .chip-gcal      { top: 35%;  right: 3%; }
        .landing-page .chip-webhook   { bottom: 15%;left: 15%; }
        .landing-page .chip-teams     { bottom: 10%;right: 18%; }
        .landing-page .chip-email     { bottom: 25%;left: 35%; }
        .landing-page .chip-cron      { top: 10%;  left: 42%; }

        /* ── LOGO SHOWCASE ── */
        .landing-page .logo-showcase {
          padding: 120px 0;
          text-align: center;
        }

        .landing-page .logo-showcase .section-sub {
          margin: 0 auto 64px;
        }

        .landing-page .logo-options {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
          margin-bottom: 40px;
        }

        .landing-page .logo-option {
          background: var(--surface);
          border: 2px solid var(--border);
          border-radius: var(--radius-xl);
          padding: 40px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          cursor: pointer;
          transition: all 200ms ease;
          position: relative;
        }

        .landing-page .logo-option:hover {
          border-color: var(--border-glow);
          transform: translateY(-4px);
        }

        .landing-page .logo-option.selected {
          border-color: var(--crimson);
          box-shadow: 0 0 0 1px rgba(255, 45, 107, 0.20), 0 8px 32px rgba(255, 45, 107, 0.15);
        }

        .landing-page .logo-option.selected::before {
          content: '\\2713 Selected';
          position: absolute;
          top: 12px;
          right: 12px;
          font-size: 10px;
          font-weight: 700;
          font-family: var(--font-mono);
          color: var(--crimson);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .landing-page .logo-opt-mark {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .landing-page .logo-opt-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.10em;
          font-family: var(--font-mono);
        }

        .landing-page .logo-opt-name {
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
          text-align: center;
        }

        /* ── METRICS ── */
        .landing-page .metrics {
          padding: 80px 0;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }

        .landing-page .metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 2px;
          background: var(--border);
          border-radius: var(--radius-xl);
          overflow: hidden;
        }

        .landing-page .metric-item {
          background: var(--surface);
          padding: 40px 32px;
          position: relative;
        }

        .landing-page .metric-num {
          font-family: var(--font-display);
          font-size: 48px;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: var(--text-primary);
          line-height: 1;
          margin-bottom: 8px;
        }

        .landing-page .metric-num .unit {
          font-size: 28px;
          color: var(--crimson);
        }

        .landing-page .metric-label {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .landing-page .metric-sub {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 4px;
          font-family: var(--font-mono);
        }

        /* ── USER GUIDE PREVIEW ── */
        .landing-page .guide-preview {
          padding: 120px 0;
          text-align: center;
          position: relative;
        }

        .landing-page .guide-preview-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-top: 48px;
          max-width: 900px;
          margin-left: auto;
          margin-right: auto;
        }

        .landing-page .guide-preview-card {
          padding: 28px 24px;
          border-radius: 12px;
          border: 1px solid rgba(248,240,242,.06);
          background: rgba(255,255,255,0.02);
          text-align: left;
          transition: border-color 0.25s, background 0.25s, transform 0.25s;
        }

        .landing-page .guide-preview-card:hover {
          border-color: rgba(255,45,107,0.2);
          background: rgba(255,255,255,0.04);
          transform: translateY(-2px);
        }

        .landing-page .guide-preview-icon {
          font-size: 28px;
          display: block;
          margin-bottom: 12px;
        }

        .landing-page .guide-preview-title {
          font-size: 16px;
          font-weight: 600;
          color: #fafafa;
          margin: 0 0 8px;
          letter-spacing: -0.01em;
        }

        .landing-page .guide-preview-desc {
          font-size: 13px;
          color: #94a3b8;
          line-height: 1.5;
          margin: 0;
        }

        @media (max-width: 768px) {
          .landing-page .guide-preview-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }
        }

        @media (min-width: 769px) and (max-width: 1024px) {
          .landing-page .guide-preview-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        /* ── CTA SECTION ── */
        .landing-page .cta-section {
          padding: 160px 0;
          text-align: center;
          position: relative;
          overflow: hidden;
        }

        .landing-page .cta-section::before {
          content: '';
          position: absolute;
          bottom: -100px;
          left: 50%;
          transform: translateX(-50%);
          width: 600px;
          height: 600px;
          background: radial-gradient(ellipse, rgba(255, 45, 107, 0.12) 0%, transparent 70%);
          pointer-events: none;
        }

        .landing-page .cta-section h2 {
          font-size: clamp(40px, 5vw, 72px);
          font-weight: 800;
          letter-spacing: -0.03em;
          color: var(--text-primary);
          margin-bottom: 20px;
        }

        .landing-page .cta-section p {
          font-size: 18px;
          color: var(--text-secondary);
          max-width: 480px;
          margin: 0 auto 40px;
        }

        .landing-page .cta-actions {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
        }

        /* ── FOOTER ── */
        .landing-page footer {
          border-top: 1px solid var(--border);
          padding: 40px 0;
        }

        .landing-page .footer-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .landing-page .footer-left {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .landing-page .footer-text {
          font-size: 13px;
          color: var(--text-muted);
        }

        .landing-page .footer-links {
          display: flex;
          gap: 24px;
        }

        .landing-page .footer-links a {
          font-size: 13px;
          color: var(--text-muted);
          text-decoration: none;
          transition: color 150ms ease;
        }
        .landing-page .footer-links a:hover { color: var(--text-secondary); }

        .landing-page .trifecto-logos {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .landing-page .trifecto-pip {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 800;
          color: white;
          opacity: 0.5;
          transition: opacity 150ms ease;
        }

        .landing-page .trifecto-pip:hover { opacity: 1; }
        .landing-page .trifecto-pip.lv     { background: #8B5CF6; }
        .landing-page .trifecto-pip.pulse  { background: #00F5D4; color: #080808; }
        .landing-page .trifecto-pip.ent    { background: var(--crimson); opacity: 1; }

        /* ── LOGO SHOWCASE — CONFIRMED DIRECTION ── */
        .landing-page .logo-confirmed-banner {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 10px 20px;
          background: rgba(255, 45, 107, 0.08);
          border: 1px solid rgba(255, 45, 107, 0.30);
          border-radius: 100px;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 500;
          color: var(--crimson);
          letter-spacing: 0.04em;
          margin-bottom: 48px;
        }

        .landing-page .logo-confirmed-icon {
          font-size: 14px;
          color: var(--amber);
        }

        .landing-page .logo-render-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 40px;
        }

        .landing-page .logo-render-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          overflow: hidden;
          transition: border-color 200ms ease, transform 200ms ease;
        }

        .landing-page .logo-render-card:hover {
          border-color: var(--border-glow);
          transform: translateY(-3px);
        }

        .landing-page .logo-render-card.featured {
          border-color: rgba(255, 45, 107, 0.35);
          box-shadow: 0 0 0 1px rgba(255, 45, 107, 0.10), 0 8px 32px rgba(255, 45, 107, 0.12);
        }

        .landing-page .logo-render-card img {
          width: 100%;
          aspect-ratio: 1;
          object-fit: cover;
          display: block;
        }

        .landing-page .logo-render-label {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--crimson);
          padding: 12px 16px 8px;
        }

        .landing-page .logo-render-caption {
          font-size: 12px;
          color: var(--text-muted);
          padding: 10px 16px 16px;
          line-height: 1.5;
        }

        .landing-page .logo-hero-preview {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: 24px;
          text-align: left;
        }

        .landing-page .logo-hero-preview img {
          width: 100%;
          border-radius: var(--radius-lg);
          display: block;
        }

        .landing-page .logo-light-bg {
          background: #fff;
          border-radius: 12px;
        }

        /* ── HERO WORKFLOW TRAIL ── */
        .landing-page .wf-trail-line {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 12;
        }

        .landing-page .wf-node-hero-trigger { top: 10%; left: 12%; }
        .landing-page .wf-node-hero-ai      { top: 22%; right: 10%; left: auto; }
        .landing-page .wf-node-hero-action  { bottom: 10%; right: 18%; left: auto; }

        /* ── TRIFECTO CENTERED SUB ── */
        .landing-page .trifecto-sub { margin: 0 auto; }

        /* ── DEEP FEATURE COPY VARIANTS ── */
        .landing-page .deep-section-title { font-size: 36px; }

        .landing-page .deep-grid-spaced { margin-bottom: 120px; }

        .landing-page .deep-body-text {
          color: var(--text-secondary);
          font-size: 16px;
          line-height: 1.75;
          margin-bottom: 8px;
        }

        /* ── AGENT FACTOR BAR WIDTHS ── */
        .landing-page .factor-w-90 { width: 90%; }
        .landing-page .factor-w-78 { width: 78%; }
        .landing-page .factor-w-95 { width: 95%; }
        .landing-page .factor-w-62 { width: 62%; }

        /* ── LOGO LIGHT CARD IMAGE ── */
        .landing-page .logo-img-light {
          background: #fff;
          border-radius: 12px;
        }

        /* ── LOGO HERO PREVIEW LABEL ── */
        .landing-page .logo-hero-label {
          text-align: left;
          margin-bottom: 20px;
        }

        .landing-page .logo-hero-caption {
          margin-top: 16px;
          padding: 0 0 8px;
        }

        /* ── CTA HIGHLIGHT ── */
        .landing-page .cta-highlight { color: var(--crimson); }

        /* ── FOOTER NAV LOGO LINK ── */
        .landing-page .footer-logo-link { text-decoration: none; }

        .landing-page .footer-logo-text { font-size: 16px; }

        /* ── FOOTER TRIFECTO LABEL ── */
        .landing-page .footer-trifecto-label {
          font-size: 11px;
          color: var(--text-muted);
          font-family: var(--font-mono);
          margin-right: 4px;
        }

        /* ── REDUCED MOTION ── */
        @media (prefers-reduced-motion: reduce) {
          .landing-page, .landing-page *,
          .landing-page *::before, .landing-page *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 1024px) {
          .landing-page .pillars-grid { grid-template-columns: 1fr 1fr; }
          .landing-page .trifecto-grid { grid-template-columns: 1fr; }
          .landing-page .hero-visual { display: none; }
          .landing-page .logo-options { grid-template-columns: 1fr 1fr; }
          .landing-page .metrics-grid { grid-template-columns: 1fr 1fr; }
          .landing-page .logo-render-grid { grid-template-columns: 1fr 1fr; }
        }

        @media (max-width: 768px) {
          .landing-page .nav-links { display: none; }
          .landing-page .pillars-grid { grid-template-columns: 1fr; }
          .landing-page .deep-grid { grid-template-columns: 1fr; }
          .landing-page .hero h1 { font-size: 42px; }
          .landing-page .hero-stats { flex-wrap: wrap; gap: 20px; }
          .landing-page .stat-divider { display: none; }
          .landing-page .metrics-grid { grid-template-columns: 1fr; }
          .landing-page .logo-options { grid-template-columns: 1fr; }
          .landing-page .integration-orbit { height: 280px; }
          .landing-page .chip-gcal, .landing-page .chip-cron, .landing-page .chip-email { display: none; }
          .landing-page .logo-render-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}
