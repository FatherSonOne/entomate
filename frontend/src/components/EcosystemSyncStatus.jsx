import React, { useState, useEffect } from 'react'
import {
  Globe, CheckCircle2, XCircle, Loader2, RotateCcw, Clock
} from 'lucide-react'
import { VCBadge } from './vc'

const API_BASE = import.meta.env.VITE_API_URL || ''

/**
 * Shows sync status for a meeting across the ecosystem (Pulse + Logos Vision).
 * Displays compact badges with retry capability for failed syncs.
 */
export default function EcosystemSyncStatus({ meetingId }) {
  const [syncStatus, setSyncStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(null)

  useEffect(() => {
    if (!meetingId) return
    loadSyncStatus()
  }, [meetingId])

  const loadSyncStatus = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/api/ecosystem/sync-status/${meetingId}`)
      const data = await res.json()
      setSyncStatus(data)
    } catch (err) {
      // Ecosystem bridge may not be set up yet — fail silently
      setSyncStatus(null)
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = async (eventId) => {
    try {
      setRetrying(eventId)
      await fetch(`${API_BASE}/api/ecosystem/retry/${eventId}`, { method: 'POST' })
      await loadSyncStatus()
    } catch (err) {
      console.error('Retry failed:', err)
    } finally {
      setRetrying(null)
    }
  }

  // Don't render if no sync data exists (bridge not configured or meeting not synced)
  if (loading) return null
  if (!syncStatus || (!syncStatus.pulse && !syncStatus.logosVision)) return null

  return (
    <div className="vc p-4">
      <h3
        className="text-xs font-medium mb-3 uppercase tracking-wide flex items-center gap-1.5"
        style={{ color: 'var(--text-tertiary)' }}
      >
        <Globe className="w-3.5 h-3.5" />
        Ecosystem Sync
      </h3>
      <div className="space-y-2">
        {syncStatus.pulse && (
          <SyncRow
            label="Pulse"
            status={syncStatus.pulse.status}
            time={syncStatus.pulse.lastSync}
            error={syncStatus.pulse.error}
            eventId={syncStatus.pulse.eventId}
            retrying={retrying === syncStatus.pulse.eventId}
            onRetry={handleRetry}
          />
        )}
        {syncStatus.logosVision && (
          <SyncRow
            label="Logos Vision"
            status={syncStatus.logosVision.status}
            time={syncStatus.logosVision.lastSync}
            error={syncStatus.logosVision.error}
            eventId={syncStatus.logosVision.eventId}
            count={syncStatus.logosVision.eventCount}
            retrying={retrying === syncStatus.logosVision.eventId}
            onRetry={handleRetry}
          />
        )}
      </div>
    </div>
  )
}

function SyncRow({ label, status, time, error, eventId, count, retrying, onRetry }) {
  const statusConfig = {
    delivered: { color: 'mint', icon: CheckCircle2, text: 'Synced' },
    pending: { color: 'amber', icon: Loader2, text: 'Syncing...' },
    failed: { color: 'error', icon: XCircle, text: 'Failed' }
  }

  const cfg = statusConfig[status] || statusConfig.pending
  const Icon = cfg.icon

  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <Icon
          className={`w-3.5 h-3.5 ${status === 'pending' ? 'animate-spin' : ''}`}
          style={{ color: `var(--accent-${cfg.color === 'error' ? 'primary' : cfg.color === 'mint' ? 'secondary' : 'tertiary'})` }}
        />
        <span style={{ color: 'var(--text-primary)' }}>{label}</span>
        {count > 1 && (
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            ({count} events)
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <VCBadge color={cfg.color}>{cfg.text}</VCBadge>
        {status === 'failed' && eventId && (
          <button
            onClick={() => onRetry(eventId)}
            disabled={retrying}
            className="hover:opacity-80 transition-opacity"
            style={{ color: 'var(--accent-primary)' }}
            title={error || 'Retry sync'}
          >
            {retrying
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <RotateCcw className="w-3.5 h-3.5" />
            }
          </button>
        )}
        {time && status === 'delivered' && (
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  )
}
