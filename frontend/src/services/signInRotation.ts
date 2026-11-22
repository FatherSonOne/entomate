/**
 * What rotates on the sign-in page, once per page load, never the same
 * item twice in a row: the headline and a numbered tip. Keep both true to
 * what ships (check the landing claims audit before adding a headline,
 * and the feature itself before adding a tip).
 */

export interface Tagline {
  lead: string
  accent: string
}

export const SIGNIN_TAGLINES: readonly Tagline[] = [
  { lead: 'Meetings end.', accent: 'The work shouldn’t.' },
  { lead: 'Every meeting,', accent: 'minuted.' },
  { lead: 'Talk it through.', accent: 'Leave with owners.' },
  { lead: 'Out of the meeting.', accent: 'Into the work.' },
  { lead: 'Say it once.', accent: 'It’s on the list.' },
]

/** Numbered tips: the number is the position in this list, so append new ones at the end. */
export const SIGNIN_TIPS: readonly string[] = [
  'Press ⌘K (Ctrl K on Windows) to jump to any meeting, task or page.',
  'Press ⌘/ (Ctrl / on Windows) to open Ask Entomate. It knows which page you are on.',
  'In Meetings, J and K move through the list and Enter opens the meeting.',
  'On Tasks, press N to add a task without leaving the list.',
  'Press / on Tasks or Search to start typing straight away.',
  'A crimson tick marks a decision. Its timecode plays the moment it was made.',
  'Amber means an agent made the call, and it always shows its confidence.',
  'Open “Why” under an action item to read the agent’s reasoning.',
  'Turn on bot auto-join in Settings and the notetaker joins your calendar meetings.',
  'Action items and decisions from a meeting roll up into its project.',
  'Press ⌘M (Ctrl M on Windows) to start a new meeting from anywhere.',
  'Pick your logo and loading screen in Settings › Appearance.',
  'Prefer the brand colours? Switch the palette to Void Crimson in Settings › Appearance.',
  'Drawers close with Esc. On a phone, drag the sheet down.',
  'Press ⌘? (Ctrl ? on Windows) to see every keyboard shortcut.',
]

/** Next index after `previous`, or `fallback` when there is no valid previous one. */
export function nextIndex(previous: number, count: number, fallback: number): number {
  if (count <= 0) return 0
  if (!Number.isInteger(previous) || previous < 0 || previous >= count) return Math.abs(fallback) % count
  return (previous + 1) % count
}

/** Advances the stored position for `key` once and returns the new index. */
export function rotate(key: string, count: number): number {
  const fallback = Math.floor(Math.random() * count)
  try {
    const stored = window.localStorage.getItem(key)
    const index = nextIndex(stored === null ? -1 : Number(stored), count, fallback)
    window.localStorage.setItem(key, String(index))
    return index
  } catch {
    // Storage can be unavailable in private or restricted browsing.
    return fallback
  }
}

/** Call once per page load. */
export function nextTagline(): Tagline {
  return SIGNIN_TAGLINES[rotate('entomate.signin.tagline', SIGNIN_TAGLINES.length)] ?? SIGNIN_TAGLINES[0]!
}

/** Index into SIGNIN_TIPS; show it as number index + 1. Call once per page load. */
export function nextTipIndex(): number {
  return rotate('entomate.signin.tip', SIGNIN_TIPS.length)
}
