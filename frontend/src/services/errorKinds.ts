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
  if (!online) return 'offline'
  const status = statusOf(e)
  if (status === 401 || e.code === 'PGRST301' || /JWT expired|session (has )?expired|invalid (refresh )?token|not authenticated/i.test(msg)) return 'session'
  if (status === 403 || e.code === '42501' || /permission denied|not authori[sz]ed|forbidden|row-level security/i.test(msg)) return 'permission'
  if (status === 404 || e.code === 'PGRST116') return 'not-found'
  if (status !== undefined && status >= 500) return 'server'
  if (e.isNetworkError || /Network Error|Failed to fetch|NetworkError|Load failed|ERR_NETWORK|timeout/i.test(msg)) return 'network'
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
