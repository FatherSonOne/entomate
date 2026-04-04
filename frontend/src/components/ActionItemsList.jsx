import React, { useState } from 'react'
import { RefreshCw, Loader2, CheckCircle, XCircle, Clock, CalendarPlus } from 'lucide-react'
import { integrationsApi, meetingsApi, calendarApi } from '../services/api'

export default function ActionItemsList({ items = [], onUpdate, meetingId }) {
  const [syncing, setSyncing] = useState({})
  const [toggling, setToggling] = useState({})
  const [calSyncing, setCalSyncing] = useState({})
  const [error, setError] = useState(null)

  const syncItem = async (itemId) => {
    try {
      setSyncing(prev => ({ ...prev, [itemId]: true }))
      setError(null)

      const result = await integrationsApi.crm.syncActionItems([itemId])

      if (result.failed > 0 && result.errors?.length > 0) {
        setError(result.errors[0].error || 'Sync failed')
      }

      if (onUpdate) {
        onUpdate()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSyncing(prev => ({ ...prev, [itemId]: false }))
    }
  }

  const syncAllPending = async () => {
    const pendingIds = items
      .filter(i => i.crm_sync_status === 'pending' || i.crm_sync_status === 'failed')
      .map(i => i.id)

    if (pendingIds.length === 0) return

    try {
      setSyncing(prev => {
        const newState = { ...prev }
        pendingIds.forEach(id => { newState[id] = true })
        return newState
      })
      setError(null)

      const result = await integrationsApi.crm.syncActionItems(pendingIds)

      if (result.failed > 0) {
        setError(`${result.failed} item(s) failed to sync`)
      }

      if (onUpdate) {
        onUpdate()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSyncing({})
    }
  }

  const toggleStatus = async (itemId, currentStatus) => {
    const newStatus = currentStatus === 'done' ? 'open' : 'done'
    try {
      setToggling(prev => ({ ...prev, [itemId]: true }))
      await meetingsApi.updateActionItem(itemId, { status: newStatus })
      if (onUpdate) onUpdate()
    } catch (err) {
      setError(err.message || 'Failed to update status')
    } finally {
      setToggling(prev => ({ ...prev, [itemId]: false }))
    }
  }

  const syncToCalendar = async (itemId) => {
    try {
      setCalSyncing(prev => ({ ...prev, [itemId]: true }))
      await calendarApi.syncActionItem(itemId)
      if (onUpdate) onUpdate()
    } catch (err) {
      setError(err.message || 'Failed to sync to calendar')
    } finally {
      setCalSyncing(prev => ({ ...prev, [itemId]: false }))
    }
  }

  const getPriorityDotStyle = (priority) => {
    switch (priority) {
      case 'high': return { background: 'var(--accent-primary)' }
      case 'medium': return { background: 'var(--accent-tertiary)' }
      case 'low': return { background: 'var(--accent-secondary)' }
      default: return { background: 'var(--text-tertiary)' }
    }
  }

  const getSyncStatusBadge = (status) => {
    switch (status) {
      case 'synced':
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: 'rgba(0,245,212,.12)', color: 'var(--accent-secondary)' }}
          >
            <CheckCircle className="w-3 h-3" />
            Synced
          </span>
        )
      case 'failed':
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: 'rgba(255,45,107,.12)', color: 'var(--accent-primary)' }}
          >
            <XCircle className="w-3 h-3" />
            Failed
          </span>
        )
      default:
        return (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: 'rgba(255,184,0,.12)', color: 'var(--accent-tertiary)' }}
          >
            <Clock className="w-3 h-3" />
            Pending
          </span>
        )
    }
  }

  const hasPending = items.some(i => i.crm_sync_status === 'pending' || i.crm_sync_status === 'failed')
  const syncedCount = items.filter(i => i.crm_sync_status === 'synced').length
  const pendingCount = items.filter(i => i.crm_sync_status === 'pending').length
  const failedCount = items.filter(i => i.crm_sync_status === 'failed').length

  if (!items || items.length === 0) {
    return (
      <div className="text-sm py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>
        No action items extracted
      </div>
    )
  }

  // Group by priority
  const highPriority = items.filter(i => i.priority === 'high')
  const mediumPriority = items.filter(i => i.priority === 'medium')
  const lowPriority = items.filter(i => i.priority === 'low')

  const renderItems = (priorityItems, priorityLabel, priority) => {
    if (priorityItems.length === 0) return null

    return (
      <div className="mb-4">
        <h4
          className="text-xs font-semibold uppercase mb-2 flex items-center gap-2"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <span className="w-2 h-2 rounded-full" style={getPriorityDotStyle(priority)} />
          {priorityLabel} ({priorityItems.length})
        </h4>
        <div className="space-y-2">
          {priorityItems.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-lg border transition-colors"
              style={{
                background: 'var(--bg-elevated)',
                borderColor: 'rgba(248,240,242,.08)'
              }}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleStatus(item.id, item.status)}
                  disabled={toggling[item.id]}
                  className="mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
                  style={{
                    borderColor: item.status === 'done' ? 'var(--accent-secondary)' : 'rgba(248,240,242,.25)',
                    background: item.status === 'done' ? 'rgba(0,245,212,.15)' : 'transparent'
                  }}
                  title={item.status === 'done' ? 'Mark as open' : 'Mark as done'}
                >
                  {toggling[item.id] ? (
                    <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
                  ) : item.status === 'done' ? (
                    <CheckCircle className="w-3.5 h-3.5" style={{ color: 'var(--accent-secondary)' }} />
                  ) : null}
                </button>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${item.status === 'done' ? 'line-through opacity-60' : ''}`}
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {item.task_description}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {item.assigned_to_name && (
                      <span className="flex items-center gap-1">
                        <span>Assigned:</span>
                        {item.assigned_to_name}
                      </span>
                    )}
                    {item.due_date && (
                      <span className="flex items-center gap-1">
                        <span>Due:</span>
                        {new Date(item.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {item.last_sync_error && item.crm_sync_status === 'failed' && (
                    <p className="text-xs mt-1" style={{ color: 'var(--accent-primary)' }}>
                      Error: {item.last_sync_error}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {getSyncStatusBadge(item.crm_sync_status)}
                  {item.due_date && !item.calendar_event_id && item.status !== 'done' && (
                    <button
                      onClick={() => syncToCalendar(item.id)}
                      disabled={calSyncing[item.id]}
                      className="p-1.5 rounded transition-colors disabled:opacity-50"
                      style={{ color: 'var(--text-tertiary)' }}
                      title="Add to Calendar"
                    >
                      {calSyncing[item.id] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CalendarPlus className="w-4 h-4" />
                      )}
                    </button>
                  )}
                  {(item.crm_sync_status === 'pending' || item.crm_sync_status === 'failed') && (
                    <button
                      onClick={() => syncItem(item.id)}
                      disabled={syncing[item.id]}
                      className="p-1.5 rounded transition-colors disabled:opacity-50"
                      style={{ color: 'var(--text-tertiary)' }}
                      title={item.crm_sync_status === 'failed' ? 'Retry sync' : 'Sync to CRM'}
                    >
                      {syncing[item.id] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header with sync all button */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          <span style={{ color: 'var(--accent-secondary)' }}>{syncedCount} synced</span>
          {pendingCount > 0 && <span className="ml-2" style={{ color: 'var(--accent-tertiary)' }}>{pendingCount} pending</span>}
          {failedCount > 0 && <span className="ml-2" style={{ color: 'var(--accent-primary)' }}>{failedCount} failed</span>}
        </div>
        {hasPending && (
          <button
            onClick={syncAllPending}
            disabled={Object.values(syncing).some(Boolean)}
            className="text-xs font-medium flex items-center gap-1 disabled:opacity-50"
            style={{ color: 'var(--accent-primary)' }}
          >
            {Object.values(syncing).some(Boolean) ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            Sync All
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div
          className="mb-4 p-2 rounded-lg text-xs"
          style={{ background: 'rgba(255,45,107,.08)', border: '1px solid rgba(255,45,107,.2)', color: 'var(--accent-primary)' }}
        >
          {error}
        </div>
      )}

      {/* Priority groups */}
      {renderItems(highPriority, 'High Priority', 'high')}
      {renderItems(mediumPriority, 'Medium Priority', 'medium')}
      {renderItems(lowPriority, 'Low Priority', 'low')}
    </div>
  )
}
