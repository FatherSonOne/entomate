/**
 * EntoAssistantButton — Sidebar button for the AI assistant
 * Uses the Entomate Circuit E logo mark with animations,
 * hover effects, and press/depress tactile feedback
 */
import React, { useState } from 'react'
import { getModKey } from '../../hooks/useKeyboardShortcuts'

// ── Inline Circuit E Mark (from Logo.jsx, scaled for 16×16 icon space) ──
function CircuitEIcon({ isOpen, isHovered, isPressed }) {
  const baseColor = isOpen ? '#FF2D6B' : (isHovered ? '#FF2D6B' : 'currentColor')
  const nodeOpacity = isOpen ? 1 : (isHovered ? 0.9 : 0.7)
  const traceOpacity = isOpen ? 0.8 : (isHovered ? 0.7 : 0.5)

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{
        transition: 'transform 220ms cubic-bezier(.34,1.56,.64,1), filter 220ms ease',
        transform: isPressed
          ? 'scale(0.85)'
          : isHovered
            ? 'scale(1.18) rotate(-4deg)'
            : 'scale(1)',
        filter: isOpen
          ? 'drop-shadow(0 0 6px rgba(255,45,107,0.5))'
          : isHovered
            ? 'drop-shadow(0 0 4px rgba(255,45,107,0.35))'
            : 'none',
      }}
    >
      {/* Three E bars */}
      <rect x="22" y="14" width="26" height="6" rx="1.5" fill={baseColor}>
        {isHovered && !isPressed && (
          <animate attributeName="width" values="26;28;26" dur="0.6s" begin="0s" repeatCount="1" />
        )}
      </rect>
      <rect x="22" y="29" width="20" height="6" rx="1.5" fill={baseColor} opacity="0.85">
        {isHovered && !isPressed && (
          <animate attributeName="width" values="20;23;20" dur="0.6s" begin="0.08s" repeatCount="1" />
        )}
      </rect>
      <rect x="22" y="44" width="26" height="6" rx="1.5" fill={baseColor}>
        {isHovered && !isPressed && (
          <animate attributeName="width" values="26;28;26" dur="0.6s" begin="0.16s" repeatCount="1" />
        )}
      </rect>

      {/* Circuit traces (left side) */}
      <path d="M22 17 L14 17 L10 13" stroke={baseColor} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity={traceOpacity} />
      <circle cx="10" cy="13" r="2" fill={baseColor} opacity={nodeOpacity}>
        {isOpen && <animate attributeName="r" values="2;2.8;2" dur="2.2s" repeatCount="indefinite" />}
      </circle>

      <path d="M22 32 L12 32 L8 28" stroke={baseColor} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity={traceOpacity} />
      <circle cx="8" cy="28" r="2" fill={baseColor} opacity={nodeOpacity}>
        {isOpen && <animate attributeName="r" values="2;2.8;2" dur="2.2s" begin="0.7s" repeatCount="indefinite" />}
      </circle>

      <path d="M22 47 L14 47 L10 51" stroke={baseColor} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity={traceOpacity} />
      <circle cx="10" cy="51" r="2" fill={baseColor} opacity={nodeOpacity}>
        {isOpen && <animate attributeName="r" values="2;2.8;2" dur="2.2s" begin="1.4s" repeatCount="indefinite" />}
      </circle>

      {/* Extra node on top bar */}
      <path d="M22 14 L18 10" stroke={baseColor} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity={traceOpacity * 0.8} />
      <circle cx="18" cy="10" r="1.5" fill={baseColor} opacity={traceOpacity * 0.8} />
    </svg>
  )
}

export default function EntoAssistantButton({ onClick, isOpen, hasProactiveSuggestion }) {
  const [isHovered, setIsHovered] = useState(false)
  const [isPressed, setIsPressed] = useState(false)

  return (
    <button
      onClick={onClick}
      data-icon="entomate-ai"
      className={`nl-item ${isOpen ? 'active' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsPressed(false) }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      style={{
        cursor: 'pointer',
        border: 'none',
        width: '100%',
        textAlign: 'left',
        background: 'none',
        transform: isPressed
          ? 'translateX(0px) scale(0.97)'
          : undefined,
        transition: 'all 180ms cubic-bezier(.4,0,.2,1)',
      }}
      title={`Entomate AI (${getModKey()}/)`}
    >
      <span
        className="nl-icon-box"
        style={{
          position: 'relative',
          background: isOpen
            ? 'rgba(255,45,107,0.14)'
            : isHovered
              ? 'rgba(255,45,107,0.08)'
              : undefined,
          boxShadow: isOpen
            ? '0 0 10px rgba(255,45,107,0.2)'
            : undefined,
          transition: 'background 180ms ease, box-shadow 180ms ease',
        }}
      >
        <CircuitEIcon isOpen={isOpen} isHovered={isHovered} isPressed={isPressed} />
        {hasProactiveSuggestion && !isOpen && (
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#00F5D4',
              border: '1.5px solid var(--bg0, #060606)',
              boxShadow: '0 0 6px rgba(0,245,212,0.5)',
              animation: 'eaProactivePulse 2s ease-in-out infinite',
            }}
          />
        )}
      </span>

      <span
        style={{
          color: isOpen ? 'var(--accent-primary, #FF2D6B)' : undefined,
          fontWeight: isOpen ? 600 : undefined,
          transition: 'color 180ms ease, font-weight 180ms ease',
        }}
      >
        Entomate AI
      </span>

      <span
        style={{
          fontSize: 10,
          fontWeight: 500,
          padding: '1px 6px',
          borderRadius: 4,
          background: isHovered
            ? 'rgba(255,45,107,0.1)'
            : 'var(--b0)',
          color: isHovered
            ? 'var(--accent-primary, #FF2D6B)'
            : 'var(--text-muted, var(--t2))',
          marginLeft: 'auto',
          fontFamily: 'monospace',
          letterSpacing: '0.02em',
          transition: 'background 180ms ease, color 180ms ease',
        }}
      >
        {getModKey()}/
      </span>

      <style>{`
        @keyframes eaProactivePulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.35); opacity: 0.7; }
        }
      `}</style>
    </button>
  )
}
