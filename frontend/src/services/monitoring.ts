/**
 * Error tracking (2026-11-22). Sends errors to Sentry when VITE_SENTRY_DSN is
 * set at build time; without it every call here is a no-op. The SDK loads in
 * its own chunk after the app starts, so it never slows the first paint.
 * Calls made before it loads are queued.
 *
 * Privacy: only the user id is attached (no email or name), request bodies
 * are never sent, and default PII collection is off.
 */
import { classifyError, isQuietKind } from './errorKinds'
import { isChunkError } from './chunkReload'

type SentryModule = typeof import('@sentry/react')

declare const __APP_RELEASE__: string

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined

let sentry: SentryModule | null = null
let queue: Array<(s: SentryModule) => void> = []

function withSentry(fn: (s: SentryModule) => void): void {
  if (!DSN) return
  if (sentry) fn(sentry)
  else queue.push(fn)
}

export function initMonitoring(): void {
  if (!DSN || typeof window === 'undefined') return
  import('@sentry/react')
    .then((s) => {
      s.init({
        dsn: DSN,
        environment: (import.meta.env.VITE_APP_ENV as string | undefined) ?? import.meta.env.MODE,
        release: __APP_RELEASE__ || undefined,
        sendDefaultPii: false,
        tracesSampleRate: 0,
        // A stale page file after a deploy is handled by a reload, not a bug
        beforeSend: (event, hint) => (isChunkError(hint?.originalException) ? null : event),
        ignoreErrors: ['ResizeObserver loop limit exceeded', 'ResizeObserver loop completed with undelivered notifications'],
      })
      sentry = s
      queue.forEach((fn) => fn(s))
      queue = []
    })
    .catch(() => { queue = [] })
}

export interface ReportContext {
  /** Where it was caught: "boundary:page", "boundary:app", "api", "toast". */
  source: string
  /** Extra non-sensitive fields (route, status, url path). */
  extra?: Record<string, string | number | undefined>
  componentStack?: string
}

/** Sends an error with its kind. Offline and stale-deploy errors are not bugs and are skipped. */
export function reportError(error: unknown, { source, extra, componentStack }: ReportContext): void {
  const kind = classifyError(error)
  if (isQuietKind(kind)) return
  // 4xx answers (bad input, signed out, no access, not found) are expected, not bugs
  const status = (error as { status?: number } | null)?.status
  if (status !== undefined && status >= 400 && status < 500) return
  withSentry((s) => {
    s.withScope((scope) => {
      scope.setTag('error.kind', kind)
      scope.setTag('error.source', source)
      if (extra) scope.setExtras(extra)
      if (componentStack) scope.setContext('react', { componentStack })
      s.captureException(error instanceof Error ? error : new Error(String(error)))
    })
  })
}

/** A trail of what happened before an error (toasts shown, for one). */
export function breadcrumb(category: string, message: string): void {
  withSentry((s) => s.addBreadcrumb({ category, message, level: 'info' }))
}

export function setMonitoringUser(id: string | null | undefined): void {
  withSentry((s) => s.setUser(id ? { id } : null))
}
