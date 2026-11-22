/**
 * Composer — the assistant's input card: status orb, auto-growing textarea, one action button.
 *
 * Adapted from the PromptInput design (ai-chat-input). The orb sits inside the card so the
 * agent's state always has one fixed place to show. The single action button morphs with the
 * draft: a mic when it is empty, send once there is text, stop while dictation runs.
 * Presentational only; the parent owns `input` and decides what sending means.
 */
import React, { useLayoutEffect } from 'react';
import { ArrowUp, Mic, Square } from 'lucide-react';
import { AiOrb, type AiOrbState } from './AiOrb';

/** The textarea grows to this height, then scrolls. */
const MAX_INPUT_PX = 160;

interface ComposerProps {
  inputRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  disabled: boolean;
  isListening: boolean;
  onVoiceInput: () => void;
  onSend: () => void;
  orbState: AiOrbState;
}

const Composer: React.FC<ComposerProps> = ({
  inputRef,
  value,
  onChange,
  onKeyDown,
  placeholder,
  disabled,
  isListening,
  onVoiceInput,
  onSend,
  orbState,
}) => {
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_PX)}px`;
  }, [value, inputRef]);

  const mode = isListening ? 'stop' : value.trim() ? 'send' : 'mic';
  const action = {
    stop: { label: 'Stop listening', className: 'la-voice-btn la-voice-btn-active', icon: <Square size={12} fill="currentColor" />, run: onVoiceInput },
    send: { label: 'Send message', className: 'la-send-btn', icon: <ArrowUp size={17} />, run: onSend },
    mic: { label: 'Voice input', className: 'la-voice-btn', icon: <Mic size={16} />, run: onVoiceInput },
  }[mode];

  return (
    <div className="la-input-area">
      <div className="la-input-wrapper">
        <AiOrb state={orbState} />
        <textarea
          ref={inputRef}
          className="la-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          aria-label="Message input"
        />
        <button
          type="button"
          className={`${action.className} la-action-morph`}
          data-mode={mode}
          onClick={action.run}
          disabled={disabled}
          title={action.label}
          aria-label={action.label}
        >
          <span key={mode} className="la-action-icon">{action.icon}</span>
        </button>
      </div>
      {/* Mounted always: CSS reveals it only while there is text to send (U6). */}
      <div className="la-input-hints">
        <span>Enter to send</span>
        <span>Shift+Enter for new line</span>
      </div>
    </div>
  );
};

export default Composer;
