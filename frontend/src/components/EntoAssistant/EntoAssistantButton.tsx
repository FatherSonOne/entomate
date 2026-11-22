import React, { useEffect } from 'react';
import { Mic } from 'lucide-react';
import useReducedMotion from '../landing/useReducedMotion';
import { EntoOrb } from './EntoOrb';
import { LauncherTourOrb } from './AiOrb';
import { DotMatrix } from './DotMatrix';
import { useVoiceState, type VoiceState } from './voiceSignal';
import './EntoAssistantButton.css';
import './EntoAI.tokens.css';

/* Ported from Logos AI's LogosAssistantButton (EAI-02a). Same markup and CSS; the
   name is Entomate AI, and the chunk prefetch is local (Entomate has no assistantChunk). */

const ASSISTANT_NAME = 'Entomate AI';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EntoAssistantButtonProps {
  onClick: () => void;
  /**
   * The square mic beside the dot field. Opens the panel if it is closed and
   * asks it to start (or stop) listening — voice is a first-class entry point,
   * which is what earns the launcher its different look from the nav rows.
   */
  onVoice: () => void;
  isOpen: boolean;
  /** Count of proactive items waiting. */
  proactiveCount?: number;
  collapsed?: boolean;
  shortcutsRevealed?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
const shortcutLabel = isMac ? '⌘/' : 'Ctrl+/';

/** The word row 1 shows while a voice state holds. "Speaking" reads as the person, so the
    assistant's turn is called Answering. */
export const VOICE_WORD: Record<Exclude<VoiceState, 'idle'>, string> = {
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Answering',
};

// ---------------------------------------------------------------------------
// Chunk prefetch (perf)
// ---------------------------------------------------------------------------

/** Warm the lazy panel chunk on intent (hover, focus) or once the app is idle; fetched at most once. */
let assistantChunkPrefetched = false;
function prefetchAssistantChunk(): void {
  if (assistantChunkPrefetched) return;
  assistantChunkPrefetched = true;
  import('./EntoAssistant').catch(() => {
    assistantChunkPrefetched = false;
  });
}
function prefetchAssistantChunkWhenIdle(): () => void {
  if ('requestIdleCallback' in window) {
    const id = requestIdleCallback(prefetchAssistantChunk, { timeout: 4000 });
    return () => cancelIdleCallback(id);
  }
  const timer = setTimeout(prefetchAssistantChunk, 3500);
  return () => clearTimeout(timer);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * The launcher is an instrument, not a nav row:
 *
 *   [orb] Entomate AI  1 WAITING        Ctrl /
 *   ·········· voice field ··········  [mic]
 *
 * Row 1 names it and says what holds: the voice state's word while one holds, else
 * how many items wait. Row 2 is the dot field and a square mic that fills with the
 * voice colour. The orb and the field both read voiceSignal, so the instrument moves
 * with the user's voice while the panel listens and beats while the assistant answers.
 * The collapsed rail stacks the same parts: orb, count, a short field, the mic.
 */
export const EntoAssistantButton: React.FC<EntoAssistantButtonProps> = ({
  onClick,
  onVoice,
  isOpen,
  proactiveCount = 0,
  collapsed = false,
  shortcutsRevealed = false,
}) => {
  // The count rides the launcher in both rail modes; the items themselves are inside the panel.
  const hasCount = proactiveCount > 0 && !isOpen;
  const countText = proactiveCount > 99 ? '99+' : String(proactiveCount);
  const voiceState = useVoiceState();
  const listening = voiceState === 'listening';
  const reduceMotion = useReducedMotion();
  // No speech recognition (Firefox, for one): a mic here would only open the panel to an error.
  const canListen = typeof window !== 'undefined'
    && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  // Touch users never hover and keyboard users can jump straight to the shortcut,
  // so warm the panel chunk once the app is idle after boot.
  useEffect(() => prefetchAssistantChunkWhenIdle(), []);

  return (
    <div
      className={
        'la-launcher ' +
        (isOpen ? 'active ' : '') +
        (collapsed ? 'collapsed ' : '') +
        (canListen ? 'has-mic ' : '') +
        (shortcutsRevealed ? 'shortcuts-revealed' : '')
      }
      data-voice={voiceState}
    >
      <button
        type="button"
        className="la-launcher-main"
        onClick={onClick}
        // Prefetch the panel's lazy chunk on intent so the click opens instantly.
        onMouseEnter={prefetchAssistantChunk}
        onFocus={prefetchAssistantChunk}
        title={collapsed ? `${ASSISTANT_NAME} (${shortcutLabel})` : undefined}
        aria-label={
          hasCount
            ? `Open ${ASSISTANT_NAME}; ${proactiveCount} ${proactiveCount === 1 ? 'item needs' : 'items need'} your attention`
            : `${isOpen ? 'Close' : 'Open'} ${ASSISTANT_NAME}`
        }
        aria-expanded={isOpen}
      >
        {collapsed ? (
          <>
            <span className="la-launcher-orb">
              {/* At rest the orb tours the thinking-orb looks; voice and reduced motion keep EntoOrb. */}
              {voiceState === 'idle' && !reduceMotion ? <LauncherTourOrb size={24} /> : <EntoOrb size={24} />}
            </span>
            {hasCount ? (
              <span className="la-launcher-count" aria-hidden="true">{countText}</span>
            ) : null}
            <span className="la-launcher-field">
              <DotMatrix rows={3} pitch={6} />
            </span>
          </>
        ) : (
          <>
            <span className="la-launcher-row">
              <span className="la-launcher-orb">
                {voiceState === 'idle' && !reduceMotion ? <LauncherTourOrb size={22} /> : <EntoOrb size={22} />}
              </span>
              <span className="la-btn-label">{ASSISTANT_NAME}</span>
              {/* The button's aria-label already says all of this. */}
              {voiceState !== 'idle' ? (
                <span className="la-launcher-word la-launcher-word--voice" aria-hidden="true">
                  <i />
                  {VOICE_WORD[voiceState]}
                </span>
              ) : hasCount ? (
                <span className="la-launcher-word la-launcher-word--waits" aria-hidden="true">
                  {countText} waiting
                </span>
              ) : null}
              {/* Only on hover, focus or the "?" shortcuts overlay. */}
              <span className="la-btn-shortcut">{shortcutLabel}</span>
            </span>
            <span className="la-launcher-field">
              <DotMatrix rows={6} pitch={6} />
            </span>
          </>
        )}
      </button>

      {canListen && (
        <button
          type="button"
          className="la-launcher-mic"
          onClick={onVoice}
          onMouseEnter={prefetchAssistantChunk}
          onFocus={prefetchAssistantChunk}
          title={listening ? 'Stop listening' : `Talk to ${ASSISTANT_NAME}`}
          aria-label={listening ? 'Stop listening' : `Talk to ${ASSISTANT_NAME}`}
          aria-pressed={listening}
        >
          <Mic size={collapsed ? 14 : 16} />
        </button>
      )}
    </div>
  );
};

export default EntoAssistantButton;
