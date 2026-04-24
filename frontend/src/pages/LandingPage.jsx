import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { guideSections, CATEGORIES, guideVersion, guideUpdated } from '../components/UsersGuide/guideData'
import { Logo, CircuitEMark } from '../components/Logo'
import BackToTop from '../components/BackToTop'

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

export default function LandingPage() {
  const { isSignedIn, loading: isLoading } = useAuth()
  const isLoaded = !isLoading
  const landingRef = useRef(null)
  const heroCanvasRef = useRef(null)

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

  // ── Hero neural-network canvas animation ─────────────────────────────────────
  useEffect(() => {
    const canvas = heroCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let isVisible = true
    const visObs = new IntersectionObserver(([entry]) => { isVisible = entry.isIntersecting }, { threshold: 0 })
    visObs.observe(canvas)

    const CRIMSON = '#FF2D6B'
    const MINT    = '#00F5D4'
    const AMBER   = '#FFB800'
    const COLORS  = [CRIMSON, MINT, AMBER]
    const GLOW    = 1.0
    const CONNECT_DIST_FRAC = 0.30  // fraction of canvas width — bigger = more connections
    const N_NODES = 50
    const N_HUBS  = 10

    let W = 0, H = 0, rafId = 0, time = 0

    // ── Node types ──
    // Hubs: large, slow, named — represent key automation concepts
    // Regular: small, drift around, form the mesh
    const nodes = []
    const pings = []   // data pulses traveling between nodes
    const ripples = [] // expanding rings when a ping arrives

    function makeNode(isHub, idx) {
      const color = COLORS[idx % 3]
      const pad = 40  // keep nodes away from edges
      return {
        x:  pad + Math.random() * (W - pad * 2),
        y:  pad + Math.random() * (H - pad * 2),
        vx: (Math.random() - 0.5) * (isHub ? 0.25 : 0.55),
        vy: (Math.random() - 0.5) * (isHub ? 0.25 : 0.55),
        r:  isHub ? 5 + Math.random() * 4 : 2 + Math.random() * 3,
        color,
        alpha: isHub ? 1.0 : 0.45 + Math.random() * 0.35,
        isHub,
        pulsePhase: Math.random() * Math.PI * 2,
      }
    }

    function buildNodes() {
      nodes.length = 0
      pings.length = 0
      ripples.length = 0
      for (let i = 0; i < N_HUBS; i++) nodes.push(makeNode(true, i))
      for (let i = 0; i < N_NODES - N_HUBS; i++) nodes.push(makeNode(false, i))
    }

    // ── Spawn a data ping between two connected nodes ──
    function spawnPing(fromIdx, toIdx) {
      const from = nodes[fromIdx]
      const to = nodes[toIdx]
      if (!from || !to) return
      // Use the source node's color, or blend
      pings.push({
        fromIdx, toIdx,
        progress: 0,           // 0 → 1
        speed: 0.006 + Math.random() * 0.010,
        size: 3 + Math.random() * 3,
        color: from.color,
        trail: [],             // recent positions for comet tail
      })
    }

    // ── Spawn a ripple at a position ──
    function spawnRipple(x, y, color) {
      ripples.push({ x, y, r: 0, maxR: 30 + Math.random() * 25, alpha: 0.75, color })
    }

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      W = canvas.offsetWidth
      H = canvas.offsetHeight
      if (W === 0 || H === 0) return  // not laid out yet
      canvas.width  = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      buildNodes()  // always rebuild with correct dimensions
    }

    // ── Find active connections (edges) each frame ──
    function getEdges() {
      const edges = []
      const maxDist = W * CONNECT_DIST_FRAC
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < maxDist) {
            edges.push({ i, j, dist, strength: 1 - dist / maxDist })
          }
        }
      }
      return edges
    }

    // ── Ping spawning timer ──
    let pingTimer = 0
    const PING_INTERVAL = 12 // frames between new pings — frequent for lively feel

    // ── Main loop ──
    const loop = () => {
      rafId = requestAnimationFrame(loop)
      if (!isVisible) return
      ctx.clearRect(0, 0, W, H)
      time += 0.016

      // ── Drift nodes — bounce off edges ──
      nodes.forEach(n => {
        n.x += n.vx
        n.y += n.vy
        if (n.x < n.r)     { n.x = n.r;     n.vx = Math.abs(n.vx) }
        if (n.x > W - n.r) { n.x = W - n.r; n.vx = -Math.abs(n.vx) }
        if (n.y < n.r)     { n.y = n.r;     n.vy = Math.abs(n.vy) }
        if (n.y > H - n.r) { n.y = H - n.r; n.vy = -Math.abs(n.vy) }
      })

      const edges = getEdges()

      // ── Draw connection lines ──
      edges.forEach(e => {
        const a = nodes[e.i], b = nodes[e.j]
        const hasHub = a.isHub || b.isHub
        const bothHub = a.isHub && b.isHub
        const alpha = e.strength * (bothHub ? 0.45 : hasHub ? 0.28 : 0.15)
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.strokeStyle = a.color
        ctx.lineWidth = bothHub ? 1.2 : hasHub ? 0.8 : 0.5
        ctx.globalAlpha = alpha
        // Glow on hub connections
        if (hasHub) {
          ctx.shadowColor = a.color
          ctx.shadowBlur = 6
        }
        ctx.stroke()
        ctx.shadowBlur = 0
      })

      // ── Spawn pings along random edges ──
      pingTimer++
      if (pingTimer >= PING_INTERVAL && edges.length > 0) {
        pingTimer = 0
        // Pick a random edge, prefer hub connections
        const hubEdges = edges.filter(e => nodes[e.i].isHub || nodes[e.j].isHub)
        const pool = hubEdges.length > 3 ? hubEdges : edges
        const edge = pool[Math.floor(Math.random() * pool.length)]
        // Random direction
        if (Math.random() > 0.5) {
          spawnPing(edge.i, edge.j)
        } else {
          spawnPing(edge.j, edge.i)
        }
      }

      // ── Update & draw pings ──
      for (let p = pings.length - 1; p >= 0; p--) {
        const ping = pings[p]
        ping.progress += ping.speed

        if (ping.progress >= 1) {
          // Ping arrived — spawn ripple at destination
          const dest = nodes[ping.toIdx]
          if (dest) spawnRipple(dest.x, dest.y, ping.color)
          pings.splice(p, 1)
          continue
        }

        const from = nodes[ping.fromIdx]
        const to = nodes[ping.toIdx]
        if (!from || !to) { pings.splice(p, 1); continue }

        const px = from.x + (to.x - from.x) * ping.progress
        const py = from.y + (to.y - from.y) * ping.progress

        // Store trail position
        ping.trail.push({ x: px, y: py })
        if (ping.trail.length > 8) ping.trail.shift()

        // Draw comet trail
        ping.trail.forEach((pt, ti) => {
          const trailAlpha = (ti / ping.trail.length) * 0.5
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, ping.size * (0.3 + 0.7 * ti / ping.trail.length), 0, Math.PI * 2)
          ctx.fillStyle = ping.color
          ctx.globalAlpha = trailAlpha * GLOW
          ctx.fill()
        })

        // Draw ping head
        ctx.beginPath()
        ctx.arc(px, py, ping.size, 0, Math.PI * 2)
        ctx.fillStyle = ping.color
        ctx.globalAlpha = 0.9
        ctx.shadowColor = ping.color
        ctx.shadowBlur = 14 * GLOW
        ctx.fill()
        ctx.shadowBlur = 0
      }

      // ── Update & draw ripples ──
      for (let r = ripples.length - 1; r >= 0; r--) {
        const rip = ripples[r]
        rip.r += 0.8
        rip.alpha -= 0.012
        if (rip.alpha <= 0 || rip.r > rip.maxR) { ripples.splice(r, 1); continue }

        ctx.beginPath()
        ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2)
        ctx.strokeStyle = rip.color
        ctx.lineWidth = 2
        ctx.globalAlpha = rip.alpha
        ctx.shadowColor = rip.color
        ctx.shadowBlur = 8
        ctx.stroke()
        ctx.shadowBlur = 0
      }

      // ── Draw nodes ──
      nodes.forEach((n) => {
        const pulse = 0.65 + 0.35 * Math.sin(time * 1.5 + n.pulsePhase)
        const r = n.r * (0.9 + 0.1 * pulse)

        // Outer glow halo
        if (n.isHub) {
          ctx.beginPath()
          ctx.arc(n.x, n.y, r * 5, 0, Math.PI * 2)
          const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 5)
          grad.addColorStop(0, n.color + '35')
          grad.addColorStop(0.5, n.color + '12')
          grad.addColorStop(1, n.color + '00')
          ctx.fillStyle = grad
          ctx.globalAlpha = pulse
          ctx.fill()
        } else {
          // Small glow for regular nodes too
          ctx.beginPath()
          ctx.arc(n.x, n.y, r * 3, 0, Math.PI * 2)
          const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 3)
          grad.addColorStop(0, n.color + '18')
          grad.addColorStop(1, n.color + '00')
          ctx.fillStyle = grad
          ctx.globalAlpha = pulse * 0.6
          ctx.fill()
        }

        // Core dot
        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.fillStyle = n.color
        ctx.globalAlpha = n.alpha * pulse
        ctx.shadowColor = n.color
        ctx.shadowBlur = n.isHub ? 18 : 8
        ctx.fill()
        ctx.shadowBlur = 0

        // White hot-center on hubs
        if (n.isHub) {
          ctx.beginPath()
          ctx.arc(n.x, n.y, r * 0.4, 0, Math.PI * 2)
          ctx.fillStyle = '#ffffff'
          ctx.globalAlpha = 0.45 * pulse
          ctx.fill()
        }
      })

      // ── Central ambient glow ──
      const cx = W * 0.50, cy = H * 0.45
      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.48)
      gr.addColorStop(0,   `rgba(255,45,107,${(0.10 * GLOW).toFixed(2)})`)
      gr.addColorStop(0.35, `rgba(255,184,0,${(0.05 * GLOW).toFixed(2)})`)
      gr.addColorStop(0.65, `rgba(0,245,212,${(0.03 * GLOW).toFixed(2)})`)
      gr.addColorStop(1,   'rgba(0,0,0,0)')
      ctx.beginPath()
      ctx.arc(cx, cy, W * 0.48, 0, Math.PI * 2)
      ctx.fillStyle = gr
      ctx.globalAlpha = 1
      ctx.fill()
    }

    resize()
    window.addEventListener('resize', resize)
    loop()

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
      visObs.disconnect()
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

  // ── Guide accordion state ──
  const [guideOpen, setGuideOpen] = useState(false)          // master toggle
  const [openCats, setOpenCats] = useState(new Set())         // open category indices
  const [openSections, setOpenSections] = useState(new Set()) // open section ids

  const toggleCat = useCallback((idx) => {
    setOpenCats(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n })
  }, [])

  const toggleSection = useCallback((id) => {
    setOpenSections(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }, [])

  const expandAllGuide = useCallback(() => {
    setOpenCats(new Set(CATEGORIES.map((_, i) => i)))
    setOpenSections(new Set(guideSections.map(s => s.id)))
  }, [])

  const collapseAllGuide = useCallback(() => {
    setOpenCats(new Set())
    setOpenSections(new Set())
  }, [])

  if (isLoaded && isSignedIn) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="landing-page" ref={landingRef}>
      <BackToTop />

      {/* ── NAVIGATION ── */}
      <nav>
        <div className="container">
          <a href="#" className="nav-logo">
            <Logo variant="mark" size="sm" withText={true} />
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
        {/* Canvas — automation circuit graphic, right 65%, full height */}
        <canvas
          ref={heroCanvasRef}
          className="hero-circuit-canvas"
          aria-hidden="true"
        />

        {/* Grid overlay — radial mask focuses on the canvas region */}
        <div className="hero-grid"></div>

        {/* Grain texture — premium organic feel */}
        <div className="hero-grain-overlay" aria-hidden="true"></div>

        {/* Left gradient fade — text readable against canvas glow */}
        <div className="hero-fade" aria-hidden="true"></div>

        {/* Text content — left column, vertically centered */}
        <div className="hero-content animate-blur-reveal blur-delay-0">
          <div className="hero-badge animate-blur-reveal blur-delay-1">
            <span className="hero-badge-dot"></span>
            The Hands of the Trifecto
          </div>

          <h1>
            Automate<br />
            <span className="ha-gradient">everything</span><br />
            that matters.
          </h1>

          <p className="hero-sub animate-blur-reveal blur-delay-2">
            Entomate connects your meetings, tasks, and team into intelligent workflows.
            4 AI agents, a visual automation canvas, and deep integrations that close the loop
            from decision to execution.
          </p>

          <div className="hero-actions animate-blur-reveal blur-delay-3">
            <Link to="/sign-in" className="hero-cta">Start Automating &rarr;</Link>
            <a href="#story" className="btn-ghost btn-large">Our Story</a>
          </div>

          <div className="hero-stats animate-blur-reveal blur-delay-4">
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

        {/* Floating workflow nodes — positioned over the canvas area */}
        <div className="hero-wf-nodes" aria-hidden="true">
          <div className="wf-node trigger wf-node-hero-trigger animate-blur-reveal blur-delay-3">
            <span className="wf-node-dot"></span>
            meeting_ended
          </div>
          <div className="wf-node ai wf-node-hero-ai animate-blur-reveal blur-delay-4">
            <span className="wf-node-dot"></span>
            Priority Agent
          </div>
          <div className="wf-node action wf-node-hero-action animate-blur-reveal blur-delay-5">
            <span className="wf-node-dot"></span>
            &rarr; Slack + CRM
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

          {/* Neural Radar Animation — Mind / Voice / Hands convergence */}
          <div className="trifecto-neural">
            <div className="trifecto-neural-glow"></div>
            <svg viewBox="0 0 520 290" xmlns="http://www.w3.org/2000/svg">
              <line x1="0" y1="72" x2="520" y2="72" stroke="#00F5D4" strokeWidth="0.4" strokeDasharray="4 8" opacity="0.08"/>
              <line x1="0" y1="218" x2="520" y2="218" stroke="#00F5D4" strokeWidth="0.4" strokeDasharray="4 8" opacity="0.08"/>
              <line x1="260" y1="0" x2="260" y2="290" stroke="#FF2D6B" strokeWidth="0.4" strokeDasharray="4 8" opacity="0.06"/>

              {/* Logos Vision (purple) */}
              <ellipse cx="260" cy="145" rx="200" ry="110" fill="none" stroke="#8B5CF6" strokeWidth="0.8" strokeDasharray="400" strokeDashoffset="400" opacity="0.5">
                <animate attributeName="stroke-dashoffset" values="400;0;400" dur="6s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0;0.5;0" dur="6s" repeatCount="indefinite"/>
              </ellipse>
              {/* Pulse (mint) */}
              <ellipse cx="260" cy="145" rx="160" ry="88" fill="none" stroke="#00F5D4" strokeWidth="0.8" strokeDasharray="340" strokeDashoffset="340" opacity="0.5">
                <animate attributeName="stroke-dashoffset" values="340;0;340" dur="6s" begin="1s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0;0.5;0" dur="6s" begin="1s" repeatCount="indefinite"/>
              </ellipse>
              {/* Entomate (crimson) */}
              <ellipse cx="260" cy="145" rx="120" ry="66" fill="none" stroke="#FF2D6B" strokeWidth="1" strokeDasharray="280" strokeDashoffset="280" opacity="0.6">
                <animate attributeName="stroke-dashoffset" values="280;0;280" dur="6s" begin="2s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0;0.6;0" dur="6s" begin="2s" repeatCount="indefinite"/>
              </ellipse>

              {/* Center convergence node */}
              <circle cx="260" cy="145" r="5" fill="#FF2D6B">
                <animate attributeName="r" values="5;12;5" dur="3s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.8;1;0.8" dur="3s" repeatCount="indefinite"/>
              </circle>

              {/* Ripple rings */}
              <circle cx="260" cy="145" r="5" fill="none" stroke="#8B5CF6" strokeWidth="1.2" opacity="0.7">
                <animate attributeName="r" values="5;70" dur="3s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.7;0" dur="3s" repeatCount="indefinite"/>
              </circle>
              <circle cx="260" cy="145" r="5" fill="none" stroke="#00F5D4" strokeWidth="1" opacity="0.5">
                <animate attributeName="r" values="5;70" dur="3s" begin="1s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.5;0" dur="3s" begin="1s" repeatCount="indefinite"/>
              </circle>
              <circle cx="260" cy="145" r="5" fill="none" stroke="#FF2D6B" strokeWidth="0.8" opacity="0.5">
                <animate attributeName="r" values="5;70" dur="3s" begin="2s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.5;0" dur="3s" begin="2s" repeatCount="indefinite"/>
              </circle>

              {/* Product labels */}
              <circle cx="260" cy="35" r="4" fill="#8B5CF6" opacity="0.8">
                <animate attributeName="opacity" values="0.4;0.9;0.4" dur="4s" repeatCount="indefinite"/>
              </circle>
              <text x="260" y="20" textAnchor="middle" fill="#8B5CF6" fontFamily="'JetBrains Mono', monospace" fontSize="9" letterSpacing="0.1em" opacity="0.6">THE MIND</text>

              <circle cx="60" cy="145" r="4" fill="#00F5D4" opacity="0.8">
                <animate attributeName="opacity" values="0.4;0.9;0.4" dur="4s" begin="1.3s" repeatCount="indefinite"/>
              </circle>
              <text x="60" y="132" textAnchor="middle" fill="#00F5D4" fontFamily="'JetBrains Mono', monospace" fontSize="9" letterSpacing="0.1em" opacity="0.6">THE VOICE</text>

              <circle cx="460" cy="145" r="4" fill="#FF2D6B" opacity="0.8">
                <animate attributeName="opacity" values="0.4;0.9;0.4" dur="4s" begin="0.6s" repeatCount="indefinite"/>
              </circle>
              <text x="460" y="132" textAnchor="middle" fill="#FF2D6B" fontFamily="'JetBrains Mono', monospace" fontSize="9" letterSpacing="0.1em" opacity="0.6">THE HANDS</text>

              {/* Traveling particles converging to center */}
              <circle r="2.5" fill="#8B5CF6" opacity="0.8">
                <animate attributeName="cx" values="260;260" dur="3s" repeatCount="indefinite"/>
                <animate attributeName="cy" values="35;145" dur="3s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.8;0" dur="3s" repeatCount="indefinite"/>
                <animate attributeName="r" values="2.5;1" dur="3s" repeatCount="indefinite"/>
              </circle>
              <circle r="2.5" fill="#00F5D4" opacity="0.8">
                <animate attributeName="cx" values="60;260" dur="3s" begin="1s" repeatCount="indefinite"/>
                <animate attributeName="cy" values="145;145" dur="3s" begin="1s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.8;0" dur="3s" begin="1s" repeatCount="indefinite"/>
                <animate attributeName="r" values="2.5;1" dur="3s" begin="1s" repeatCount="indefinite"/>
              </circle>
              <circle r="2.5" fill="#FF2D6B" opacity="0.8">
                <animate attributeName="cx" values="460;260" dur="3s" begin="2s" repeatCount="indefinite"/>
                <animate attributeName="cy" values="145;145" dur="3s" begin="2s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.8;0" dur="3s" begin="2s" repeatCount="indefinite"/>
                <animate attributeName="r" values="2.5;1" dur="3s" begin="2s" repeatCount="indefinite"/>
              </circle>
            </svg>
          </div>

          <div className="trifecto-grid">
            {/* Logos Vision */}
            <div className="trifecto-card">
              <div className="trifecto-icon logos-vision">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Logos Vision">
                  {/* Compass-rose radial strokes */}
                  <g stroke="#22D3EE" strokeWidth="1" strokeLinecap="round">
                    <line x1="12" y1="6.5" x2="12" y2="3.5" />
                    <line x1="16.95" y1="7.05" x2="18.5" y2="5.5" />
                    <line x1="17.5" y1="12" x2="20.5" y2="12" />
                    <line x1="16.95" y1="16.95" x2="18.5" y2="18.5" />
                    <line x1="12" y1="17.5" x2="12" y2="20.5" />
                    <line x1="7.05" y1="16.95" x2="5.5" y2="18.5" />
                    <line x1="6.5" y1="12" x2="3.5" y2="12" />
                    <line x1="7.05" y1="7.05" x2="5.5" y2="5.5" />
                  </g>
                  {/* Corner nodes */}
                  <g fill="#22D3EE">
                    <circle cx="12" cy="2" r="1.3" />
                    <circle cx="19.5" cy="4.5" r="1.3" />
                    <circle cx="22" cy="12" r="1.3" />
                    <circle cx="19.5" cy="19.5" r="1.3" />
                    <circle cx="12" cy="22" r="1.3" />
                    <circle cx="4.5" cy="19.5" r="1.3" />
                    <circle cx="2" cy="12" r="1.3" />
                    <circle cx="4.5" cy="4.5" r="1.3" />
                  </g>
                  {/* Center figure */}
                  <path
                    fill="#22D3EE"
                    fillRule="evenodd"
                    d="M12 17.5a5.5 5.5 0 100-11 5.5 5.5 0 000 11zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm-3 4a1 1 0 011-1h4a1 1 0 011 1v-1.5a2.5 2.5 0 00-5 0V16z"
                  />
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
                <CircuitEMark size={28} />
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
      <section className="guide-section" id="guide">
        <div className="container">
          <div className="guide-section-header">
            <div className="section-label">User Guide</div>
            <h2 className="section-title">Everything you need to know,<br />in one place.</h2>
            <p className="section-sub" style={{ margin: '0 auto', maxWidth: 600, textAlign: 'center' }}>
              {guideSections.length} sections covering every feature in Entomate.
              Click to explore — or sign in for the full interactive guide.
            </p>
          </div>

          {/* Master toggle */}
          <div className="guide-master-toggle">
            <button
              className={`guide-toggle-btn${guideOpen ? ' is-open' : ''}`}
              onClick={() => setGuideOpen(prev => !prev)}
              aria-expanded={guideOpen}
            >
              <span className="guide-toggle-icon">
                <svg width="20" height="20" viewBox="0 0 32 32" fill="none" className="ani-icon">
                  <path d="M6 4 L20 4 L26 10 L26 28 L6 28 Z" stroke="var(--crimson)" strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
                  <path d="M20 4 L20 10 L26 10" stroke="var(--crimson)" strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
                  <line x1="10" y1="16" x2="22" y2="16" stroke="var(--text-muted)" strokeWidth="1.2" strokeLinecap="round"/>
                  <line x1="10" y1="20" x2="19" y2="20" stroke="var(--text-muted)" strokeWidth="1.2" strokeLinecap="round"/>
                  <line x1="10" y1="24" x2="16" y2="24" stroke="var(--text-muted)" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </span>
              <span className="guide-toggle-text">
                {guideOpen ? 'Hide User Guide' : 'Open User Guide'}
              </span>
              <span className="guide-toggle-meta">v{guideVersion} &middot; {guideUpdated}</span>
              <span className={`guide-chevron${guideOpen ? ' is-open' : ''}`}>&rsaquo;</span>
            </button>

            {guideOpen && (
              <div className="guide-expand-controls">
                <button className="guide-ctrl-btn" onClick={expandAllGuide}>Expand All</button>
                <button className="guide-ctrl-btn" onClick={collapseAllGuide}>Collapse All</button>
              </div>
            )}
          </div>

          {/* Collapsible guide body */}
          {guideOpen && (
            <div className="guide-body">
              {CATEGORIES.map((cat, catIdx) => (
                <div key={catIdx} className="guide-category">
                  <button
                    className={`guide-cat-header${openCats.has(catIdx) ? ' is-open' : ''}`}
                    onClick={() => toggleCat(catIdx)}
                    aria-expanded={openCats.has(catIdx)}
                  >
                    <span className="guide-cat-label">{cat.label}</span>
                    <span className="guide-cat-count">{cat.ids.length}</span>
                    <span className={`guide-chevron${openCats.has(catIdx) ? ' is-open' : ''}`}>&rsaquo;</span>
                  </button>

                  {openCats.has(catIdx) && (
                    <div className="guide-cat-body">
                      {cat.ids.map(sectionId => {
                        const section = guideSections.find(s => s.id === sectionId)
                        if (!section) return null
                        const isOpen = openSections.has(sectionId)

                        return (
                          <div key={sectionId} className="guide-entry">
                            <button
                              className={`guide-entry-header${isOpen ? ' is-open' : ''}`}
                              onClick={() => toggleSection(sectionId)}
                              aria-expanded={isOpen}
                            >
                              <span className="guide-entry-icon">{section.icon}</span>
                              <span className="guide-entry-title">{section.title}</span>
                              {section.badge && (
                                <span className={`guide-badge guide-badge--${section.badge === 'New' ? 'new' : 'updated'}`}>
                                  {section.badge}
                                </span>
                              )}
                              <span className={`guide-chevron${isOpen ? ' is-open' : ''}`}>&rsaquo;</span>
                            </button>

                            {isOpen && (
                              <div className="guide-entry-body">
                                <p className="guide-entry-summary">{section.summary}</p>

                                {/* Steps */}
                                {section.steps?.length > 0 && (
                                  <div className="guide-steps">
                                    <div className="guide-steps-label">How to use it</div>
                                    <ol className="guide-step-list">
                                      {section.steps.map((step, i) => (
                                        <li key={i} className="guide-step-item">
                                          <span className="guide-step-num">{i + 1}</span>
                                          <span>{step}</span>
                                        </li>
                                      ))}
                                    </ol>
                                  </div>
                                )}

                                {/* Subsections */}
                                {section.subsections?.length > 0 && (
                                  <div className="guide-subsections">
                                    <div className="guide-steps-label">Features &amp; Details</div>
                                    {section.subsections.map(sub => (
                                      <details key={sub.id} className="guide-sub-detail">
                                        <summary className="guide-sub-summary">{sub.title}</summary>
                                        <div className="guide-sub-body">
                                          {sub.description && <p className="guide-sub-desc">{sub.description}</p>}
                                          <ol className="guide-step-list guide-step-list--sm">
                                            {sub.steps.map((step, i) => (
                                              <li key={i} className="guide-step-item guide-step-item--sm">
                                                <span className="guide-step-num guide-step-num--sm">{i + 1}</span>
                                                <span>{step}</span>
                                              </li>
                                            ))}
                                          </ol>
                                          {sub.note && <div className="guide-note"><IconAlert size={14}/> {sub.note}</div>}
                                        </div>
                                      </details>
                                    ))}
                                  </div>
                                )}

                                {/* Tips */}
                                {section.tips?.length > 0 && (
                                  <div className="guide-tips">
                                    <div className="guide-steps-label">Pro Tips</div>
                                    {section.tips.map((tip, i) => (
                                      <div key={i} className="guide-tip">
                                        <span className="guide-tip-arrow">&rarr;</span>
                                        <span>{tip}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Use cases */}
                                {section.useCases?.length > 0 && (
                                  <div className="guide-subsections">
                                    <div className="guide-steps-label">Use Cases</div>
                                    {section.useCases.map(uc => (
                                      <details key={uc.id} className="guide-sub-detail guide-sub-detail--uc">
                                        <summary className="guide-sub-summary">{uc.title}</summary>
                                        <div className="guide-sub-body">
                                          <p className="guide-sub-desc"><strong>Scenario:</strong> {uc.scenario}</p>
                                          <ol className="guide-step-list guide-step-list--sm">
                                            {uc.steps.map((step, i) => (
                                              <li key={i} className="guide-step-item guide-step-item--sm">
                                                <span className="guide-step-num guide-step-num--sm">{i + 1}</span>
                                                <span>{step}</span>
                                              </li>
                                            ))}
                                          </ol>
                                        </div>
                                      </details>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Link to="/sign-in" className="btn-primary btn-large">
              Full Interactive Guide &rarr;
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
                <Logo variant="mark" size="sm" withText={true} />
              </a>
              <span className="footer-text">The Hands of the Trifecto</span>
            </div>

            <div className="footer-links">
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
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
        .landing-page .guide-entry:hover .ani-icon,
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

        /* Guide note icon */
        .landing-page .guide-note .ani-icon {
          flex-shrink: 0;
          margin-top: 1px;
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
          text-decoration: none;
          transition: filter 300ms ease;
        }

        .landing-page .nav-logo:hover {
          filter: drop-shadow(0 0 12px rgba(255, 45, 107, 0.5));
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

        /* ══════════════════════════════════════════
           HERO — The Hands of the Trifecto
           All animations: GPU-only (transform + opacity)
           ══════════════════════════════════════════ */
        /* ══════════════════════════════════════════════════════════
           HERO — Asymmetric canvas layout (inspired by Pulse)
           Canvas right 65% · Grid overlay · Grain · Gradient fade
           ══════════════════════════════════════════════════════════ */
        .landing-page .hero {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          overflow: hidden;
          background: var(--void, #080808);
        }

        /* Canvas — automation circuit graphic, right 65%, full height */
        .landing-page .hero-circuit-canvas {
          position: absolute;
          top: 0;
          right: 0;
          width: 65%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
        }

        /* Grid overlay — radial mask focuses on the canvas region */
        .landing-page .hero-grid {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 2;
          background-image:
            linear-gradient(rgba(255, 45, 107, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 45, 107, 0.07) 1px, transparent 1px);
          background-size: 52px 52px;
          -webkit-mask-image: radial-gradient(ellipse at 72% 50%, black 25%, transparent 72%);
          mask-image: radial-gradient(ellipse at 72% 50%, black 25%, transparent 72%);
        }

        /* Grain texture overlay — premium organic feel */
        .landing-page .hero-grain-overlay {
          position: absolute;
          inset: 0;
          opacity: 0.32;
          mix-blend-mode: overlay;
          pointer-events: none;
          z-index: 4;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.68' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23g)' opacity='1'/%3E%3C/svg%3E");
          background-size: 180px 180px;
        }

        /* Left gradient fade — text readable against canvas glow */
        .landing-page .hero-fade {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 3;
          background: linear-gradient(90deg,
            var(--void, #080808) 30%,
            rgba(8, 8, 8, 0.82) 50%,
            rgba(8, 8, 8, 0.40) 65%,
            transparent 80%
          );
        }

        /* ── Blur-reveal entrance animation ── */
        @keyframes blur-reveal {
          from { opacity: 0; filter: blur(14px); transform: translateY(22px); }
          to   { opacity: 1; filter: blur(0px);  transform: translateY(0); }
        }
        .landing-page .animate-blur-reveal {
          animation: blur-reveal 0.95s cubic-bezier(0.16, 1, 0.3, 1) both;
          opacity: 0;
        }
        .landing-page .blur-delay-0 { animation-delay: 0.12s; }
        .landing-page .blur-delay-1 { animation-delay: 0.32s; }
        .landing-page .blur-delay-2 { animation-delay: 0.52s; }
        .landing-page .blur-delay-3 { animation-delay: 0.72s; }
        .landing-page .blur-delay-4 { animation-delay: 0.92s; }
        .landing-page .blur-delay-5 { animation-delay: 1.12s; }

        /* ── Hero text content — left column ── */
        .landing-page .hero-content {
          position: relative;
          z-index: 10;
          padding: max(120px, 10vh) 64px 64px;
          max-width: 52%;
          width: 100%;
        }

        .landing-page .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px 6px 10px;
          border: 1px solid rgba(255, 45, 107, 0.28);
          border-radius: 100px;
          background: rgba(255, 255, 255, 0.04);
          -webkit-backdrop-filter: blur(12px);
          backdrop-filter: blur(12px);
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 500;
          color: rgba(255, 45, 107, 0.9);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 28px;
        }

        .landing-page .hero-badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--crimson);
          box-shadow: 0 0 12px var(--crimson);
          animation: hero-dot-pulse 4s ease-in-out infinite;
        }
        @keyframes hero-dot-pulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.35; }
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

        .landing-page .hero h1 .ha-gradient {
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
          max-width: 540px;
          margin-bottom: 40px;
        }

        .landing-page .hero-actions {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        /* ── CTA button — gradient with glow ── */
        .landing-page .hero-cta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 32px;
          border-radius: 12px;
          background: linear-gradient(135deg, #FF2D6B 0%, #FFB800 100%);
          color: #ffffff;
          font-weight: 700;
          font-size: 16px;
          text-decoration: none;
          box-shadow: 0 8px 32px rgba(255, 45, 107, 0.35);
          transition: all 0.2s ease;
        }
        .landing-page .hero-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 40px rgba(255, 45, 107, 0.50);
        }
        .landing-page .hero-cta:active {
          transform: scale(0.97);
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

        /* ── Floating workflow nodes over canvas ── */
        .landing-page .hero-wf-nodes {
          position: absolute;
          top: 0;
          right: 0;
          width: 65%;
          height: 100%;
          pointer-events: none;
          z-index: 12;
        }

        .landing-page .wf-node {
          position: absolute;
          border-radius: var(--radius-md);
          padding: 8px 14px;
          font-size: 10px;
          font-weight: 600;
          font-family: var(--font-mono);
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          border: 1px solid;
          z-index: 15;
          opacity: 0.85;
          transition: opacity 0.3s ease;
        }

        .landing-page .wf-node.trigger {
          background: rgba(20, 8, 12, 0.88);
          border-color: rgba(255, 45, 107, 0.35);
          color: var(--crimson);
        }

        .landing-page .wf-node.action {
          background: rgba(8, 16, 14, 0.88);
          border-color: rgba(0, 245, 212, 0.25);
          color: var(--mint);
        }

        .landing-page .wf-node.ai {
          background: rgba(16, 14, 8, 0.88);
          border-color: rgba(255, 184, 0, 0.25);
          color: var(--amber);
        }

        .landing-page .wf-node-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .landing-page .trigger .wf-node-dot  { background: var(--crimson); box-shadow: 0 0 8px var(--crimson); }
        .landing-page .action .wf-node-dot   { background: var(--mint); box-shadow: 0 0 8px var(--mint); }
        .landing-page .ai .wf-node-dot       { background: var(--amber); box-shadow: 0 0 8px var(--amber); }

        .landing-page .wf-node-hero-trigger { top: 18%; left: 15%; }
        .landing-page .wf-node-hero-ai      { top: 40%; right: 12%; left: auto; }
        .landing-page .wf-node-hero-action   { bottom: 22%; right: 20%; left: auto; }

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

        /* Trifecto neural animation */
        .landing-page .trifecto-neural {
          position: relative;
          width: 100%;
          max-width: 520px;
          margin: 0 auto 60px;
          aspect-ratio: 16 / 9;
        }
        .landing-page .trifecto-neural svg {
          width: 100%;
          height: 100%;
        }
        .landing-page .trifecto-neural-glow {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: radial-gradient(ellipse at center,
            rgba(255, 45, 107, 0.08) 0%,
            rgba(0, 245, 212, 0.04) 40%,
            transparent 70%
          );
          pointer-events: none;
          animation: trifecto-glow-pulse 4s ease-in-out infinite;
        }
        @keyframes trifecto-glow-pulse {
          0%, 100% { opacity: 0.6; }
          50%      { opacity: 1; }
        }

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

        /* ── USER GUIDE SECTION ── */
        .landing-page .guide-section {
          padding: 120px 0;
          position: relative;
        }

        .landing-page .guide-section-header {
          text-align: center;
          margin-bottom: 48px;
        }

        /* Master toggle button */
        .landing-page .guide-master-toggle {
          max-width: 900px;
          margin: 0 auto 24px;
        }

        .landing-page .guide-toggle-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px 24px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          cursor: pointer;
          transition: all 200ms ease;
          font-family: var(--font-body);
          text-align: left;
        }

        .landing-page .guide-toggle-btn:hover {
          border-color: var(--border-glow);
          background: var(--elevated);
        }

        .landing-page .guide-toggle-btn.is-open {
          border-color: rgba(255, 45, 107, 0.30);
          background: var(--elevated);
          border-radius: var(--radius-xl) var(--radius-xl) 0 0;
        }

        .landing-page .guide-toggle-icon {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          background: rgba(255, 45, 107, 0.10);
          border: 1px solid rgba(255, 45, 107, 0.20);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .landing-page .guide-toggle-text {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
          flex: 1;
          font-family: var(--font-display);
          letter-spacing: -0.01em;
        }

        .landing-page .guide-toggle-meta {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-muted);
          letter-spacing: 0.04em;
        }

        .landing-page .guide-expand-controls {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 8px 16px;
          background: var(--elevated);
          border-left: 1px solid var(--border);
          border-right: 1px solid var(--border);
          border-color: rgba(255, 45, 107, 0.30);
        }

        .landing-page .guide-ctrl-btn {
          padding: 4px 12px;
          font-size: 11px;
          font-weight: 600;
          font-family: var(--font-mono);
          color: var(--text-muted);
          background: transparent;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all 150ms ease;
        }

        .landing-page .guide-ctrl-btn:hover {
          color: var(--crimson);
          border-color: rgba(255, 45, 107, 0.3);
        }

        /* Chevron */
        .landing-page .guide-chevron {
          font-size: 20px;
          font-weight: 600;
          color: var(--text-muted);
          transition: transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
          flex-shrink: 0;
          line-height: 1;
        }

        .landing-page .guide-chevron.is-open {
          transform: rotate(90deg);
          color: var(--crimson);
        }

        /* Guide body */
        .landing-page .guide-body {
          max-width: 900px;
          margin: 0 auto;
          background: var(--surface);
          border: 1px solid rgba(255, 45, 107, 0.30);
          border-top: none;
          border-radius: 0 0 var(--radius-xl) var(--radius-xl);
          overflow: hidden;
          animation: guide-slide-in 300ms ease;
        }

        @keyframes guide-slide-in {
          from { opacity: 0; max-height: 0; }
          to   { opacity: 1; max-height: 5000px; }
        }

        /* Category */
        .landing-page .guide-category {
          border-bottom: 1px solid var(--border);
        }

        .landing-page .guide-category:last-child {
          border-bottom: none;
        }

        .landing-page .guide-cat-header {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 24px;
          background: transparent;
          border: none;
          cursor: pointer;
          font-family: var(--font-body);
          transition: background 150ms ease;
        }

        .landing-page .guide-cat-header:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .landing-page .guide-cat-header.is-open {
          background: rgba(255, 45, 107, 0.04);
        }

        .landing-page .guide-cat-label {
          font-family: var(--font-display);
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          flex: 1;
          text-align: left;
        }

        .landing-page .guide-cat-count {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          color: var(--crimson);
          padding: 2px 8px;
          background: rgba(255, 45, 107, 0.08);
          border-radius: 100px;
        }

        /* Category body */
        .landing-page .guide-cat-body {
          padding: 0 12px 12px;
          animation: guide-slide-in 200ms ease;
        }

        /* Section entry */
        .landing-page .guide-entry {
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          margin-bottom: 6px;
          overflow: hidden;
          transition: border-color 200ms ease;
        }

        .landing-page .guide-entry:hover {
          border-color: rgba(255, 255, 255, 0.12);
        }

        .landing-page .guide-entry-header {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: transparent;
          border: none;
          cursor: pointer;
          font-family: var(--font-body);
          transition: background 150ms ease;
        }

        .landing-page .guide-entry-header:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .landing-page .guide-entry-header.is-open {
          background: rgba(255, 45, 107, 0.04);
          border-bottom: 1px solid var(--border);
        }

        .landing-page .guide-entry-icon {
          font-size: 18px;
          width: 28px;
          text-align: center;
          flex-shrink: 0;
        }

        .landing-page .guide-entry-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          flex: 1;
          text-align: left;
        }

        .landing-page .guide-badge {
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 2px 8px;
          border-radius: 100px;
        }

        .landing-page .guide-badge--new {
          background: rgba(0, 245, 212, 0.12);
          color: var(--mint);
          border: 1px solid rgba(0, 245, 212, 0.25);
        }

        .landing-page .guide-badge--updated {
          background: rgba(255, 184, 0, 0.12);
          color: var(--amber);
          border: 1px solid rgba(255, 184, 0, 0.25);
        }

        /* Entry body */
        .landing-page .guide-entry-body {
          padding: 16px 20px;
          animation: guide-slide-in 200ms ease;
        }

        .landing-page .guide-entry-summary {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.7;
          margin-bottom: 20px;
          padding-left: 38px;
        }

        .landing-page .guide-steps-label {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--crimson);
          margin-bottom: 10px;
          padding-left: 38px;
        }

        .landing-page .guide-step-list {
          list-style: none;
          margin: 0 0 20px;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding-left: 38px;
        }

        .landing-page .guide-step-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        .landing-page .guide-step-num {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(255, 45, 107, 0.10);
          border: 1px solid rgba(255, 45, 107, 0.20);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          color: var(--crimson);
          flex-shrink: 0;
          margin-top: 1px;
        }

        .landing-page .guide-step-list--sm { padding-left: 0; }

        .landing-page .guide-step-item--sm { font-size: 12px; }

        .landing-page .guide-step-num--sm {
          width: 18px;
          height: 18px;
          font-size: 9px;
        }

        /* Subsection <details> */
        .landing-page .guide-sub-detail {
          margin-left: 38px;
          margin-bottom: 6px;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          overflow: hidden;
          transition: border-color 150ms ease;
        }

        .landing-page .guide-sub-detail:hover {
          border-color: rgba(255, 255, 255, 0.12);
        }

        .landing-page .guide-sub-detail[open] {
          border-color: rgba(255, 45, 107, 0.20);
        }

        .landing-page .guide-sub-detail--uc {
          border-color: rgba(139, 92, 246, 0.15);
        }

        .landing-page .guide-sub-detail--uc[open] {
          border-color: rgba(139, 92, 246, 0.30);
        }

        .landing-page .guide-sub-summary {
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          cursor: pointer;
          transition: background 150ms ease;
          list-style: none;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .landing-page .guide-sub-summary::-webkit-details-marker { display: none; }

        .landing-page .guide-sub-summary::before {
          content: '\\25B8';
          color: var(--crimson);
          font-size: 11px;
          transition: transform 200ms ease;
        }

        .landing-page .guide-sub-detail[open] > .guide-sub-summary::before {
          transform: rotate(90deg);
        }

        .landing-page .guide-sub-summary:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .landing-page .guide-sub-body {
          padding: 12px 14px 14px;
          border-top: 1px solid var(--border);
        }

        .landing-page .guide-sub-desc {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: 10px;
        }

        .landing-page .guide-note {
          font-size: 12px;
          color: var(--amber);
          padding: 8px 12px;
          background: rgba(255, 184, 0, 0.06);
          border: 1px solid rgba(255, 184, 0, 0.15);
          border-radius: var(--radius-sm);
          margin-top: 10px;
          display: flex;
          align-items: flex-start;
          gap: 8px;
          line-height: 1.5;
        }

        /* Tips */
        .landing-page .guide-tips {
          padding-left: 38px;
          margin-bottom: 16px;
        }

        .landing-page .guide-tip {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.6;
          padding: 4px 0;
        }

        .landing-page .guide-tip-arrow {
          color: var(--mint);
          font-family: var(--font-mono);
          flex-shrink: 0;
          margin-top: 1px;
        }

        /* Subsections container */
        .landing-page .guide-subsections {
          margin-bottom: 16px;
        }

        .landing-page .guide-subsections .guide-steps-label {
          margin-bottom: 8px;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .landing-page .guide-toggle-meta { display: none; }
          .landing-page .guide-entry-body { padding: 12px; }
          .landing-page .guide-entry-summary,
          .landing-page .guide-steps-label,
          .landing-page .guide-step-list,
          .landing-page .guide-tips { padding-left: 0; }
          .landing-page .guide-sub-detail { margin-left: 0; }
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

        /* (old hero node positions removed — now in main hero CSS block) */

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
          .landing-page .trifecto-neural { max-width: 320px; margin-bottom: 40px; }
          .landing-page .hero-circuit-canvas { width: 100%; opacity: 0.3; }
          .landing-page .hero-fade { background: linear-gradient(180deg, var(--void, #080808) 10%, rgba(8,8,8,0.60) 40%, transparent 70%); }
          .landing-page .hero-content { max-width: 100%; padding: 10vh 32px 48px; }
          .landing-page .hero-wf-nodes { display: none; }
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
