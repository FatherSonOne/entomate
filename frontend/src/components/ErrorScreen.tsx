import React, { useEffect, useState, useSyncExternalStore } from 'react'
import { Key } from './bench/Key'
import { cx } from './bench/cx'
import { isChunkError, isReloadProtected, subscribeToReloadProtection } from '../services/chunkReload'
import { ACTION_LABEL, classifyError, errorCopy, errorReport } from '../services/errorKinds'
import type { ErrorAction } from '../services/errorKinds'
import './ErrorScreen.css'

export interface ErrorScreenProps {
  error: unknown
  componentStack?: string
  /** "app" covers the window; "page" sits inside the shell so nav still works. */
  scope: 'app' | 'page'
  /** Clears the boundary and draws the page again. */
  onRetry: () => void
}

/**
 * What a caught error looks like (2026-11-22): a kind-specific title, one
 * line on what to do, the keys that do it, and the raw error under
 * "Error details" with a copy key for bug reports.
 */
export default function ErrorScreen({ error, componentStack, scope, onRetry }: ErrorScreenProps): React.ReactElement {
  const [online, setOnline] = useState(() => navigator.onLine)
  const [copied, setCopied] = useState(false)
  const reloadProtected = useSyncExternalStore(subscribeToReloadProtection, isReloadProtected)
  const kind = classifyError(error, online)
  const copy = errorCopy(kind)
  const report = errorReport(error, kind, componentStack)
  const pageNeedsRefresh = isChunkError(error)
  const canRun = (action: ErrorAction): boolean =>
    !reloadProtected || (action === 'retry' && scope === 'page' && !pageNeedsRefresh)

  // Offline: try again by itself once the connection is back
  useEffect(() => {
    const up = (): void => setOnline(true)
    const down = (): void => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])
  const wasOffline = React.useRef(!online)
  useEffect(() => {
    if (online && wasOffline.current) onRetry()
    wasOffline.current = !online
  }, [online, onRetry])

  const run = (action: ErrorAction): void => {
    if (isReloadProtected() && (action !== 'retry' || scope === 'app' || pageNeedsRefresh)) return
    if (action === 'reload') window.location.reload()
    else if (action === 'sign-in') window.location.assign('/sign-in')
    else if (action === 'home') window.location.assign('/dashboard')
    else if (scope === 'app') window.location.reload()
    else onRetry()
  }

  const copyDetails = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard blocked: the details stay selectable */ }
  }

  const message = (error as { message?: string } | null)?.message ?? String(error)

  return (
    <div className={cx('en-err bs-tokens', scope === 'app' && 'en-err-app')} role="alert" aria-live="assertive">
      <div className="en-err-card">
        <div className="en-err-code"><span className="en-err-led" data-kind={kind} aria-hidden="true" />{copy.code}</div>
        <h1 className="en-err-title">{copy.title}</h1>
        <p className="en-err-body">{reloadProtected && pageNeedsRefresh
          ? 'Your recording is still running or saving. Finish it before reloading this page.'
          : copy.body}</p>
        <div className="en-err-keys">
          {canRun(copy.primary) && <Key variant="primary" onClick={() => run(copy.primary)}>{ACTION_LABEL[copy.primary]}</Key>}
          {copy.secondary && canRun(copy.secondary) && <Key onClick={() => run(copy.secondary as ErrorAction)}>{ACTION_LABEL[copy.secondary]}</Key>}
        </div>
        <details className="en-err-details">
          <summary>Error details</summary>
          <p className="en-err-msg">{message}</p>
          <pre className="en-err-pre">{report}</pre>
          <Key size="sm" onClick={copyDetails}>{copied ? 'Copied' : 'Copy details'}</Key>
        </details>
      </div>
    </div>
  )
}
