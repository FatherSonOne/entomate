/**
 * AnimatedIcons — Succinct, animated SVG icon library for Entomate.
 *
 * Replaces all emoji usage with crisp vector icons that honour
 * the Void × Crimson design-system palette via CSS custom properties.
 *
 * Every icon accepts { size, className, style } and renders an inline <svg>.
 * Animations are defined in animated-icons.css (imported once in App or Layout).
 */
import React from 'react'

/* ── helper ────────────────────────────────────────────────────────────── */
const defaults = { size: 20, className: '', style: {} }
const svgProps = ({ size = 20, className = '', style = {}, ...rest }) => ({
  xmlns: 'http://www.w3.org/2000/svg',
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className: `ento-icon ${className}`.trim(),
  style,
  'aria-hidden': true,
  ...rest,
})

/* ═══════════════════════════════════════════════════════════════════════
   SENTIMENT ICONS  (replace 😊 😐 😟)
   ═══════════════════════════════════════════════════════════════════════ */

/** Positive sentiment — upward arc smile with gentle pulse */
export function SentimentPositive(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--pulse-gentle ${props.className || ''}`}>
      <circle cx="12" cy="12" r="10" stroke="var(--accent-secondary, #00F5D4)" />
      <path d="M8 14.5c1 1.8 3 2.5 4 2.5s3-.7 4-2.5" stroke="var(--accent-secondary, #00F5D4)" />
      <circle cx="9" cy="9.5" r="1" fill="var(--accent-secondary, #00F5D4)" stroke="none" />
      <circle cx="15" cy="9.5" r="1" fill="var(--accent-secondary, #00F5D4)" stroke="none" />
    </svg>
  )
}

/** Neutral sentiment — flat line mouth */
export function SentimentNeutral(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ${props.className || ''}`}>
      <circle cx="12" cy="12" r="10" stroke="var(--text-tertiary, #7A6870)" />
      <line x1="9" y1="15" x2="15" y2="15" stroke="var(--text-tertiary, #7A6870)" />
      <circle cx="9" cy="9.5" r="1" fill="var(--text-tertiary, #7A6870)" stroke="none" />
      <circle cx="15" cy="9.5" r="1" fill="var(--text-tertiary, #7A6870)" stroke="none" />
    </svg>
  )
}

/** Negative sentiment — downward arc frown with subtle shake */
export function SentimentNegative(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ${props.className || ''}`}>
      <circle cx="12" cy="12" r="10" stroke="var(--accent-primary, #FF2D6B)" />
      <path d="M8 16c1-1.8 3-2.5 4-2.5s3 .7 4 2.5" stroke="var(--accent-primary, #FF2D6B)" />
      <circle cx="9" cy="9.5" r="1" fill="var(--accent-primary, #FF2D6B)" stroke="none" />
      <circle cx="15" cy="9.5" r="1" fill="var(--accent-primary, #FF2D6B)" stroke="none" />
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   RISK / STATUS DOTS  (replace 🟢 🟡 🟠 🔴 ⚪)
   ═══════════════════════════════════════════════════════════════════════ */

function StatusDot({ color, glow, className = '', ...props }) {
  return (
    <svg {...svgProps({ ...props, className: `ento-icon ento-icon--status-dot ${className}` })}>
      <circle cx="12" cy="12" r="6" fill={color} stroke="none" />
      {glow && (
        <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth="1" opacity="0.35" className="ento-icon__ring" />
      )}
    </svg>
  )
}

export function StatusLow(props)      { return <StatusDot color="var(--accent-secondary, #00F5D4)" glow {...props} /> }
export function StatusMedium(props)   { return <StatusDot color="var(--accent-tertiary, #FFB800)" glow {...props} /> }
export function StatusHigh(props)     { return <StatusDot color="#FF8C00" glow {...props} /> }
export function StatusCritical(props) { return <StatusDot color="var(--accent-primary, #FF2D6B)" glow {...props} /> }
export function StatusUnknown(props)  { return <StatusDot color="var(--text-tertiary, #7A6870)" {...props} /> }

/* ═══════════════════════════════════════════════════════════════════════
   TRIGGER / ACTION ICONS  (replace 📝 🎙️ 📋 ✅ 💰 🕐)
   ═══════════════════════════════════════════════════════════════════════ */

/** Meeting processed — document with sparkle */
export function TriggerMeetingProcessed(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--sparkle ${props.className || ''}`}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" />
      <polyline points="14,2 14,8 20,8" stroke="currentColor" />
      <path d="M12 18v-6M9 15h6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

