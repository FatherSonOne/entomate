/**
 * EntoAssistantButton — Sidebar button for the AI assistant
 * Uses the Entomate Aperture logo mark with
 * hover effects, and press/depress tactile feedback
 */
import React, { useState } from 'react'
import { EntomateMark } from '../Logo'
import { getModKey } from '../../hooks/useKeyboardShortcuts'

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
        <EntomateMark size={18} alt="" />
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
