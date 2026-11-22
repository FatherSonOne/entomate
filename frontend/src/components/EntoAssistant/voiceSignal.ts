/**
 * voiceSignal — the one place the assistant's live "voice" state lives.
 *
 * Two renderers read it every animation frame: the orb in the panel and the dot
 * matrix in the sidebar launcher. Neither of them owns the state — the panel does
 * (it knows when the mic is open, when a turn is thinking, when text is streaming
 * back). The panel is lazy-loaded and the launcher lives in Sidebar, so threading
 * this through props would mean a detour through AppInner for a value that changes
 * sixty times a second. A module singleton is the honest shape: writers set, readers
 * read on their own rAF, and React only hears about the coarse state changes.
 *
 * `level` and `pulse` are deliberately NOT React state. `level` is the microphone
 * RMS written per frame by useMicLevel; `pulse` is a timestamp stamped each time a
 * streaming chunk lands, decayed by the reader, so two renderers never double-decay.
 *
 * The voice-on-open intent lives here too: the launcher's mic glyph asks for the
 * mic before the panel has mounted (first open pays the chunk download). The
 * request parks until a listener subscribes, then fires exactly once.
 */
import { useSyncExternalStore } from 'react';

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface VoiceSignal {
  state: VoiceState;
  /** Microphone RMS, 0–1, smoothed. Only meaningful while `state === 'listening'`. */
  level: number;
  /** performance.now() of the last streaming chunk; readers derive a decaying pulse. */
  pulseAt: number;
}

const signal: VoiceSignal = { state: 'idle', level: 0, pulseAt: -Infinity };
const stateListeners = new Set<() => void>();

const emit = () => stateListeners.forEach((fn) => fn());

export const getVoiceSignal = (): Readonly<VoiceSignal> => signal;

export function setVoiceState(next: VoiceState): void {
  if (signal.state === next) return;
  signal.state = next;
  if (next !== 'listening') signal.level = 0;
  emit();
}

/** Per-frame writer — no React notification on purpose. */
export function setVoiceLevel(level: number): void {
  signal.level = level < 0 ? 0 : level > 1 ? 1 : level;
}

/** Stamp a "the assistant just said something" beat. */
export function pulseVoice(): void {
  signal.pulseAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Decaying 0–1 read of the last pulse. ~180ms half-life reads as speech cadence. */
export function readPulse(now: number): number {
  const age = now - signal.pulseAt;
  if (!(age >= 0)) return 0;
  return Math.exp(-age / 260);
}

export function subscribeVoiceState(fn: () => void): () => void {
  stateListeners.add(fn);
  return () => {
    stateListeners.delete(fn);
  };
}

/** React binding for the coarse state — used to set data-state on the launcher. */
export function useVoiceState(): VoiceState {
  return useSyncExternalStore(subscribeVoiceState, () => signal.state, () => 'idle');
}

// ---------------------------------------------------------------------------
// Voice-on-open intent
// ---------------------------------------------------------------------------

let pendingVoice = false;
const voiceRequestListeners = new Set<() => void>();

/**
 * Ask the panel to start listening as soon as it can. If a panel is already
 * mounted and subscribed it starts now; otherwise the request waits for the
 * first subscriber and is consumed by it.
 */
export function requestVoiceOnOpen(): void {
  if (voiceRequestListeners.size > 0) {
    pendingVoice = false;
    voiceRequestListeners.forEach((fn) => fn());
    return;
  }
  pendingVoice = true;
}

export function onVoiceRequest(fn: () => void): () => void {
  voiceRequestListeners.add(fn);
  // A parked request fires a tick later, on the mount that stays. StrictMode mounts the panel
  // twice; firing at once started dictation on the first mount, and its close cleanup aborted it.
  const parked = pendingVoice
    ? setTimeout(() => {
        if (!pendingVoice) return; // a newer request already reached this listener
        pendingVoice = false;
        fn();
      }, 0)
    : undefined;
  return () => {
    clearTimeout(parked);
    voiceRequestListeners.delete(fn);
  };
}