/** Meeting ended — microphone with fade ring */
export function TriggerMeetingEnded(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--pulse-ring ${props.className || ''}`}>
      <rect x="9" y="2" width="6" height="11" rx="3" stroke="currentColor" />
      <path d="M5 10a7 7 0 0014 0" stroke="currentColor" />
      <line x1="12" y1="17" x2="12" y2="22" stroke="currentColor" />
      <line x1="8" y1="22" x2="16" y2="22" stroke="currentColor" />
    </svg>
  )
}

/** Action item created — clipboard with check */
export function TriggerActionItem(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--slide-in ${props.className || ''}`}>
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" stroke="currentColor" />
      <rect x="8" y="2" width="8" height="4" rx="1" stroke="currentColor" />
      <path d="M9 14l2 2 4-4" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

/** Task completed — circle with animated checkmark */
export function TriggerTaskCompleted(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--check-draw ${props.className || ''}`}>
      <circle cx="12" cy="12" r="10" stroke="var(--accent-secondary, #00F5D4)" />
      <path d="M8 12.5l2.5 2.5 5-5" stroke="var(--accent-secondary, #00F5D4)" strokeWidth="2" className="ento-icon__check-path" />
    </svg>
  )
}

/** Deal created — currency circle with shine */
export function TriggerDealCreated(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--shine ${props.className || ''}`}>
      <circle cx="12" cy="12" r="10" stroke="var(--accent-tertiary, #FFB800)" />
      <path d="M12 6v12M9 8.5h4.5a2 2 0 010 4H9h5a2 2 0 010 4H9" stroke="var(--accent-tertiary, #FFB800)" strokeWidth="1.5" />
    </svg>
  )
}

/** Scheduled — clock with sweeping hand */
export function TriggerScheduled(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--tick ${props.className || ''}`}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" />
      <polyline points="12,6 12,12 16,14" stroke="currentColor" strokeWidth="2" className="ento-icon__clock-hand" />
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   GUIDE SECTION ICONS  (replace all 21 guide emojis)
   ═══════════════════════════════════════════════════════════════════════ */

/** 📖 Introduction / Book */
export function IconBook(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--float ${props.className || ''}`}>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" />
      <path d="M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15z" stroke="currentColor" />
      <line x1="9" y1="7" x2="16" y2="7" stroke="currentColor" strokeWidth="1.5" />
      <line x1="9" y1="11" x2="14" y2="11" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

/** 🚀 Getting started / Rocket */
export function IconRocket(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--launch ${props.className || ''}`}>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" stroke="currentColor" />
      <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11.95A22 22 0 0112 15z" stroke="currentColor" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 3 0 3 0" stroke="currentColor" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-3 0-3" stroke="currentColor" />
    </svg>
  )
}

/** 📊 Analytics / Bar chart */
export function IconBarChart(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--grow ${props.className || ''}`}>
      <rect x="3" y="12" width="4" height="9" rx="1" stroke="currentColor" className="ento-icon__bar ento-icon__bar--1" />
      <rect x="10" y="7" width="4" height="14" rx="1" stroke="currentColor" className="ento-icon__bar ento-icon__bar--2" />
      <rect x="17" y="3" width="4" height="18" rx="1" stroke="currentColor" className="ento-icon__bar ento-icon__bar--3" />
    </svg>
  )
}

/** 🎙️ Meetings / Microphone */
export function IconMicrophone(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--pulse-ring ${props.className || ''}`}>
      <rect x="9" y="2" width="6" height="11" rx="3" stroke="currentColor" />
      <path d="M5 10a7 7 0 0014 0" stroke="currentColor" />
      <line x1="12" y1="17" x2="12" y2="22" stroke="currentColor" />
      <line x1="8" y1="22" x2="16" y2="22" stroke="currentColor" />
    </svg>
  )
}

/** 📝 Notes / Memo */
export function IconMemo(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ${props.className || ''}`}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" />
      <polyline points="14,2 14,8 20,8" stroke="currentColor" />
      <line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" />
      <line x1="8" y1="17" x2="13" y2="17" stroke="currentColor" />
    </svg>
  )
}

/** 📅 Calendar */
export function IconCalendar(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ${props.className || ''}`}>
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" />
      <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" />
      <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" />
      <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" />
      <rect x="7" y="14" width="3" height="3" rx="0.5" fill="currentColor" stroke="none" opacity="0.5" />
    </svg>
  )
}

/** ✅ Verification / Check */
export function IconCheckCircle(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--check-draw ${props.className || ''}`}>
      <circle cx="12" cy="12" r="10" stroke="var(--accent-secondary, #00F5D4)" />
      <path d="M8 12.5l2.5 2.5 5-5" stroke="var(--accent-secondary, #00F5D4)" strokeWidth="2" className="ento-icon__check-path" />
    </svg>
  )
}

