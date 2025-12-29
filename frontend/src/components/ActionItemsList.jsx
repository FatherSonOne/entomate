import React, { useState } from 'react'
import { RefreshCw, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react'
import { integrationsApi } from '../services/api'

export default function ActionItemsList({ items = [], onUpdate, meetingId }) {
  const [syncing, setSyncing] = useState({})
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

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-green-500'
      default: return 'bg-gray-400'
    }
  }

  const getSyncStatusBadge = (status) => {
    switch (status) {
      case 'synced':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3" />
            Synced
          </span>
        )
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3" />
            Failed
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
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
      <div className="text-gray-500 text-sm py-4 text-center">
        No action items extracted
      </div>
    )
  }

  // Group by priority
  const highPriority = items.filter(i => i.priority === 'high')
  const mediumPriority = items.filter(i => i.priority === 'medium')
  const lowPriority = items.filter(i => i.priority === 'low')

  const renderItems = (priorityItems, priorityLabel, priorityColor) => {
    if (priorityItems.length === 0) return null

    return (
      <div className="mb-4">
        <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2 flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${priorityColor}`} />
          {priorityLabel} ({priorityItems.length})
        </h4>
        <div className="space-y-2">
          {priorityItems.map((item) => (
            <div
              key={item.id}
              className="p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {item.task_description}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    {item.assigned_to_name && (
                      <span className="flex items-center gap-1">
                        <span className="text-gray-400">Assigned:</span>
                        {item.assigned_to_name}
                      </span>
                    )}
                    {item.due_date && (
                      <span className="flex items-center gap-1">
                        <span className="text-gray-400">Due:</span>
                        {new Date(item.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {item.last_sync_error && item.crm_sync_status === 'failed' && (
                    <p className="text-xs text-red-600 mt-1">
                      Error: {item.last_sync_error}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {getSyncStatusBadge(item.crm_sync_status)}
                  {(item.crm_sync_status === 'pending' || item.crm_sync_status === 'failed') && (
                    <button
                      onClick={() => syncItem(item.id)}
                      disabled={syncing[item.id]}
                      className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors disabled:opacity-50"
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
        <div className="text-xs text-gray-500">
          <span className="text-green-600">{syncedCount} synced</span>
          {pendingCount > 0 && <span className="ml-2 text-yellow-600">{pendingCount} pending</span>}
          {failedCount > 0 && <span className="ml-2 text-red-600">{failedCount} failed</span>}
        </div>
        {hasPending && (
          <button
            onClick={syncAllPending}
            disabled={Object.values(syncing).some(Boolean)}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1 disabled:opacity-50"
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
        <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Priority groups */}
      {renderItems(highPriority, 'High Priority', 'bg-red-500')}
      {renderItems(mediumPriority, 'Medium Priority', 'bg-yellow-500')}
      {renderItems(lowPriority, 'Low Priority', 'bg-green-500')}
    </div>
  )
}
