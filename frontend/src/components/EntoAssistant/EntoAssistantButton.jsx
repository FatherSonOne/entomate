/**
 * EntoAssistantButton — Sidebar launcher for the AI assistant
 *
 * EAI-02: the Logos AI launcher instrument (EntoAssistantButton.css), keeping the
 * Entomate mark in the orb slot:
 *
 *   [mark] Entomate AI   NEW          Ctrl /
 *   ·········· dot field (voiceSignal) ·········
 *
 * The dot field shimmers at rest and beats while the panel thinks and answers.
 * No mic yet — voice input arrives with EAI-06.
 */
import React from 'react'
import { EntomateMark } from '../Logo'
import { getModKey } from '../../hooks/useKeyboardShortcuts'
import { DotMatrix } from './DotMatrix'
import { useVoiceState } from './voiceSignal'
import './EntoAssistantButton.css'
import './EntoAI.tokens.css'

const VOICE_WORD = { thinking: 'Thinking', speaking: 'Answering' }

// Warm the lazy panel chunk on intent, so the click opens without the skeleton.
const prefetchPanel = () => { import('./EntoAssistant') }

export default function EntoAssistantButton({ onClick, isOpen, hasProactiveSuggestion }) {
  const voiceState = useVoiceState()
  const shortcut = `${getModKey()}/`
  const showNew = hasProactiveSuggestion && !isOpen

  return (
    <div className={`la-launcher ${isOpen ? 'active' : ''}`} data-voice={voiceState}>
      <button
        type="button"
        className="la-launcher-main"
        onClick={onClick}
        onMouseEnter={prefetchPanel}
        onFocus={prefetchPanel}
        aria-label={showNew ? 'Open Entomate AI; a suggestion is waiting' : `${isOpen ? 'Close' : 'Open'} Entomate AI`}
        aria-expanded={isOpen}
        title={`Entomate AI (${shortcut})`}
      >
        <span className="la-launcher-row">
          <span className="la-launcher-orb">
            <EntomateMark size={22} alt="" />
          </span>
          <span className="la-btn-label">Entomate AI</span>
          {VOICE_WORD[voiceState] ? (
            <span className="la-launcher-word la-launcher-word--voice" aria-hidden="true">
              <i />
              {VOICE_WORD[voiceState]}
            </span>
          ) : showNew ? (
            <span className="la-launcher-word la-launcher-word--waits" aria-hidden="true">New</span>
          ) : null}
          <span className="la-btn-shortcut">{shortcut}</span>
        </span>
        <span className="la-launcher-field">
          <DotMatrix rows={6} pitch={6} />
        </span>
      </button>
    </div>
  )
}
