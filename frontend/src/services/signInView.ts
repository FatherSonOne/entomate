/**
 * Sign-in view logic (pure, no I/O). The sign-in page has four views:
 * sign in, create account, forgot password and "check your inbox".
 * This file names them, validates the form and turns auth errors into
 * a cause plus a next step.
 */

export type SignInView = 'signin' | 'signup' | 'forgot' | 'sent'
export type SentReason = 'confirm' | 'reset'

export interface SignInFields {
  name: string
  email: string
  password: string
}

export const MIN_PASSWORD = 6

export const VIEW_TITLE: Record<SignInView, string> = {
  signin: 'Sign in',
  signup: 'Create account',
  forgot: 'Reset password',
  sent: 'Check your inbox',
}

export const PRIMARY_LABEL: Record<Exclude<SignInView, 'sent'>, { idle: string; busy: string }> = {
  signin: { idle: 'Sign in', busy: 'Signing in…' },
  signup: { idle: 'Create account', busy: 'Creating account…' },
  forgot: { idle: 'Send reset link', busy: 'Sending…' },
}

/** Reads ?mode= so the landing's "Start free" can open Create account. */
export function viewFromParam(value: string | null): SignInView {
  if (value === 'signup' || value === 'forgot') return value
  return 'signin'
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** First problem with the form for this view, or null when it can be sent. */
export function validate(view: SignInView, fields: SignInFields): string | null {
  if (view === 'sent') return null
  if (view === 'signup' && !fields.name.trim()) return 'Enter your name.'
  if (!EMAIL_RE.test(fields.email.trim())) return 'Enter a valid email address.'
  if (view === 'forgot') return null
  if (!fields.password) return 'Enter your password.'
  if (view === 'signup' && fields.password.length < MIN_PASSWORD) {
    return `Use at least ${MIN_PASSWORD} characters for your password.`
  }
  return null
}

export interface AuthProblem {
  /** Short LED word, e.g. "Couldn't sign in". */
  head: string
  /** The cause in plain words. */
  detail: string
  /** Offer the reset-password link beside the message. */
  offerReset: boolean
}

const HEAD: Record<Exclude<SignInView, 'sent'>, string> = {
  signin: "Couldn't sign in",
  signup: "Couldn't create the account",
  forgot: "Couldn't send the link",
}

/** Maps a Supabase auth error message to a cause and a next step. */
export function describeAuthError(view: SignInView, message: string | null | undefined): AuthProblem {
  const head = view === 'sent' ? 'Something went wrong' : HEAD[view]
  const raw = (message ?? '').trim()
  const m = raw.toLowerCase()
  if (m.includes('invalid login credentials')) {
    return { head, detail: "That email and password don't match.", offerReset: true }
  }
  if (m.includes('email not confirmed')) {
    return { head, detail: 'Confirm your email first: open the link we sent when you signed up.', offerReset: false }
  }
  if (m.includes('already registered') || m.includes('already exists')) {
    return { head, detail: 'An account with this email already exists. Sign in instead.', offerReset: true }
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return { head, detail: 'Too many tries. Wait a minute, then try again.', offerReset: false }
  }
  if (m.includes('failed to fetch') || m.includes('network')) {
    return { head, detail: "Couldn't reach Entomate. Check your connection and try again.", offerReset: false }
  }
  return { head, detail: raw || 'Something went wrong. Try again.', offerReset: false }
}

/** Copy for the "check your inbox" view. */
export function sentCopy(reason: SentReason): string {
  return reason === 'confirm'
    ? 'Open the link in it to confirm your email and finish signing up.'
    : 'Open the link in it on this device to set a new password.'
}
