import React, { useEffect, useRef } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/* ════════════════════════════════════════════════════════
   ANIMATED SVG ICONS — replace every emoji on the page
   Each icon has idle animation + CSS hover amplification
   ════════════════════════════════════════════════════════ */

// ── Pillar & Section Icons ──

const IconMicrophone = ({ size = 20 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="12" y="4" width="8" height="16" rx="4" fill="none" stroke="var(--crimson)" strokeWidth="2">
      <animate attributeName="opacity" values="1;0.6;1" dur="2s" repeatCount="indefinite"/>
    </rect>
    <path d="M8 18 C8 24 12 26 16 26 C20 26 24 24 24 18" stroke="var(--crimson)" strokeWidth="2" strokeLinecap="round" fill="none">
      <animate attributeName="d" values="M8 18 C8 24 12 26 16 26 C20 26 24 24 24 18;M8 16 C8 24 12 27 16 27 C20 27 24 24 24 16;M8 18 C8 24 12 26 16 26 C20 26 24 24 24 18" dur="3s" repeatCount="indefinite"/>
    </path>
    <line x1="16" y1="26" x2="16" y2="30" stroke="var(--crimson)" strokeWidth="2" strokeLinecap="round"/>
    {/* Sound waves */}
    <path d="M26 10 Q30 16 26 22" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0">
      <animate attributeName="opacity" values="0;0.7;0" dur="1.5s" repeatCount="indefinite"/>
    </path>
    <path d="M28 8 Q34 16 28 24" stroke="var(--amber)" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0">
      <animate attributeName="opacity" values="0;0.4;0" dur="1.5s" begin="0.3s" repeatCount="indefinite"/>
    </path>
  </svg>
)

const IconWorkflow = ({ size = 20 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Lightning bolt */}
    <polygon points="18,2 10,18 16,18 14,30 22,14 16,14" fill="none" stroke="var(--mint)" strokeWidth="1.8" strokeLinejoin="round">
      <animate attributeName="stroke" values="var(--mint);var(--amber);var(--mint)" dur="3s" repeatCount="indefinite"/>
    </polygon>
    {/* Energy spark at tip */}
    <circle cx="14" cy="30" r="1" fill="var(--mint)" opacity="0">
      <animate attributeName="opacity" values="0;1;0" dur="1.5s" repeatCount="indefinite"/>
      <animate attributeName="r" values="1;3;1" dur="1.5s" repeatCount="indefinite"/>
    </circle>
    {/* Surrounding pulse ring */}
    <circle cx="16" cy="16" r="14" fill="none" stroke="var(--mint)" strokeWidth="0.5" opacity="0" strokeDasharray="4 4">
      <animate attributeName="opacity" values="0;0.4;0" dur="2.5s" repeatCount="indefinite"/>
      <animate attributeName="r" values="10;15" dur="2.5s" repeatCount="indefinite"/>
    </circle>
  </svg>
)

const IconAgents = ({ size = 20 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Four-pointed star / sparkle */}
    <path d="M16 2 L18 12 L28 16 L18 20 L16 30 L14 20 L4 16 L14 12 Z" fill="none" stroke="var(--amber)" strokeWidth="1.5" strokeLinejoin="round">
      <animateTransform attributeName="transform" type="rotate" values="0 16 16;360 16 16" dur="12s" repeatCount="indefinite"/>
    </path>
    {/* Inner sparkle */}
    <path d="M16 8 L17 14 L22 16 L17 18 L16 24 L15 18 L10 16 L15 14 Z" fill="var(--amber)" opacity="0.4">
      <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2s" repeatCount="indefinite"/>
    </path>
    {/* Orbiting dots */}
    <circle cx="16" cy="4" r="1.5" fill="var(--crimson)">
      <animateTransform attributeName="transform" type="rotate" values="0 16 16;360 16 16" dur="4s" repeatCount="indefinite"/>
    </circle>
    <circle cx="16" cy="4" r="1.5" fill="var(--mint)">
      <animateTransform attributeName="transform" type="rotate" values="120 16 16;480 16 16" dur="4s" repeatCount="indefinite"/>
    </circle>
    <circle cx="16" cy="4" r="1.5" fill="var(--amber)">
      <animateTransform attributeName="transform" type="rotate" values="240 16 16;600 16 16" dur="4s" repeatCount="indefinite"/>
    </circle>
  </svg>
)

const IconTasks = ({ size = 20 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Checkbox */}
    <rect x="4" y="4" width="24" height="24" rx="5" stroke="var(--crimson)" strokeWidth="2" fill="none"/>
    {/* Animated checkmark */}
    <path d="M9 16 L14 21 L23 11" stroke="var(--mint)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray="24" strokeDashoffset="24">
      <animate attributeName="stroke-dashoffset" values="24;0;0;24" dur="3s" repeatCount="indefinite"/>
    </path>
    {/* Celebration spark */}
    <circle cx="24" cy="8" r="0" fill="var(--amber)">
      <animate attributeName="r" values="0;0;3;0" dur="3s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0;0;1;0" dur="3s" repeatCount="indefinite"/>
    </circle>
  </svg>
)

const IconAnalytics = ({ size = 20 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Bar chart bars with staggered growth */}
    <rect x="4" y="20" width="5" height="0" rx="1" fill="var(--crimson)">
      <animate attributeName="height" values="0;10;10;0" dur="3s" repeatCount="indefinite"/>
      <animate attributeName="y" values="28;18;18;28" dur="3s" repeatCount="indefinite"/>
    </rect>
    <rect x="11" y="20" width="5" height="0" rx="1" fill="var(--mint)">
      <animate attributeName="height" values="0;18;18;0" dur="3s" begin="0.2s" repeatCount="indefinite"/>
      <animate attributeName="y" values="28;10;10;28" dur="3s" begin="0.2s" repeatCount="indefinite"/>
    </rect>
    <rect x="18" y="20" width="5" height="0" rx="1" fill="var(--amber)">
      <animate attributeName="height" values="0;14;14;0" dur="3s" begin="0.4s" repeatCount="indefinite"/>
      <animate attributeName="y" values="28;14;14;28" dur="3s" begin="0.4s" repeatCount="indefinite"/>
    </rect>
    <rect x="25" y="20" width="5" height="0" rx="1" fill="var(--crimson)" opacity="0.7">
      <animate attributeName="height" values="0;22;22;0" dur="3s" begin="0.6s" repeatCount="indefinite"/>
      <animate attributeName="y" values="28;6;6;28" dur="3s" begin="0.6s" repeatCount="indefinite"/>
    </rect>
    {/* Trend line */}
    <polyline points="6,22 14,14 20,18 28,6" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round" fill="none" strokeDasharray="40" strokeDashoffset="40">
      <animate attributeName="stroke-dashoffset" values="40;0;0;40" dur="3s" begin="0.8s" repeatCount="indefinite"/>
    </polyline>
  </svg>
)

const IconIntegrations = ({ size = 20 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Chain link */}
    <path d="M12 16 L6 16 A5 5 0 0 1 6 6 L12 6" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <path d="M20 6 L26 6 A5 5 0 0 1 26 16 L20 16" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <line x1="11" y1="11" x2="21" y2="11" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round">
      <animate attributeName="x2" values="21;23;21" dur="2s" repeatCount="indefinite"/>
    </line>
    {/* Data flow dots */}
    <circle r="1.5" fill="var(--mint)">
      <animateMotion dur="2s" repeatCount="indefinite" path="M11,11 L21,11"/>
    </circle>
    <circle r="1.5" fill="var(--crimson)">
      <animateMotion dur="2s" begin="0.7s" repeatCount="indefinite" path="M11,11 L21,11"/>
    </circle>
    {/* Connection pulse */}
    <circle cx="16" cy="22" r="2" fill="none" stroke="var(--amber)" strokeWidth="1" opacity="0">
      <animate attributeName="r" values="2;8;2" dur="2.5s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.6;0;0.6" dur="2.5s" repeatCount="indefinite"/>
    </circle>
  </svg>
)

const IconRobot = ({ size = 20 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Head */}
    <rect x="6" y="10" width="20" height="16" rx="4" stroke="var(--crimson)" strokeWidth="1.8" fill="none"/>
    {/* Antenna */}
    <line x1="16" y1="10" x2="16" y2="4" stroke="var(--crimson)" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="16" cy="3" r="2" fill="var(--amber)">
      <animate attributeName="r" values="2;3;2" dur="1.5s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="1;0.5;1" dur="1.5s" repeatCount="indefinite"/>
    </circle>
    {/* Eyes */}
    <circle cx="12" cy="18" r="2.5" fill="var(--mint)">
      <animate attributeName="fill" values="var(--mint);var(--amber);var(--mint)" dur="4s" repeatCount="indefinite"/>
    </circle>
    <circle cx="20" cy="18" r="2.5" fill="var(--mint)">
      <animate attributeName="fill" values="var(--mint);var(--amber);var(--mint)" dur="4s" begin="0.2s" repeatCount="indefinite"/>
    </circle>
    {/* Mouth */}
    <rect x="12" y="22" width="8" height="2" rx="1" fill="var(--crimson)" opacity="0.5"/>
    {/* Scan effect */}
    <line x1="6" y1="14" x2="26" y2="14" stroke="var(--mint)" strokeWidth="0.5" opacity="0">
      <animate attributeName="y1" values="10;26;10" dur="3s" repeatCount="indefinite"/>
      <animate attributeName="y2" values="10;26;10" dur="3s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0;0.5;0" dur="3s" repeatCount="indefinite"/>
    </line>
  </svg>
)

const IconReports = ({ size = 20 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Upward trend arrow */}
    <polyline points="4,26 12,16 18,20 28,6" stroke="var(--mint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray="50" strokeDashoffset="50">
      <animate attributeName="stroke-dashoffset" values="50;0" dur="2s" fill="freeze" repeatCount="indefinite"/>
    </polyline>
    {/* Arrow head */}
    <polygon points="28,6 22,6 28,12" fill="var(--mint)" opacity="0">
      <animate attributeName="opacity" values="0;0;1" dur="2s" repeatCount="indefinite"/>
    </polygon>
    {/* Sparkle at peak */}
    <circle cx="28" cy="6" r="0" fill="var(--amber)">
      <animate attributeName="r" values="0;0;4;0" dur="2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0;0;0.8;0" dur="2s" repeatCount="indefinite"/>
    </circle>
    {/* Grid lines */}
    <line x1="4" y1="28" x2="28" y2="28" stroke="var(--text-muted)" strokeWidth="0.5" opacity="0.3"/>
    <line x1="4" y1="4" x2="4" y2="28" stroke="var(--text-muted)" strokeWidth="0.5" opacity="0.3"/>
  </svg>
)

// ── Deep Feature Icons ──

const IconTarget = ({ size = 16 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="13" stroke="var(--crimson)" strokeWidth="1.5" fill="none" opacity="0.3"/>
    <circle cx="16" cy="16" r="9" stroke="var(--crimson)" strokeWidth="1.5" fill="none" opacity="0.5"/>
    <circle cx="16" cy="16" r="5" stroke="var(--crimson)" strokeWidth="1.5" fill="none" opacity="0.8"/>
    <circle cx="16" cy="16" r="2" fill="var(--crimson)">
      <animate attributeName="r" values="2;3;2" dur="1.5s" repeatCount="indefinite"/>
    </circle>
    {/* Crosshairs */}
    <line x1="16" y1="1" x2="16" y2="6" stroke="var(--crimson)" strokeWidth="1" opacity="0.4"/>
    <line x1="16" y1="26" x2="16" y2="31" stroke="var(--crimson)" strokeWidth="1" opacity="0.4"/>
    <line x1="1" y1="16" x2="6" y2="16" stroke="var(--crimson)" strokeWidth="1" opacity="0.4"/>
    <line x1="26" y1="16" x2="31" y2="16" stroke="var(--crimson)" strokeWidth="1" opacity="0.4"/>
    {/* Pulse ring */}
    <circle cx="16" cy="16" r="2" fill="none" stroke="var(--amber)" strokeWidth="1" opacity="0">
      <animate attributeName="r" values="2;14" dur="2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.8;0" dur="2s" repeatCount="indefinite"/>
    </circle>
  </svg>
)

const IconPerson = ({ size = 16 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="10" r="6" stroke="var(--mint)" strokeWidth="1.8" fill="none"/>
    <path d="M4 28 C4 22 9 18 16 18 C23 18 28 22 28 28" stroke="var(--mint)" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
    {/* Assignment arrow */}
    <path d="M24 6 L28 10 L24 14" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0">
      <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite"/>
    </path>
    <line x1="18" y1="10" x2="28" y2="10" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round" opacity="0">
      <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite"/>
    </line>
  </svg>
)

const IconCalendar = ({ size = 16 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="6" width="24" height="22" rx="3" stroke="var(--amber)" strokeWidth="1.8" fill="none"/>
    <line x1="4" y1="13" x2="28" y2="13" stroke="var(--amber)" strokeWidth="1.5"/>
    <line x1="10" y1="4" x2="10" y2="9" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round"/>
    <line x1="22" y1="4" x2="22" y2="9" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round"/>
    {/* Date dot */}
    <circle cx="16" cy="21" r="2.5" fill="var(--crimson)">
      <animate attributeName="r" values="2.5;3.5;2.5" dur="2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="1;0.6;1" dur="2s" repeatCount="indefinite"/>
    </circle>
  </svg>
)

const IconFeedback = ({ size = 16 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Circular arrows */}
    <path d="M26 16 A10 10 0 0 1 6 16" stroke="var(--mint)" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
    <path d="M6 16 A10 10 0 0 1 26 16" stroke="var(--crimson)" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
    {/* Arrow heads */}
    <polygon points="26,16 22,12 22,20" fill="var(--mint)"/>
    <polygon points="6,16 10,12 10,20" fill="var(--crimson)"/>
    {/* Spinning */}
    <animateTransform attributeName="transform" type="rotate" values="0 16 16;360 16 16" dur="6s" repeatCount="indefinite"/>
  </svg>
)

const IconDNA = ({ size = 16 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Double helix strands */}
    <path d="M8 2 Q16 8 24 8 Q16 14 8 14 Q16 20 24 20 Q16 26 8 26 Q16 32 24 32" stroke="var(--crimson)" strokeWidth="1.5" fill="none" strokeLinecap="round">
      <animate attributeName="d" values="M8 2 Q16 8 24 8 Q16 14 8 14 Q16 20 24 20 Q16 26 8 26 Q16 32 24 32;M8 2 Q16 6 24 2 Q16 8 8 8 Q16 14 24 14 Q16 20 8 20 Q16 26 24 26;M8 2 Q16 8 24 8 Q16 14 8 14 Q16 20 24 20 Q16 26 8 26 Q16 32 24 32" dur="4s" repeatCount="indefinite"/>
    </path>
    <path d="M24 2 Q16 8 8 8 Q16 14 24 14 Q16 20 8 20 Q16 26 24 26 Q16 32 8 32" stroke="var(--mint)" strokeWidth="1.5" fill="none" strokeLinecap="round">
      <animate attributeName="d" values="M24 2 Q16 8 8 8 Q16 14 24 14 Q16 20 8 20 Q16 26 24 26 Q16 32 8 32;M24 2 Q16 6 8 2 Q16 8 24 8 Q16 14 8 14 Q16 20 24 20 Q16 26 8 26;M24 2 Q16 8 8 8 Q16 14 24 14 Q16 20 8 20 Q16 26 24 26 Q16 32 8 32" dur="4s" repeatCount="indefinite"/>
    </path>
    {/* Cross rungs */}
    <line x1="12" y1="8" x2="20" y2="8" stroke="var(--amber)" strokeWidth="1" opacity="0.5"/>
    <line x1="12" y1="14" x2="20" y2="14" stroke="var(--amber)" strokeWidth="1" opacity="0.5"/>
    <line x1="12" y1="20" x2="20" y2="20" stroke="var(--amber)" strokeWidth="1" opacity="0.5"/>
    <line x1="12" y1="26" x2="20" y2="26" stroke="var(--amber)" strokeWidth="1" opacity="0.5"/>
  </svg>
)

// ── Integration Chip Icons ──

const IconSlack = ({ size = 16 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Slack hash shape */}
    <rect x="6" y="12" width="8" height="3" rx="1.5" fill="#E01E5A"/>
    <rect x="18" y="12" width="8" height="3" rx="1.5" fill="#36C5F0"/>
    <rect x="6" y="18" width="8" height="3" rx="1.5" fill="#2EB67D"/>
    <rect x="18" y="18" width="8" height="3" rx="1.5" fill="#ECB22E"/>
    <rect x="12" y="6" width="3" height="8" rx="1.5" fill="#36C5F0"/>
    <rect x="17" y="6" width="3" height="8" rx="1.5" fill="#E01E5A"/>
    <rect x="12" y="18" width="3" height="8" rx="1.5" fill="#ECB22E"/>
    <rect x="17" y="18" width="3" height="8" rx="1.5" fill="#2EB67D"/>
    {/* Pulse glow */}
    <rect x="6" y="6" width="20" height="20" rx="4" fill="none" stroke="#E01E5A" strokeWidth="0.5" opacity="0">
      <animate attributeName="opacity" values="0;0.4;0" dur="3s" repeatCount="indefinite"/>
    </rect>
  </svg>
)

const IconSalesforce = ({ size = 16 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Cloud shape */}
    <path d="M8 22 A6 6 0 0 1 8 12 A8 8 0 0 1 24 12 A6 6 0 0 1 24 22 Z" fill="#00A1E0" opacity="0.9">
      <animate attributeName="opacity" values="0.9;0.6;0.9" dur="3s" repeatCount="indefinite"/>
    </path>
    <text x="16" y="19" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="var(--font-display)">SF</text>
  </svg>
)

const IconHubSpot = ({ size = 16 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Sprocket / gear shape */}
    <circle cx="16" cy="16" r="5" stroke="#FF7A59" strokeWidth="2" fill="none">
      <animateTransform attributeName="transform" type="rotate" values="0 16 16;360 16 16" dur="8s" repeatCount="indefinite"/>
    </circle>
    <circle cx="16" cy="16" r="2" fill="#FF7A59"/>
    {/* Spokes */}
    <line x1="16" y1="5" x2="16" y2="9" stroke="#FF7A59" strokeWidth="2" strokeLinecap="round">
      <animateTransform attributeName="transform" type="rotate" values="0 16 16;360 16 16" dur="8s" repeatCount="indefinite"/>
    </line>
    <line x1="16" y1="23" x2="16" y2="27" stroke="#FF7A59" strokeWidth="2" strokeLinecap="round">
      <animateTransform attributeName="transform" type="rotate" values="0 16 16;360 16 16" dur="8s" repeatCount="indefinite"/>
    </line>
    <line x1="5" y1="16" x2="9" y2="16" stroke="#FF7A59" strokeWidth="2" strokeLinecap="round">
      <animateTransform attributeName="transform" type="rotate" values="0 16 16;360 16 16" dur="8s" repeatCount="indefinite"/>
    </line>
    <line x1="23" y1="16" x2="27" y2="16" stroke="#FF7A59" strokeWidth="2" strokeLinecap="round">
      <animateTransform attributeName="transform" type="rotate" values="0 16 16;360 16 16" dur="8s" repeatCount="indefinite"/>
    </line>
  </svg>
)

const IconGoogleCal = ({ size = 16 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="6" width="24" height="22" rx="3" stroke="#4285F4" strokeWidth="1.5" fill="none"/>
    <line x1="4" y1="13" x2="28" y2="13" stroke="#4285F4" strokeWidth="1"/>
    <line x1="10" y1="4" x2="10" y2="9" stroke="#EA4335" strokeWidth="2" strokeLinecap="round"/>
    <line x1="22" y1="4" x2="22" y2="9" stroke="#EA4335" strokeWidth="2" strokeLinecap="round"/>
    <rect x="9" y="16" width="4" height="4" rx="1" fill="#34A853" opacity="0.8"/>
    <rect x="15" y="16" width="4" height="4" rx="1" fill="#FBBC05" opacity="0.8"/>
    <rect x="21" y="16" width="4" height="4" rx="1" fill="#EA4335" opacity="0.8">
      <animate attributeName="opacity" values="0.8;0.4;0.8" dur="2s" repeatCount="indefinite"/>
    </rect>
  </svg>
)

const IconWebhook = ({ size = 16 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Three interlocking hooks */}
    <path d="M16 10 L16 18 A5 5 0 0 0 21 23" stroke="var(--crimson)" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <path d="M22 14 L16 18 L10 14" stroke="var(--mint)" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <circle cx="16" cy="8" r="3" fill="var(--crimson)" opacity="0.7"/>
    <circle cx="10" cy="24" r="3" fill="var(--mint)" opacity="0.7"/>
    <circle cx="22" cy="24" r="3" fill="var(--amber)" opacity="0.7"/>
    {/* Data pulse */}
    <circle cx="16" cy="18" r="1" fill="var(--amber)">
      <animate attributeName="r" values="1;6;1" dur="2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite"/>
    </circle>
  </svg>
)

const IconTeams = ({ size = 16 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="8" width="18" height="16" rx="2" fill="#5B5FC7" opacity="0.9"/>
    <text x="13" y="19" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="var(--font-display)">T</text>
    <circle cx="24" cy="10" r="5" fill="#5B5FC7" opacity="0.6"/>
    <rect x="20" y="16" width="8" height="8" rx="2" fill="#5B5FC7" opacity="0.7"/>
  </svg>
)

const IconEmail = ({ size = 16 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="7" width="26" height="18" rx="3" stroke="var(--crimson)" strokeWidth="1.8" fill="none"/>
    <path d="M3 10 L16 19 L29 10" stroke="var(--crimson)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    {/* Send animation — flap closing */}
    <path d="M3 10 L16 19 L29 10" stroke="var(--amber)" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0">
      <animate attributeName="opacity" values="0;0.6;0" dur="3s" repeatCount="indefinite"/>
      <animate attributeName="d" values="M3 10 L16 19 L29 10;M3 7 L16 14 L29 7;M3 10 L16 19 L29 10" dur="3s" repeatCount="indefinite"/>
    </path>
  </svg>
)

const IconCron = ({ size = 16 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="13" stroke="var(--mint)" strokeWidth="1.8" fill="none"/>
    {/* Clock hands */}
    <line x1="16" y1="16" x2="16" y2="8" stroke="var(--mint)" strokeWidth="2" strokeLinecap="round">
      <animateTransform attributeName="transform" type="rotate" values="0 16 16;360 16 16" dur="6s" repeatCount="indefinite"/>
    </line>
    <line x1="16" y1="16" x2="22" y2="16" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round">
      <animateTransform attributeName="transform" type="rotate" values="0 16 16;360 16 16" dur="60s" repeatCount="indefinite"/>
    </line>
    <circle cx="16" cy="16" r="2" fill="var(--mint)"/>
    {/* Tick marks */}
    <line x1="16" y1="3" x2="16" y2="5" stroke="var(--mint)" strokeWidth="1" opacity="0.5"/>
    <line x1="16" y1="27" x2="16" y2="29" stroke="var(--mint)" strokeWidth="1" opacity="0.5"/>
    <line x1="3" y1="16" x2="5" y2="16" stroke="var(--mint)" strokeWidth="1" opacity="0.5"/>
    <line x1="27" y1="16" x2="29" y2="16" stroke="var(--mint)" strokeWidth="1" opacity="0.5"/>
  </svg>
)

// ── Adaptive Section Icons ──

const IconFeedbackLoop = ({ size = 28 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 16 A10 10 0 0 1 26 16" stroke="var(--crimson)" strokeWidth="2" strokeLinecap="round" fill="none" strokeDasharray="32" strokeDashoffset="0">
      <animate attributeName="stroke-dashoffset" values="0;-64" dur="3s" repeatCount="indefinite"/>
    </path>
    <path d="M26 16 A10 10 0 0 1 6 16" stroke="var(--mint)" strokeWidth="2" strokeLinecap="round" fill="none" strokeDasharray="32" strokeDashoffset="0">
      <animate attributeName="stroke-dashoffset" values="0;-64" dur="3s" repeatCount="indefinite"/>
    </path>
    <polygon points="26,16 22,12 22,20" fill="var(--crimson)">
      <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite"/>
    </polygon>
    <polygon points="6,16 10,12 10,20" fill="var(--mint)">
      <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" begin="0.75s" repeatCount="indefinite"/>
    </polygon>
  </svg>
)

const IconPattern = ({ size = 28 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Neural network nodes */}
    <circle cx="6" cy="8" r="3" fill="var(--crimson)" opacity="0.8"/>
    <circle cx="6" cy="24" r="3" fill="var(--crimson)" opacity="0.8"/>
    <circle cx="16" cy="10" r="3" fill="var(--amber)" opacity="0.8"/>
    <circle cx="16" cy="22" r="3" fill="var(--amber)" opacity="0.8"/>
    <circle cx="26" cy="16" r="3" fill="var(--mint)" opacity="0.8">
      <animate attributeName="r" values="3;4;3" dur="2s" repeatCount="indefinite"/>
    </circle>
    {/* Connections */}
    <line x1="8" y1="9" x2="14" y2="10" stroke="var(--crimson)" strokeWidth="1" opacity="0.4"/>
    <line x1="8" y1="23" x2="14" y2="22" stroke="var(--crimson)" strokeWidth="1" opacity="0.4"/>
    <line x1="18" y1="11" x2="24" y2="15" stroke="var(--amber)" strokeWidth="1" opacity="0.4"/>
    <line x1="18" y1="21" x2="24" y2="17" stroke="var(--amber)" strokeWidth="1" opacity="0.4"/>
    {/* Data pulse along connections */}
    <circle r="1.5" fill="var(--amber)">
      <animateMotion dur="2s" repeatCount="indefinite" path="M8,9 L14,10 L18,11 L24,15"/>
      <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite"/>
    </circle>
  </svg>
)

const IconOutcome = ({ size = 28 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Gauge arc */}
    <path d="M6 24 A12 12 0 0 1 26 24" stroke="var(--elevated)" strokeWidth="3" strokeLinecap="round" fill="none"/>
    <path d="M6 24 A12 12 0 0 1 26 24" stroke="url(#gauge-grad)" strokeWidth="3" strokeLinecap="round" fill="none" strokeDasharray="38" strokeDashoffset="38">
      <animate attributeName="stroke-dashoffset" values="38;8;38" dur="3s" repeatCount="indefinite"/>
    </path>
    <defs>
      <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%">
        <stop offset="0%" stopColor="var(--crimson)"/>
        <stop offset="50%" stopColor="var(--amber)"/>
        <stop offset="100%" stopColor="var(--mint)"/>
      </linearGradient>
    </defs>
    {/* Needle */}
    <line x1="16" y1="24" x2="16" y2="12" stroke="var(--text-primary)" strokeWidth="1.5" strokeLinecap="round">
      <animateTransform attributeName="transform" type="rotate" values="-60 16 24;60 16 24;-60 16 24" dur="3s" repeatCount="indefinite"/>
    </line>
    <circle cx="16" cy="24" r="2" fill="var(--text-primary)"/>
  </svg>
)

const IconAlert = ({ size = 28 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Light bulb shape */}
    <path d="M12 24 L20 24 L20 22 C20 20 24 18 24 12 A8 8 0 0 0 8 12 C8 18 12 20 12 22 Z" stroke="var(--amber)" strokeWidth="1.8" fill="none"/>
    {/* Filament glow */}
    <path d="M13 14 Q16 18 19 14" stroke="var(--amber)" strokeWidth="1.5" fill="none">
      <animate attributeName="stroke" values="var(--amber);var(--crimson);var(--amber)" dur="2s" repeatCount="indefinite"/>
    </path>
    {/* Bottom lines */}
    <line x1="13" y1="26" x2="19" y2="26" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="14" y1="28" x2="18" y2="28" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round"/>
    {/* Glow rays */}
    <line x1="16" y1="1" x2="16" y2="3" stroke="var(--amber)" strokeWidth="1" opacity="0" strokeLinecap="round">
      <animate attributeName="opacity" values="0;0.7;0" dur="2s" repeatCount="indefinite"/>
    </line>
    <line x1="4" y1="12" x2="6" y2="12" stroke="var(--amber)" strokeWidth="1" opacity="0" strokeLinecap="round">
      <animate attributeName="opacity" values="0;0.7;0" dur="2s" begin="0.3s" repeatCount="indefinite"/>
    </line>
    <line x1="26" y1="12" x2="28" y2="12" stroke="var(--amber)" strokeWidth="1" opacity="0" strokeLinecap="round">
      <animate attributeName="opacity" values="0;0.7;0" dur="2s" begin="0.6s" repeatCount="indefinite"/>
    </line>
  </svg>
)

// ── Ecosystem Icons ──

const IconSearch = ({ size = 28 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="14" cy="14" r="9" stroke="var(--mint)" strokeWidth="2" fill="none"/>
    <line x1="21" y1="21" x2="28" y2="28" stroke="var(--mint)" strokeWidth="2.5" strokeLinecap="round"/>
    {/* Scanning sweep */}
    <circle cx="14" cy="14" r="0" fill="none" stroke="var(--crimson)" strokeWidth="1" opacity="0">
      <animate attributeName="r" values="0;9;0" dur="2.5s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0;0.5;0" dur="2.5s" repeatCount="indefinite"/>
    </circle>
    {/* Found dot */}
    <circle cx="14" cy="14" r="2" fill="var(--amber)" opacity="0">
      <animate attributeName="opacity" values="0;0;1;0" dur="2.5s" repeatCount="indefinite"/>
    </circle>
  </svg>
)

const IconBridge = ({ size = 28 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Plug shape */}
    <rect x="2" y="11" width="10" height="10" rx="2" stroke="var(--crimson)" strokeWidth="1.5" fill="none"/>
    <rect x="20" y="11" width="10" height="10" rx="2" stroke="var(--mint)" strokeWidth="1.5" fill="none"/>
    {/* Connection line */}
    <line x1="12" y1="16" x2="20" y2="16" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 2">
      <animate attributeName="stroke-dashoffset" values="0;-8" dur="1s" repeatCount="indefinite"/>
    </line>
    {/* Energy dots traveling */}
    <circle r="2" fill="var(--amber)">
      <animateMotion dur="1.5s" repeatCount="indefinite" path="M12,16 L20,16"/>
    </circle>
    <circle r="1.5" fill="var(--crimson)">
      <animateMotion dur="1.5s" begin="0.5s" repeatCount="indefinite" path="M20,16 L12,16"/>
    </circle>
    {/* Prongs */}
    <line x1="5" y1="11" x2="5" y2="8" stroke="var(--crimson)" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="9" y1="11" x2="9" y2="8" stroke="var(--crimson)" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="23" y1="11" x2="23" y2="8" stroke="var(--mint)" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="27" y1="11" x2="27" y2="8" stroke="var(--mint)" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

const IconUnifiedWorkflow = ({ size = 28 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Three converging arrows */}
    <path d="M4 6 L16 16" stroke="var(--crimson)" strokeWidth="2" strokeLinecap="round"/>
    <path d="M4 26 L16 16" stroke="var(--mint)" strokeWidth="2" strokeLinecap="round"/>
    <path d="M16 16 L28 16" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round">
      <animate attributeName="x2" values="28;30;28" dur="1.5s" repeatCount="indefinite"/>
    </path>
    {/* Arrow head */}
    <polygon points="28,16 24,12 24,20" fill="var(--amber)">
      <animate attributeName="points" values="28,16 24,12 24,20;30,16 26,12 26,20;28,16 24,12 24,20" dur="1.5s" repeatCount="indefinite"/>
    </polygon>
    {/* Central merge node */}
    <circle cx="16" cy="16" r="3" fill="var(--surface)" stroke="var(--text-primary)" strokeWidth="1.5">
      <animate attributeName="r" values="3;4;3" dur="2s" repeatCount="indefinite"/>
    </circle>
    {/* Source dots */}
    <circle cx="4" cy="6" r="2.5" fill="var(--crimson)"/>
    <circle cx="4" cy="26" r="2.5" fill="var(--mint)"/>
  </svg>
)

// ── Power User Icons ──

const IconDocument = ({ size = 28 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 4 L20 4 L26 10 L26 28 L8 28 Z" stroke="var(--crimson)" strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
    <path d="M20 4 L20 10 L26 10" stroke="var(--crimson)" strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
    {/* Text lines appearing */}
    <line x1="12" y1="16" x2="22" y2="16" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" opacity="0">
      <animate attributeName="opacity" values="0;0.6;0.6;0" dur="3s" repeatCount="indefinite"/>
    </line>
    <line x1="12" y1="20" x2="20" y2="20" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" opacity="0">
      <animate attributeName="opacity" values="0;0;0.6;0" dur="3s" repeatCount="indefinite"/>
    </line>
    <line x1="12" y1="24" x2="18" y2="24" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" opacity="0">
      <animate attributeName="opacity" values="0;0;0;0.6" dur="3s" repeatCount="indefinite"/>
    </line>
  </svg>
)

const IconLock = ({ size = 28 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="14" width="20" height="14" rx="3" stroke="var(--amber)" strokeWidth="2" fill="none"/>
    <path d="M10 14 L10 10 A6 6 0 0 1 22 10 L22 14" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" fill="none"/>
    {/* Keyhole */}
    <circle cx="16" cy="21" r="2.5" fill="var(--amber)">
      <animate attributeName="fill" values="var(--amber);var(--mint);var(--amber)" dur="3s" repeatCount="indefinite"/>
    </circle>
    <rect x="15" y="22" width="2" height="4" rx="1" fill="var(--amber)"/>
    {/* Shield glow */}
    <rect x="6" y="14" width="20" height="14" rx="3" fill="none" stroke="var(--mint)" strokeWidth="0.5" opacity="0">
      <animate attributeName="opacity" values="0;0.5;0" dur="3s" repeatCount="indefinite"/>
    </rect>
  </svg>
)

// ── Workflow Trail Sparkle ──

const IconSparkle = ({ size = 12 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 0 L9 6 L16 8 L9 10 L8 16 L7 10 L0 8 L7 6 Z" fill="var(--amber)">
      <animateTransform attributeName="transform" type="rotate" values="0 8 8;360 8 8" dur="6s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite"/>
    </path>
  </svg>
)

// ── Guide Preview Icons (rendered inside mapped cards) ──

const IconChat = ({ size = 28 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 6 L28 6 A2 2 0 0 1 28 6 L28 22 A2 2 0 0 1 26 24 L10 24 L4 28 Z" stroke="var(--crimson)" strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
    {/* Typing dots */}
    <circle cx="11" cy="15" r="1.5" fill="var(--crimson)">
      <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite"/>
    </circle>
    <circle cx="16" cy="15" r="1.5" fill="var(--crimson)">
      <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" begin="0.2s" repeatCount="indefinite"/>
    </circle>
    <circle cx="21" cy="15" r="1.5" fill="var(--crimson)">
      <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" begin="0.4s" repeatCount="indefinite"/>
    </circle>
  </svg>
)

const IconShuffle = ({ size = 28 }) => (
  <svg className="ani-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 10 L12 10 L20 22 L28 22" stroke="var(--mint)" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <path d="M4 22 L12 22 L20 10 L28 10" stroke="var(--crimson)" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <polygon points="28,10 24,6 24,14" fill="var(--crimson)">
      <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite"/>
    </polygon>
    <polygon points="28,22 24,18 24,26" fill="var(--mint)">
      <animate attributeName="opacity" values="1;0.4;1" dur="2s" begin="1s" repeatCount="indefinite"/>
    </polygon>
  </svg>
)

const GUIDE_ICONS = {
  mic: IconMicrophone,
  tasks: IconTasks,
  shuffle: IconShuffle,
  robot: IconRobot,
  target: IconTarget,
  search: IconSearch,
  chat: IconChat,
  analytics: IconAnalytics,
  calendar: IconCalendar,
}

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
            <li><a href="#story">Story</a></li>
            <li><a href="#trifecto">The Trifecto</a></li>
            <li><a href="#features">Features</a></li>
            <li><a href="#integrations">Integrations</a></li>
            <li><a href="#guide">User Guide</a></li>
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
              4 AI agents, a visual automation canvas, and deep integrations that close the loop
              from decision to execution.
            </p>

            <div className="hero-actions">
              <Link to="/sign-in" className="btn-primary btn-large">Start Automating &rarr;</Link>
              <a href="#story" className="btn-ghost btn-large">Our Story</a>
            </div>

            <div className="hero-stats">
              <div className="stat-item">
                <span className="stat-num">4</span>
                <span className="stat-label">AI Agents</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-num">7<span>+</span></span>
                <span className="stat-label">Integrations</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-num">3</span>
                <span className="stat-label">Connected Apps</span>
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
              <IconSparkle size={10}/> Priority Agent
            </div>
            <div className="wf-node action wf-node-hero-action">
              <span className="wf-node-dot"></span>
              &rarr; Slack + CRM
            </div>
          </div>
        </div>
      </section>

      {/* ── THE STORY ── */}
      <section className="story" id="story">
        <div className="container">
          <div className="story-header">
            <div className="section-label">Why Entomate Exists</div>
            <h2 className="section-title">Meetings produce decisions.<br />Decisions need <span className="story-highlight">execution.</span></h2>
          </div>

          <div className="story-grid">
            <div className="story-step">
              <div className="story-step-num">01</div>
              <h3>The Problem</h3>
              <p>
                Teams hold meeting after meeting. Decisions get made, action items get
                assigned, follow-ups get promised. Then everyone goes back to their
                desk — and nothing happens. The gap between decision and execution is
                where productivity goes to die.
              </p>
            </div>

            <div className="story-step">
              <div className="story-step-num">02</div>
              <h3>The Insight</h3>
              <p>
                What if your meetings could execute themselves? What if every recording
                was automatically transcribed, every action item tracked, every follow-up
                scheduled, and every decision pushed into your CRM and project tools —
                without anyone lifting a finger?
              </p>
            </div>

            <div className="story-step">
              <div className="story-step-num">03</div>
              <h3>The Solution</h3>
              <p>
                Entomate is the execution layer for your team. Upload a meeting recording
                and four AI agents go to work — prioritizing tasks, assigning owners,
                setting deadlines, and detecting follow-ups. Then the visual workflow
                engine routes everything to Slack, your CRM, and your calendar
                automatically.
              </p>
            </div>
          </div>

          <div className="story-audience">
            <div className="story-audience-label">Built for</div>
            <div className="story-audience-tags">
              <span className="audience-tag">Operations Teams</span>
              <span className="audience-tag">Project Managers</span>
              <span className="audience-tag">Team Leads</span>
              <span className="audience-tag">Startup Founders</span>
              <span className="audience-tag">Agency Directors</span>
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
              <div className="trifecto-icon logos-vision">
                <svg width="28" height="28" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Eye shape — outer */}
                  <path d="M6 32 C6 32 20 14 32 14 C44 14 58 32 58 32 C58 32 44 50 32 50 C20 50 6 32 6 32Z" stroke="#22D3EE" strokeWidth="2.5" fill="none" opacity="0.9"/>
                  {/* Iris circle */}
                  <circle cx="32" cy="32" r="10" stroke="#3B82F6" strokeWidth="2" fill="none" opacity="0.8"/>
                  {/* Pupil core */}
                  <circle cx="32" cy="32" r="4" fill="#22D3EE"/>
                  {/* Neural nodes */}
                  <circle cx="12" cy="24" r="2" fill="#22D3EE" opacity="0.5"/>
                  <circle cx="52" cy="24" r="2" fill="#22D3EE" opacity="0.5"/>
                  <circle cx="12" cy="40" r="2" fill="#3B82F6" opacity="0.5"/>
                  <circle cx="52" cy="40" r="2" fill="#3B82F6" opacity="0.5"/>
                  {/* Connecting lines */}
                  <line x1="14" y1="24" x2="22" y2="28" stroke="#22D3EE" strokeWidth="1" opacity="0.3"/>
                  <line x1="50" y1="24" x2="42" y2="28" stroke="#22D3EE" strokeWidth="1" opacity="0.3"/>
                </svg>
              </div>
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
              <div className="trifecto-icon pulse">
                <svg width="28" height="28" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Q shape — the QntmEcos mark */}
                  <path d="M 40 10 A 28 28 0 1 1 40 68" stroke="#f43f5e" strokeWidth="5" strokeLinecap="round" fill="none" />
                  <line x1="54" y1="56" x2="68" y2="72" stroke="#f43f5e" strokeWidth="5" strokeLinecap="round" />
                  <circle cx="40" cy="40" r="5" fill="#f43f5e" />
                </svg>
              </div>
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
              <div className="trifecto-icon entomate">
                <svg width="28" height="28" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
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
              <div className="trifecto-product-name">Entomate</div>
              <div className="trifecto-product-role active">The Hands — You Are Here</div>
              <p>
                Visual workflow automation, 4 specialized AI agents, and 7+ integrations
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
              <div className="pillar-accent crimson"><IconMicrophone size={20}/></div>
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
              <div className="pillar-accent mint"><IconWorkflow size={20}/></div>
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
              <div className="pillar-accent amber"><IconAgents size={20}/></div>
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
              <div className="pillar-accent crimson"><IconTasks size={20}/></div>
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
              <div className="pillar-accent mint"><IconAnalytics size={20}/></div>
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
              <div className="pillar-accent amber"><IconIntegrations size={20}/></div>
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

            {/* Pillar 7: AI Assistant */}
            <div className="pillar-card">
              <div className="pillar-accent crimson"><IconRobot size={20}/></div>
              <h3>Ento AI Assistant</h3>
              <p>
                A context-aware AI chat assistant that understands your workspace —
                ask it anything, get proactive suggestions, and prepare for meetings automatically.
              </p>
              <ul className="feature-list">
                <li>Streaming natural-language chat</li>
                <li>Context from meetings, tasks &amp; goals</li>
                <li>Proactive AI suggestions</li>
                <li>Meeting preparation briefs</li>
                <li>Natural-language Q&amp;A across data</li>
                <li>RAG-powered workspace search</li>
              </ul>
            </div>

            {/* Pillar 8: Reports & Learning */}
            <div className="pillar-card">
              <div className="pillar-accent mint"><IconReports size={20}/></div>
              <h3>Reports &amp; Adaptive AI</h3>
              <p>
                Export branded PDF recaps and CSV data. Meanwhile, Entomate's learning system
                watches how you override AI suggestions and improves over time.
              </p>
              <ul className="feature-list">
                <li>Branded PDF meeting recaps</li>
                <li>CSV data exports</li>
                <li>Learning from user overrides</li>
                <li>Pattern detection &amp; auto-suggest</li>
                <li>Outcome tracking &amp; effectiveness</li>
                <li>Deal risk &amp; relationship scoring</li>
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
                <div className="deep-feature-icon"><IconTarget size={16}/></div>
                <div className="deep-feature-text">
                  <h4>Priority Agent</h4>
                  <p>Analyzes meeting sentiment, deadlines, and business context to assign High/Medium/Low priority automatically.</p>
                </div>
              </div>

              <div className="deep-feature-item">
                <div className="deep-feature-icon"><IconPerson size={16}/></div>
                <div className="deep-feature-text">
                  <h4>Assignment Agent</h4>
                  <p>Matches tasks to team members based on skillset, current workload, and historical performance.</p>
                </div>
              </div>

              <div className="deep-feature-item">
                <div className="deep-feature-icon"><IconCalendar size={16}/></div>
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
                  <span className="agent-name"><IconSparkle size={12}/> Priority Agent — Decision Trace</span>
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
                <div className="deep-feature-icon"><IconAnalytics size={16}/></div>
                <div className="deep-feature-text">
                  <h4>Factor Analysis</h4>
                  <p>See exactly what data points influenced each recommendation, weighted by importance.</p>
                </div>
              </div>

              <div className="deep-feature-item">
                <div className="deep-feature-icon"><IconFeedback size={16}/></div>
                <div className="deep-feature-text">
                  <h4>Feedback Loop</h4>
                  <p>Accept or reject recommendations. Each override teaches the model to improve future suggestions.</p>
                </div>
              </div>

              <div className="deep-feature-item">
                <div className="deep-feature-icon"><IconDNA size={16}/></div>
                <div className="deep-feature-text">
                  <h4>Pattern Learning</h4>
                  <p>Entomate discovers recurring patterns in your workflow and suggests automating them permanently.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── ADAPTIVE INTELLIGENCE ── */}
      <section className="adaptive" id="adaptive">
        <div className="container">
          <div className="adaptive-header">
            <div className="section-label">Adaptive Intelligence</div>
            <h2 className="section-title">AI that gets smarter<br />every time you use it.</h2>
            <p className="section-sub" style={{ margin: '0 auto', maxWidth: 600, textAlign: 'center' }}>
              Every time you override an AI recommendation, Entomate learns. It detects patterns
              in your decisions, tracks outcomes, and continuously improves its suggestions.
            </p>
          </div>

          <div className="adaptive-grid">
            <div className="adaptive-card">
              <div className="adaptive-icon"><IconFeedbackLoop/></div>
              <h3>Feedback-Driven Learning</h3>
              <p>Accept or reject any AI suggestion. Each override is captured, analyzed, and fed back into the model so future recommendations match your judgment.</p>
            </div>
            <div className="adaptive-card">
              <div className="adaptive-icon"><IconPattern/></div>
              <h3>Pattern Detection</h3>
              <p>Entomate discovers recurring patterns in how your team works — repeated task types, common assignees, typical deadlines — and suggests automating them.</p>
            </div>
            <div className="adaptive-card">
              <div className="adaptive-icon"><IconOutcome/></div>
              <h3>Outcome Tracking</h3>
              <p>Every AI-assisted decision is tracked to completion. Did the priority call land? Was the deadline realistic? The system measures and adjusts.</p>
            </div>
            <div className="adaptive-card">
              <div className="adaptive-icon"><IconAlert/></div>
              <h3>Proactive Alerts</h3>
              <p>Deal risk scoring, relationship health monitoring, and meeting prep briefs — delivered before you need to ask, based on real intelligence signals.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── METRICS ── */}
      <section className="metrics">
        <div className="container">
          <div className="metrics-grid">
            <div className="metric-item">
              <div className="metric-num">4</div>
              <div className="metric-label">Specialized AI agents with explainability, confidence scores, and adaptive learning</div>
              <div className="metric-sub">// ai_agents_deployed</div>
            </div>
            <div className="metric-item">
              <div className="metric-num">3</div>
              <div className="metric-label">Connected apps in the Trifecto ecosystem: Logos Vision, Pulse, and Entomate</div>
              <div className="metric-sub">// trifecto_apps</div>
            </div>
            <div className="metric-item">
              <div className="metric-num">7<span className="unit">+</span></div>
              <div className="metric-label">Integrations: Slack, Salesforce, HubSpot, Google Calendar, Webhooks, Email, Cron</div>
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
              <span className="chip-icon"><IconSlack size={16}/></span> Slack
            </div>
            <div className="integration-chip chip-salesforce">
              <span className="chip-icon"><IconSalesforce size={16}/></span> Salesforce
            </div>
            <div className="integration-chip chip-hubspot">
              <span className="chip-icon"><IconHubSpot size={16}/></span> HubSpot
            </div>
            <div className="integration-chip chip-gcal">
              <span className="chip-icon"><IconGoogleCal size={16}/></span> Google Calendar
            </div>
            <div className="integration-chip chip-webhook">
              <span className="chip-icon"><IconWebhook size={16}/></span> Webhooks
            </div>
            <div className="integration-chip chip-teams coming-soon">
              <span className="chip-icon"><IconTeams size={16}/></span> Teams <span className="chip-soon">soon</span>
            </div>
            <div className="integration-chip chip-email">
              <span className="chip-icon"><IconEmail size={16}/></span> Email
            </div>
            <div className="integration-chip chip-cron">
              <span className="chip-icon"><IconCron size={16}/></span> Cron Jobs
            </div>
          </div>
        </div>
      </section>

      {/* ── TRIFECTO ECOSYSTEM ── */}
      <section className="ecosystem" id="ecosystem">
        <div className="container">
          <div className="ecosystem-header">
            <div className="section-label">The Trifecto Ecosystem</div>
            <h2 className="section-title">Three apps. One intelligence layer.</h2>
            <p className="section-sub" style={{ margin: '0 auto', maxWidth: 620, textAlign: 'center' }}>
              Entomate doesn't work alone. It connects to Logos Vision (CRM) and Pulse (communication)
              through the Ecosystem Bridge — sharing contacts, decisions, and intelligence in real time.
            </p>
          </div>

          <div className="ecosystem-grid">
            <div className="ecosystem-card">
              <div className="ecosystem-icon"><IconSearch/></div>
              <h3>Cross-App Search</h3>
              <p>Search across all three Trifecto apps from a single input. Find contacts in Logos Vision, messages in Pulse, and tasks in Entomate — together.</p>
            </div>
            <div className="ecosystem-card">
              <div className="ecosystem-icon"><IconBridge/></div>
              <h3>Ecosystem Bridge</h3>
              <p>Real-time data sharing between apps. When Entomate creates a task from a meeting, it can push the contact to Logos Vision and notify the team in Pulse.</p>
            </div>
            <div className="ecosystem-card">
              <div className="ecosystem-icon"><IconUnifiedWorkflow/></div>
              <h3>Unified Workflows</h3>
              <p>Build automations that span all three apps. Trigger in Entomate, enrich in Logos Vision, notify in Pulse — all from the visual canvas.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── POWER USERS ── */}
      <section className="power-users" id="power">
        <div className="container">
          <div className="section-label">Built for Power Users</div>
          <h2 className="section-title">The details that<br />make the difference.</h2>

          <div className="power-grid">
            <div className="power-card">
              <kbd className="power-kbd">&#8984;K</kbd>
              <h4>Command Palette</h4>
              <p>Jump to any page, task, or meeting with a keyboard shortcut. Navigate your entire workspace without touching the mouse.</p>
            </div>
            <div className="power-card">
              <span className="power-icon-img"><IconDocument size={28}/></span>
              <h4>PDF &amp; CSV Exports</h4>
              <p>Export branded meeting recaps as PDF or download any data view as CSV. Built-in report generation with your brand colors.</p>
            </div>
            <div className="power-card">
              <span className="power-icon-img"><IconGoogleCal size={28}/></span>
              <h4>Google Calendar Sync</h4>
              <p>Full OAuth integration with Google Calendar. See your meetings, sync events, and trigger automations from calendar activity.</p>
            </div>
            <div className="power-card">
              <span className="power-icon-img"><IconLock size={28}/></span>
              <h4>Secrets Vault</h4>
              <p>Store API credentials and tokens securely in an encrypted vault. Use them in workflow actions without exposing keys in plaintext.</p>
            </div>
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
              { iconKey: 'mic', title: 'Meetings', desc: 'Upload recordings, get transcripts, summaries, action items, and sentiment — all AI-powered.' },
              { iconKey: 'tasks', title: 'Tasks & AI', desc: 'AI suggests assignments, priorities, and deadlines — with full explainability cards.' },
              { iconKey: 'shuffle', title: 'Workflows', desc: 'Visual node-based automations connecting triggers to actions across your tools.' },
              { iconKey: 'robot', title: 'AI Agents', desc: 'Four specialized agents for assignment, priority, deadlines, and follow-up detection.' },
              { iconKey: 'target', title: 'Goals & OKRs', desc: 'Track objectives at Company, Team, and Individual levels with measurable key results.' },
              { iconKey: 'search', title: 'Search & AI Q&A', desc: 'Semantic search across your workspace with natural-language AI question answering.' },
              { iconKey: 'chat', title: 'Ento Assistant', desc: 'Context-aware AI chat that answers questions, gives proactive suggestions, and preps you for meetings.' },
              { iconKey: 'analytics', title: 'Reports & Analytics', desc: 'PDF meeting recaps, CSV exports, analytics dashboards, and AI effectiveness tracking.' },
              { iconKey: 'calendar', title: 'Calendar & Scheduling', desc: 'Google Calendar OAuth integration with event sync and calendar-triggered automations.' },
            ].map((item, i) => {
              const GuideIcon = GUIDE_ICONS[item.iconKey]
              return (
                <div key={i} className="guide-preview-card">
                  <span className="guide-preview-icon"><GuideIcon size={28}/></span>
                  <h3 className="guide-preview-title">{item.title}</h3>
                  <p className="guide-preview-desc">{item.desc}</p>
                </div>
              )
            })}
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

        /* ── ANIMATED SVG ICONS ── */
        .landing-page .ani-icon {
          display: inline-block;
          vertical-align: middle;
          transition: transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), filter 300ms ease;
        }

        /* Hover amplification on parent containers */
        .landing-page .pillar-card:hover .ani-icon,
        .landing-page .trifecto-card:hover .ani-icon,
        .landing-page .deep-feature-item:hover .ani-icon,
        .landing-page .adaptive-card:hover .ani-icon,
        .landing-page .ecosystem-card:hover .ani-icon,
        .landing-page .power-card:hover .ani-icon,
        .landing-page .guide-preview-card:hover .ani-icon,
        .landing-page .integration-chip:hover .ani-icon {
          transform: scale(1.25) rotate(5deg);
          filter: drop-shadow(0 0 8px var(--crimson-glow));
        }

        /* Specific color glows per accent */
        .landing-page .pillar-accent.mint:hover .ani-icon,
        .landing-page .ecosystem-card:hover .ani-icon {
          filter: drop-shadow(0 0 8px rgba(0, 245, 212, 0.5));
        }

        .landing-page .pillar-accent.amber:hover .ani-icon {
          filter: drop-shadow(0 0 8px rgba(255, 184, 0, 0.5));
        }

        .landing-page .trifecto-icon.logos-vision:hover .ani-icon {
          filter: drop-shadow(0 0 8px rgba(34, 211, 238, 0.5));
        }

        .landing-page .trifecto-icon.pulse:hover .ani-icon {
          filter: drop-shadow(0 0 8px rgba(244, 63, 94, 0.5));
        }

        /* Gentle idle float for section icons */
        .landing-page .pillar-accent .ani-icon,
        .landing-page .adaptive-icon .ani-icon,
        .landing-page .ecosystem-icon .ani-icon {
          animation: icon-idle-float 4s ease-in-out infinite;
        }

        @keyframes icon-idle-float {
          0%, 100% { transform: translateY(0px); }
          50%      { transform: translateY(-2px); }
        }

        /* On hover, override the idle float with the pop */
        .landing-page .pillar-card:hover .pillar-accent .ani-icon,
        .landing-page .adaptive-card:hover .adaptive-icon .ani-icon,
        .landing-page .ecosystem-card:hover .ecosystem-icon .ani-icon {
          animation: none;
          transform: scale(1.25) rotate(5deg);
        }

        /* Guide preview icon sizing */
        .landing-page .guide-preview-icon {
          display: flex;
          align-items: center;
          height: 32px;
          margin-bottom: 12px;
        }

        .landing-page .guide-preview-icon .ani-icon {
          width: 28px;
          height: 28px;
        }

        /* Power card icon area */
        .landing-page .power-icon-img {
          display: flex;
          align-items: center;
          height: 32px;
          margin-bottom: 16px;
        }

        /* Agent name inline icon */
        .landing-page .agent-name .ani-icon {
          margin-right: 4px;
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
          background: rgba(34, 211, 238, 0.10);
          border: 1px solid rgba(34, 211, 238, 0.25);
        }

        .landing-page .trifecto-icon.pulse {
          background: rgba(244, 63, 94, 0.10);
          border: 1px solid rgba(244, 63, 94, 0.25);
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
          grid-template-columns: repeat(4, 1fr);
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

        /* ── THE STORY SECTION ── */
        .landing-page .story {
          padding: 120px 0;
          background: linear-gradient(to bottom, transparent, rgba(255, 45, 107, 0.02) 50%, transparent);
        }

        .landing-page .story-header {
          text-align: center;
          margin-bottom: 72px;
        }

        .landing-page .story-highlight {
          color: var(--crimson);
          text-shadow: 0 0 40px rgba(255, 45, 107, 0.3);
        }

        .landing-page .story-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2px;
          background: var(--border);
          border-radius: var(--radius-xl);
          overflow: hidden;
          margin-bottom: 48px;
        }

        .landing-page .story-step {
          background: var(--surface);
          padding: 40px 32px;
          position: relative;
        }

        .landing-page .story-step-num {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 600;
          color: var(--crimson);
          letter-spacing: 0.10em;
          margin-bottom: 16px;
        }

        .landing-page .story-step h3 {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 12px;
        }

        .landing-page .story-step p {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.75;
        }

        .landing-page .story-audience {
          text-align: center;
        }

        .landing-page .story-audience-label {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: var(--text-muted);
          margin-bottom: 16px;
        }

        .landing-page .story-audience-tags {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 10px;
        }

        .landing-page .audience-tag {
          padding: 8px 16px;
          border: 1px solid var(--border);
          border-radius: 100px;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          background: var(--surface);
          transition: all 150ms ease;
        }

        .landing-page .audience-tag:hover {
          border-color: var(--border-glow);
          color: var(--crimson);
        }

        /* ── ADAPTIVE INTELLIGENCE SECTION ── */
        .landing-page .adaptive {
          padding: 120px 0;
        }

        .landing-page .adaptive-header {
          text-align: center;
          margin-bottom: 64px;
        }

        .landing-page .adaptive-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }

        .landing-page .adaptive-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: 32px 24px;
          transition: border-color 200ms ease, transform 200ms ease;
        }

        .landing-page .adaptive-card:hover {
          border-color: var(--border-glow);
          transform: translateY(-4px);
        }

        .landing-page .adaptive-icon {
          font-size: 28px;
          margin-bottom: 16px;
          display: block;
        }

        .landing-page .adaptive-card h3 {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 10px;
        }

        .landing-page .adaptive-card p {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.7;
        }

        /* ── COMING SOON CHIP ── */
        .landing-page .integration-chip.coming-soon {
          opacity: 0.5;
        }

        .landing-page .chip-soon {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--amber);
          padding: 1px 5px;
          border: 1px solid rgba(255, 184, 0, 0.3);
          border-radius: 4px;
          background: rgba(255, 184, 0, 0.08);
        }

        /* ── TRIFECTO ECOSYSTEM SECTION ── */
        .landing-page .ecosystem {
          padding: 120px 0;
          background: linear-gradient(to bottom, transparent, rgba(0, 245, 212, 0.02) 50%, transparent);
        }

        .landing-page .ecosystem-header {
          text-align: center;
          margin-bottom: 64px;
        }

        .landing-page .ecosystem-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }

        .landing-page .ecosystem-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: 32px;
          transition: border-color 200ms ease, transform 200ms ease;
        }

        .landing-page .ecosystem-card:hover {
          border-color: rgba(0, 245, 212, 0.25);
          transform: translateY(-4px);
        }

        .landing-page .ecosystem-icon {
          font-size: 28px;
          margin-bottom: 16px;
          display: block;
        }

        .landing-page .ecosystem-card h3 {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 10px;
        }

        .landing-page .ecosystem-card p {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.75;
        }

        /* ── POWER USERS SECTION ── */
        .landing-page .power-users {
          padding: 120px 0;
        }

        .landing-page .power-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-top: 48px;
        }

        .landing-page .power-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: 32px 24px;
          transition: border-color 200ms ease, transform 200ms ease;
        }

        .landing-page .power-card:hover {
          border-color: var(--border-glow);
          transform: translateY(-4px);
        }

        .landing-page .power-kbd {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 12px;
          background: var(--elevated);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          font-family: var(--font-mono);
          font-size: 14px;
          font-weight: 600;
          color: var(--crimson);
          margin-bottom: 16px;
          box-shadow: 0 2px 0 rgba(255, 255, 255, 0.06);
        }

        .landing-page .power-icon-img {
          font-size: 28px;
          display: block;
          margin-bottom: 16px;
        }

        .landing-page .power-card h4 {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 10px;
        }

        .landing-page .power-card p {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.7;
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
        .landing-page .trifecto-pip.lv     { background: #22D3EE; color: #080808; }
        .landing-page .trifecto-pip.pulse  { background: #f43f5e; }
        .landing-page .trifecto-pip.ent    { background: var(--crimson); opacity: 1; }

        /* (Logo showcase CSS removed — section replaced with Ecosystem + Power Users) */

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

        /* (Logo hero CSS removed — section replaced) */

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
          .landing-page .metrics-grid { grid-template-columns: 1fr 1fr; }
          .landing-page .story-grid { grid-template-columns: 1fr; }
          .landing-page .adaptive-grid { grid-template-columns: 1fr 1fr; }
          .landing-page .ecosystem-grid { grid-template-columns: 1fr; }
          .landing-page .power-grid { grid-template-columns: 1fr 1fr; }
        }

        @media (max-width: 768px) {
          .landing-page .nav-links { display: none; }
          .landing-page .pillars-grid { grid-template-columns: 1fr; }
          .landing-page .deep-grid { grid-template-columns: 1fr; }
          .landing-page .hero h1 { font-size: 42px; }
          .landing-page .hero-stats { flex-wrap: wrap; gap: 20px; }
          .landing-page .stat-divider { display: none; }
          .landing-page .metrics-grid { grid-template-columns: 1fr; }
          .landing-page .integration-orbit { height: 280px; }
          .landing-page .chip-gcal, .landing-page .chip-cron, .landing-page .chip-email { display: none; }
          .landing-page .adaptive-grid { grid-template-columns: 1fr; }
          .landing-page .power-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}