/** 📁 Folders / Files */
export function IconFolder(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ${props.className || ''}`}>
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z" stroke="currentColor" />
    </svg>
  )
}

/** 🎯 Goals / Target */
export function IconTarget(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--pulse-gentle ${props.className || ''}`}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" />
      <circle cx="12" cy="12" r="6" stroke="currentColor" />
      <circle cx="12" cy="12" r="2" fill="var(--accent-primary, #FF2D6B)" stroke="none" />
    </svg>
  )
}

/** 🔀 Workflows / Branch paths */
export function IconWorkflow(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--flow ${props.className || ''}`}>
      <circle cx="6" cy="6" r="3" stroke="currentColor" />
      <circle cx="18" cy="6" r="3" stroke="currentColor" />
      <circle cx="12" cy="18" r="3" stroke="currentColor" />
      <path d="M6 9v1c0 2 2 4 6 4s6-2 6-4V9" stroke="currentColor" />
      <line x1="12" y1="14" x2="12" y2="15" stroke="currentColor" />
    </svg>
  )
}

/** ⚡ Automations / Lightning */
export function IconLightning(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--flash ${props.className || ''}`}>
      <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" stroke="var(--accent-tertiary, #FFB800)" fill="none" />
    </svg>
  )
}

/** 🤖 AI Agents / Bot */
export function IconBot(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--pulse-gentle ${props.className || ''}`}>
      <rect x="3" y="8" width="18" height="12" rx="3" stroke="currentColor" />
      <circle cx="9" cy="14" r="1.5" fill="var(--accent-secondary, #00F5D4)" stroke="none" />
      <circle cx="15" cy="14" r="1.5" fill="var(--accent-secondary, #00F5D4)" stroke="none" />
      <line x1="12" y1="5" x2="12" y2="8" stroke="currentColor" />
      <circle cx="12" cy="4" r="1.5" stroke="currentColor" />
    </svg>
  )
}

/** 💬 Communication / Chat */
export function IconChat(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ${props.className || ''}`}>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke="currentColor" />
      <line x1="8" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="1.5" />
      <line x1="8" y1="12" x2="13" y2="12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

/** 🔍 Search */
export function IconSearch(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ${props.className || ''}`}>
      <circle cx="11" cy="11" r="8" stroke="currentColor" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

/** 📈 Trending / Growth */
export function IconTrending(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--draw-line ${props.className || ''}`}>
      <polyline points="3,17 9,11 13,15 21,7" stroke="var(--accent-secondary, #00F5D4)" strokeWidth="2" className="ento-icon__trend-line" />
      <polyline points="17,7 21,7 21,11" stroke="var(--accent-secondary, #00F5D4)" strokeWidth="2" />
    </svg>
  )
}

/** 📄 Document */
export function IconDocument(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ${props.className || ''}`}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" />
      <polyline points="14,2 14,8 20,8" stroke="currentColor" />
    </svg>
  )
}

/** 🌐 Ecosystem / Globe */
export function IconGlobe(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--spin-slow ${props.className || ''}`}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" />
      <ellipse cx="12" cy="12" rx="4" ry="10" stroke="currentColor" />
      <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" />
    </svg>
  )
}

/** 🧠 Intelligence / Brain */
export function IconBrain(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--pulse-gentle ${props.className || ''}`}>
      <path d="M12 2C9.5 2 7 4 7 7c-2 0-4 2-4 4.5S5 16 7 16c0 3 2.5 6 5 6s5-3 5-6c2 0 4-2 4-4.5S19 7 17 7c0-3-2.5-5-5-5z" stroke="currentColor" />
      <path d="M12 2v20" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <path d="M7 10h10" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <path d="M8 15h8" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    </svg>
  )
}

/** ⚙️ Settings / Gear */
export function IconGear(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--spin-slow-hover ${props.className || ''}`}>
      <circle cx="12" cy="12" r="3" stroke="currentColor" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1.08z" stroke="currentColor" />
    </svg>
  )
}

/** ⌨️ Keyboard shortcuts */
export function IconKeyboard(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ${props.className || ''}`}>
      <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" />
      <line x1="6" y1="10" x2="6" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="10" y1="10" x2="10" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="10" x2="18" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="8" y1="15" x2="16" y2="15" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

/** 🔧 Troubleshooting / Wrench */
export function IconWrench(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ${props.className || ''}`}>
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke="currentColor" />
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   MEETING PROFILE ICONS  (replace 🏛 🤝 📋 ⚡ 🎯 🏗 📑)
   ═══════════════════════════════════════════════════════════════════════ */

