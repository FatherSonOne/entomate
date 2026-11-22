import { isChunkError } from './chunkReload'

/**
 * Sorts a caught error into what the person can do about it (2026-11-22).
 * The error screen picks its words and keys from the kind; the raw error
 * stays available under "Error details".
 */
export type ErrorKind =
  | 'stale-deploy'
  | 'offline'
  | 'network'
  | 'session'
  | 'permission'
  | 'not-found'
  | 'server'
  | 'render'

export type ErrorAction = 'reload' | 'retry' | 'sign-in' | 'home'

export interface ErrorCopy {
  /** Mono label above the title, e.g. "OFFLINE". */
  code: string
  title: string
  body: string
  primary: ErrorAction
  secondary?: ErrorAction
}

interface ErrorLike {
  name?: string
  message?: string
  status?: number
  code?: string
  isNetworkError?: boolean
  response?: { status?: number }
  originalError?: { response?: { status?: number } }
}

function statusOf(e: ErrorLike): number | undefined {
  return e.status ?? e.response?.status ?? e.originalError?.response?.status
}

export function classifyError(error: unknown, online: boolean = typeof navigator === 'undefined' || navigator.onLine): ErrorKind {
  if (isChunkError(error)) return online ? 'stale-deploy' : 'offline'
  const e = (error ?? {}) as ErrorLike
  const msg = `${e.name ?? ''} ${e.message ?? String(error ?? '')}`
  if (!online || /You are offline/i.test(msg)) return 'offline'
  const status = statusOf(e)
  if (status === 401 || e.code === 'PGRST301' || /JWT expired|session (has )?expired|invalid (refresh )?token|not authenticated/i.test(msg)) return 'session'
  if (status === 403 || e.code === '42501' || /permission denied|do not have permission|not authori[sz]ed|forbidden|row-level security/i.test(msg)) return 'permission'
  if (status === 404 || e.code === 'PGRST116' || /requested resource was not found/i.test(msg)) return 'not-found'
  if ((status !== undefined && status >= 500) || /A server error occurred/i.test(msg)) return 'server'
  if (e.isNetworkError || /Network Error|Failed to fetch|NetworkError|Load failed|ERR_NETWORK|timeout|Unable to connect to the server/i.test(msg)) return 'network'
  return 'render'
}

const COPY: Record<ErrorKind, ErrorCopy> = {
  'stale-deploy': {
    code: 'NEW VERSION',
    title: 'Entomate was updated',
    body: 'This tab is still on the previous version, so the page could not open. Reloading brings in the new one.',
    primary: 'reload',
  },
  offline: {
    code: 'OFFLINE',
    title: 'You are offline',
    body: 'The page needs a connection to load. It will try again by itself as soon as you are back online.',
    primary: 'retry',
  },
  network: {
    code: 'NO CONNECTION',
    title: 'Entomate could not be reached',
    body: 'Your connection is up but the server did not answer. It may be restarting. Try again in a moment.',
    primary: 'retry',
    secondary: 'reload',
  },
  session: {
    code: 'SIGNED OUT',
    title: 'Your session has ended',
    body: 'Sign in again to carry on. Nothing you saved is lost.',
    primary: 'sign-in',
  },
  permission: {
    code: 'NO ACCESS',
    title: 'You do not have access to this',
    body: 'It belongs to a workspace or role you are not part of. Ask a workspace admin if you need it.',
    primary: 'home',
  },
  'not-found': {
    code: 'NOT FOUND',
    title: 'This could not be found',
    body: 'It may have been deleted or moved, or the link is out of date.',
    primary: 'home',
    secondary: 'retry',
  },
  server: {
    code: 'SERVER ERROR',
    title: 'Something failed on our side',
    body: 'The server hit an error while loading this. Try again; if it keeps happening, send the error details below.',
    primary: 'retry',
    secondary: 'home',
  },
  render: {
    code: 'PAGE ERROR',
    title: 'This page hit a problem',
    body: 'Something in the page broke while drawing it. Try again, or go back to Today. The error details below say what failed.',
    primary: 'retry',
    secondary: 'home',
  },
}

export function errorCopy(kind: ErrorKind): ErrorCopy {
  return COPY[kind]
}

export const ACTION_LABEL: Record<ErrorAction, string> = {
  reload: 'Reload',
  retry: 'Try again',
  'sign-in': 'Sign in',
  home: 'Go to Today',
}

/** Plain-text report for "Copy details". */
export function errorReport(error: unknown, kind: ErrorKind, componentStack?: string): string {
  const e = (error ?? {}) as ErrorLike & { stack?: string }
  return [
    `Kind: ${kind}`,
    `When: ${new Date().toISOString()}`,
    `Page: ${typeof window === 'undefined' ? '' : window.location.pathname}`,
    `Error: ${e.name ?? 'Error'}: ${e.message ?? String(error)}`,
    statusOf(e) !== undefined ? `Status: ${statusOf(e)}` : null,
    e.stack ? `\nStack:\n${e.stack}` : null,
    componentStack ? `\nComponents:${componentStack}` : null,
  ].filter(Boolean).join('\n')
}

/** Not bugs: the person's connection, or a tab older than the last deploy. */
export function isQuietKind(kind: ErrorKind): boolean {
  return kind === 'offline' || kind === 'stale-deploy'
}

/* ── Action errors (a save, delete or send that failed on a page that is up) ── */

export interface ToastCopy {
  title: string
  message: string
  action?: ErrorAction
}

const ACTION_COPY: Partial<Record<ErrorKind, ToastCopy>> = {
  'stale-deploy': { title: 'Entomate was updated', message: 'Reload to use the new version, then try again.', action: 'reload' },
  offline: { title: 'You are offline', message: 'That did not go through. Try again once you are back online.' },
  network: { title: 'Could not reach Entomate', message: 'The server did not answer. Try again in a moment.' },
  session: { title: 'Your session has ended', message: 'Sign in again, then try once more. Nothing saved is lost.', action: 'sign-in' },
  permission: { title: 'You do not have access', message: 'Your role in this workspace cannot do this. Ask a workspace admin.' },
  'not-found': { title: 'Not found', message: 'It may have been deleted or moved. Refresh to see the latest.' },
  server: { title: 'Something failed on our side', message: 'The server hit an error. Try again; if it keeps happening, let us know.' },
}

/** Kinds where the cause matters more than which action failed. */
const CAUSE_FIRST: ReadonlyArray<ErrorKind> = ['stale-deploy', 'offline', 'network', 'session', 'permission']

const GENERIC_TITLE = /^(error|oops|failed|something went wrong)[.!]?$/i

/**
 * Words for a toast about a failed action. `title` is what the caller wanted
 * to say ("Failed to create task"); `error` is the Error or its message.
 * Known causes (signed out, offline, no access) get their own words and key;
 * anything else keeps the caller's title and the error's message.
 */
export function toastForError(title: string | undefined, error: unknown): ToastCopy {
  const text = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const kind = classifyError(error instanceof Error ? error : new Error(text))
  const own = title && !GENERIC_TITLE.test(title.trim()) ? title : undefined
  const known = ACTION_COPY[kind]
  if (known) {
    if (CAUSE_FIRST.includes(kind) || !own) return known
    return { title: own, message: known.message, action: known.action }
  }
  return { title: own ?? 'That did not work', message: text || 'Try again in a moment.' }
}
