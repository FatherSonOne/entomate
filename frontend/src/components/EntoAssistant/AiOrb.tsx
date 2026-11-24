/**
 * AiOrb — the composer's status orb: eleven agent states drawn with the vendored thinking orb.
 * WelcomeOrb — the welcome hero: the same orb, large, touring every look while Logos is at rest.
 * LauncherTourOrb — the sidebar launcher's orb at rest: the same tour, small, without the warning shapes.
 *
 * Adapted from the ai-orb component (over thinking-orbs) to the orb already vendored at
 * ui/thinking-orbs (U8), so no new dependency. `orbStateFor` is pure and unit-tested; the
 * tint comes from CSS (`.la-ai-orb[data-state]`), so the Logos tokens own every colour.
 */
import React, { useEffect, useState } from 'react';
import { useReducedMotion } from '../bench/motion';
import { Orb, VARIANTS, type OrbLook } from '../ui/thinking-orbs';
/** Tool steps arrive with the function-calling loop (EAI-04); until then the list is empty. */
type ToolStep = { status: 'running' | 'done' | 'error' };

export type AiOrbState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'reasoning'
  | 'tool-call'
  | 'tool-result'
  | 'streaming'
  | 'retrying'
  | 'waiting-approval'
  | 'error'
  | 'done';

export const AI_ORB_LABELS: Record<AiOrbState, string> = {
  idle: 'Ready',
  listening: 'Listening',
  thinking: 'Thinking',
  reasoning: 'Reasoning',
  'tool-call': 'Using a tool',
  'tool-result': 'Reading results',
  streaming: 'Writing',
  retrying: 'Retrying',
  'waiting-approval': 'Waiting for your approval',
  error: 'Something went wrong',
  done: 'Done',
};

/**
 * Whether the panel header shows its status word. It speaks while context loads, while Entomate
 * listens or works on an answer (typed or spoken), when it is done, and on an error; otherwise
 * it fades and keeps its place. Typing alone reads "listening" on the orb but stays quiet here,
 * so the word does not flicker with every key.
 */
export function headerStatusShown(s: { contextLoading: boolean; voiceState: string; orbState: AiOrbState }): boolean {
  return s.contextLoading || s.voiceState !== 'idle' || s.orbState === 'error' || s.orbState === 'done';
}

const LOOKS: Record<AiOrbState, OrbLook> = {
  idle: {},
  listening: { state: 'waiting' },
  thinking: { state: 'working' },
  reasoning: { state: 'reasoning' },
  'tool-call': { state: 'searching' },
  'tool-result': { state: 'working', variant: 'gyro' },
  streaming: { state: 'background', variant: 'spiral' },
  retrying: { state: 'retrying' },
  'waiting-approval': { state: 'waiting' },
  error: { state: 'retrying', variant: 'surge' },
  done: {},
};

/** Only an error holds still; at rest the orb keeps its slow base spin (Frank, 2026-10-25). */
const STILL: ReadonlySet<AiOrbState> = new Set<AiOrbState>(['error']);
/** How long "done" shows before the orb settles back to rest. */
const SETTLE_MS = 5000;

export interface OrbSignals {
  isListening: boolean;
  isLoading: boolean;
  /** The proxy reported a retry for the turn in flight. */
  retrying?: boolean;
  /** The composer holds text the user is writing. */
  isTyping?: boolean;
  error: string | null;
  streamingText: string;
  toolSteps: ToolStep[];
  thoughts: string[];
  awaitingApproval: boolean;
  hasAnswered: boolean;
}

/** One state from the chat's live signals; the first match wins, most urgent first. */
export function orbStateFor(s: OrbSignals): AiOrbState {
  if (s.isListening) return 'listening';
  if (s.isLoading) {
    if (s.retrying) return 'retrying';
    if (s.streamingText) return 'streaming';
    const last = s.toolSteps[s.toolSteps.length - 1];
    if (last) return last.status === 'running' ? 'tool-call' : 'tool-result';
    return s.thoughts.length > 0 ? 'reasoning' : 'thinking';
  }
  // Typing is the user's input, like voice: Logos listens until it is sent.
  if (s.isTyping) return 'listening';
  if (s.error) return 'error';
  if (s.awaitingApproval) return 'waiting-approval';
  return s.hasAnswered ? 'done' : 'idle';
}