/** 🏛 Board Meeting — classical pillared building */
export function ProfileBoardMeeting(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--float ${props.className || ''}`}>
      <path d="M3 21h18" stroke="currentColor" />
      <path d="M5 21V11" stroke="currentColor" />
      <path d="M19 21V11" stroke="currentColor" />
      <path d="M9 21V11" stroke="currentColor" />
      <path d="M15 21V11" stroke="currentColor" />
      <path d="M3 11l9-7 9 7" stroke="var(--accent-primary, #FF2D6B)" strokeWidth="2" />
      <rect x="6" y="8" width="12" height="1" rx="0.5" fill="currentColor" stroke="none" opacity="0.3" />
    </svg>
  )
}

/** 🤝 Client Check-In — handshake */
export function ProfileClientCheckIn(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--handshake ${props.className || ''}`}>
      <path d="M7 11l-4 4 3 3 4-4" stroke="var(--accent-tertiary, #FFB800)" />
      <path d="M17 11l4 4-3 3-4-4" stroke="var(--accent-secondary, #00F5D4)" />
      <path d="M12 15l-3 3" stroke="currentColor" />
      <path d="M9 7l3-3 3 3" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="10" r="3" stroke="currentColor" />
      <path d="M7 18h10" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
    </svg>
  )
}

/** 📋 Grant Specialist — clipboard with checkmarks and dollar sign */
export function ProfileGrantSpecialist(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--slide-in ${props.className || ''}`}>
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" stroke="currentColor" />
      <rect x="8" y="2" width="8" height="4" rx="1" stroke="currentColor" />
      <path d="M12 10v6" stroke="var(--accent-secondary, #00F5D4)" strokeWidth="1.5" />
      <path d="M10 12.5h3a1.5 1.5 0 010 3h-3" stroke="var(--accent-secondary, #00F5D4)" strokeWidth="1.5" />
      <path d="M14 11.5h-3a1.5 1.5 0 010-3h3" stroke="var(--accent-secondary, #00F5D4)" strokeWidth="1.5" opacity="0.6" />
    </svg>
  )
}

/** 🏗 Strategic Planning — blueprint grid with nodes */
export function ProfileStrategicPlanning(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--blueprint ${props.className || ''}`}>
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" />
      <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" opacity="0.3" />
      <line x1="3" y1="15" x2="21" y2="15" stroke="currentColor" opacity="0.3" />
      <line x1="9" y1="3" x2="9" y2="21" stroke="currentColor" opacity="0.3" />
      <line x1="15" y1="3" x2="15" y2="21" stroke="currentColor" opacity="0.3" />
      <circle cx="9" cy="9" r="2" fill="var(--accent-primary, #FF2D6B)" stroke="none" className="ento-icon__node ento-icon__node--1" />
      <circle cx="15" cy="9" r="2" fill="var(--accent-tertiary, #FFB800)" stroke="none" className="ento-icon__node ento-icon__node--2" />
      <circle cx="15" cy="15" r="2" fill="var(--accent-secondary, #00F5D4)" stroke="none" className="ento-icon__node ento-icon__node--3" />
      <path d="M9 9l6 0M15 9v6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
    </svg>
  )
}

/** 📑 Vendor Negotiation — two overlapping documents with arrow */
export function ProfileVendorNegotiation(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--negotiate ${props.className || ''}`}>
      <path d="M7 3H5a2 2 0 00-2 2v10a2 2 0 002 2h2" stroke="currentColor" opacity="0.5" />
      <path d="M14 2H8a1 1 0 00-1 1v16a1 1 0 001 1h12a1 1 0 001-1V8l-7-6z" stroke="currentColor" />
      <polyline points="14,2 14,8 21,8" stroke="currentColor" />
      <path d="M10 13l2 2 4-4" stroke="var(--accent-secondary, #00F5D4)" strokeWidth="2" className="ento-icon__check-path" />
    </svg>
  )
}

/** 🎯 Sales Discovery — crosshair target with pulsing center */
export function ProfileSalesDiscovery(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--radar ${props.className || ''}`}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" opacity="0.3" />
      <circle cx="12" cy="12" r="6" stroke="currentColor" opacity="0.5" />
      <circle cx="12" cy="12" r="2" fill="var(--accent-primary, #FF2D6B)" stroke="none" className="ento-icon__radar-dot" />
      <line x1="12" y1="2" x2="12" y2="6" stroke="currentColor" />
      <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" />
      <line x1="2" y1="12" x2="6" y2="12" stroke="currentColor" />
      <line x1="18" y1="12" x2="22" y2="12" stroke="currentColor" />
    </svg>
  )
}

/** ⚡ Internal Standup — lightning bolt with people */
export function ProfileInternalStandup(props) {
  return (
    <svg {...svgProps(props)} className={`ento-icon ento-icon--flash ${props.className || ''}`}>
      <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" stroke="var(--accent-tertiary, #FFB800)" fill="none" />
      <circle cx="6" cy="20" r="2" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <circle cx="18" cy="20" r="2" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
    </svg>
  )
}

/* ── Emoji → Icon mapping for intelligence profiles ─────────────────── */

const emojiToIconMap = {
  '🏛': ProfileBoardMeeting,
  '🏛️': ProfileBoardMeeting,
  '🤝': ProfileClientCheckIn,
  '📋': ProfileGrantSpecialist,
  '⚡': ProfileInternalStandup,
  '⚡️': ProfileInternalStandup,
  '🎯': ProfileSalesDiscovery,
  '🏗': ProfileStrategicPlanning,
  '🏗️': ProfileStrategicPlanning,
  '📑': ProfileVendorNegotiation,
  // Fallbacks for common profile emojis
  '🤖': IconBot,
  '🧠': IconBrain,
  '📊': IconBarChart,
  '🎙': IconMicrophone,
  '🎙️': IconMicrophone,
  '📅': IconCalendar,
  '🔀': IconWorkflow,
  '💬': IconChat,
  '🔍': IconSearch,
  '📈': IconTrending,
  '🌐': IconGlobe,
  '⚙': IconGear,
  '⚙️': IconGear,
  '🚀': IconRocket,
}

/**
 * Renders the appropriate animated SVG icon for an intelligence profile emoji.
 * Falls back to the raw emoji string if no mapping exists.
 *   <ProfileIcon emoji="🏛" size={24} />
 */
export function ProfileIcon({ emoji, size = 20, className = '', style = {}, fallbackClassName = '' }) {
  const Icon = emojiToIconMap[emoji]
  if (Icon) return <Icon size={size} className={className} style={style} />
  return <span className={fallbackClassName} style={{ fontSize: size * 0.9, lineHeight: 1, ...style }}>{emoji}</span>
}

/* ═══════════════════════════════════════════════════════════════════════
   ICON REGISTRY  — name → component map for dynamic lookups
   ═══════════════════════════════════════════════════════════════════════ */

export const iconRegistry = {
  // Sentiment
  'sentiment-positive': SentimentPositive,
  'sentiment-neutral': SentimentNeutral,
  'sentiment-negative': SentimentNegative,

  // Risk / status
  'status-low': StatusLow,
  'status-medium': StatusMedium,
  'status-high': StatusHigh,
  'status-critical': StatusCritical,
  'status-unknown': StatusUnknown,

  // Triggers
  'trigger-meeting-processed': TriggerMeetingProcessed,
  'trigger-meeting-ended': TriggerMeetingEnded,
  'trigger-action-item': TriggerActionItem,
  'trigger-task-completed': TriggerTaskCompleted,
  'trigger-deal-created': TriggerDealCreated,
  'trigger-scheduled': TriggerScheduled,

  // Guide sections
  'book': IconBook,
  'rocket': IconRocket,
  'bar-chart': IconBarChart,
  'microphone': IconMicrophone,
  'memo': IconMemo,
  'calendar': IconCalendar,
  'check-circle': IconCheckCircle,
  'folder': IconFolder,
  'target': IconTarget,
  'workflow': IconWorkflow,
  'lightning': IconLightning,
  'bot': IconBot,
  'chat': IconChat,
  'search': IconSearch,
  'trending': IconTrending,
  'document': IconDocument,
  'globe': IconGlobe,
  'brain': IconBrain,
  'gear': IconGear,
  'keyboard': IconKeyboard,
  'wrench': IconWrench,

  // Meeting profiles
  'profile-board-meeting': ProfileBoardMeeting,
  'profile-client-checkin': ProfileClientCheckIn,
  'profile-grant-specialist': ProfileGrantSpecialist,
  'profile-strategic-planning': ProfileStrategicPlanning,
  'profile-vendor-negotiation': ProfileVendorNegotiation,
  'profile-sales-discovery': ProfileSalesDiscovery,
  'profile-internal-standup': ProfileInternalStandup,
}

/**
 * Dynamic icon renderer — looks up by registry key.
 *   <AnimatedIcon name="rocket" size={24} />
 */
export default function AnimatedIcon({ name, ...props }) {
  const Icon = iconRegistry[name]
  if (!Icon) return null
  return <Icon {...props} />
}