/** "done" settles to "idle" after SETTLE_MS; every other state shows as given. */
export function useSettledOrbState(state: AiOrbState): AiOrbState {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    if (state !== 'done') return;
    const id = window.setTimeout(() => setSettled(true), SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [state]);
  return state === 'done' && settled ? 'idle' : state;
}

export const AiOrb: React.FC<{ state: AiOrbState; size?: number }> = ({ state, size = 28 }) => (
  <span className="la-ai-orb" data-state={state} role="img" aria-label={`Ask Entomate status: ${AI_ORB_LABELS[state]}`}>
    <Orb {...LOOKS[state]} size={size} paused={STILL.has(state)} />
  </span>
);

/** Every look the orb has, in VARIANTS order (base first): the welcome hero's tour at rest. */
export const TOUR_LOOKS: OrbLook[] = Object.entries(VARIANTS).flatMap(([state, variants]) =>
  variants.map((variant) => ({ state, variant }) as OrbLook),
);
/** How long the hero holds each look of the tour (Frank, 2026-10-25). */
export const TOUR_MS = 8000;

/** The sidebar launcher's tour: every look but retrying's two, the warning shapes (Frank, 2026-10-25). */
export const LAUNCHER_LOOKS: OrbLook[] = TOUR_LOOKS.filter((look) => look.state !== 'retrying');

const lookKey = (look: OrbLook) => `${look.state ?? 'base'}-${look.variant ?? 'default'}`;

/** The tour's position: one step every TOUR_MS while touring, wrapping at `length`. */
function useTourStep(length: number, touring: boolean, start = 0): number {
  const [step, setStep] = useState(start);
  useEffect(() => {
    if (!touring) return;
    const id = window.setInterval(() => setStep((n) => (n + 1) % length), TOUR_MS);
    return () => window.clearInterval(id);
  }, [length, touring]);
  return step;
}

/** The launcher tour runs at 60% of the designed pace: full speed spun too fast at rest (Frank, 2026-10-25). */
export const LAUNCHER_SPEED = 0.6;
/** The launcher orb is always on screen, so it redraws at 30fps; at 24px the motion reads the same. */
export const LAUNCHER_FPS = 30;

/** The launcher orb at rest; the launcher swaps in LogosOrb for voice and reduced motion. */
// Voice swaps the launcher orb out; on its return the tour carries on from this look, not from the first.
let launcherStep = 0;
export const LauncherTourOrb: React.FC<{ size?: number }> = ({ size = 24 }) => {
  const step = useTourStep(LAUNCHER_LOOKS.length, true, launcherStep);
  useEffect(() => {
    launcherStep = step;
  }, [step]);
  const look = LAUNCHER_LOOKS[step]!;
  return (
    <span className="la-launcher-tour" data-look={lookKey(look)} aria-hidden="true">
      <Orb key={lookKey(look)} {...look} size={size} speed={LAUNCHER_SPEED} fps={LAUNCHER_FPS} className="la-launcher-tour-svg" />
    </span>
  );
};

/**
 * At rest it changes look every TOUR_MS; any live state (typing, voice, an error) replaces the
 * tour with that state's own look. Reduced motion holds the state's look and skips the tour.
 */
export const WelcomeOrb: React.FC<{ state: AiOrbState; size?: number }> = ({ state, size = 112 }) => {
  const reduce = useReducedMotion();
  const touring = state === 'idle' && !reduce;
  const step = useTourStep(TOUR_LOOKS.length, touring);
  const look = touring ? TOUR_LOOKS[step]! : LOOKS[state];
  return (
    <span className="la-welcome-orb" data-state={state} data-look={lookKey(look)} aria-hidden="true">
      {/* The key remounts the svg, so its fade-in plays on every change of look. */}
      <Orb key={lookKey(look)} {...look} size={size} paused={STILL.has(state)} className="la-welcome-orb-svg" />
    </span>
  );
};
