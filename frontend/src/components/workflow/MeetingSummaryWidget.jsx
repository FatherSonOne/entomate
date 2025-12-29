import React, { useState, useEffect, useCallback } from 'react'
import {
  Loader2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Users,
  Target,
  ArrowRight,
  Send,
  Sparkles
} from 'lucide-react'
import { meetingsApi, integrationsApi } from '../../services/api'

/**
 * MeetingSummaryWidget
 *
 * AI-powered widget that displays meeting intelligence:
 * - 3 key decisions from meeting
 * - Action items with owners
 * - Next steps
 * - Publish to CRM functionality
 *
 * @param {Object} props
 * @param {string} props.meetingId - The meeting ID to fetch summary for
 * @param {Object} props.meetingData - Optional pre-loaded meeting data
 * @param {Function} props.onPublished - Callback when published to CRM
 * @param {boolean} props.compact - Compact display mode
 * @param {string} props.className - Additional CSS classes
 */
export default function MeetingSummaryWidget({
  meetingId,
  meetingData: initialData,
  onPublished,
  compact = false,
  className = ''
}) {
  // State
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState(null)
  const [meetingData, setMeetingData] = useState(initialData || null)
  const [publishing, setPublishing] = useState(false)
  const [publishSuccess, setPublishSuccess] = useState(false)
  const [publishError, setPublishError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  // Fetch meeting data
  const fetchMeetingData = useCallback(async () => {
    if (!meetingId) return

    try {
      setError(null)
      const data = await meetingsApi.get(meetingId)
      setMeetingData(data)
    } catch (err) {
      console.error('[MeetingSummaryWidget] Error fetching meeting:', err)
      setError(err.message || 'Failed to load meeting summary')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [meetingId])

  // Initial load
  useEffect(() => {
    if (!initialData && meetingId) {
      fetchMeetingData()
    }
  }, [meetingId, initialData, fetchMeetingData])

  // Refresh handler
  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchMeetingData()
  }

  // Publish to CRM handler
  const handlePublishToCRM = async () => {
    if (!meetingData) return

    try {
      setPublishing(true)
      setPublishError(null)
      setPublishSuccess(false)

      // Get action items that need syncing
      const actionItems = meetingData.actionItems || []
      const pendingItems = actionItems.filter(
        item => item.crm_sync_status === 'pending' || item.crm_sync_status === 'failed'
      )

      if (pendingItems.length === 0) {
        // All items already synced
        setPublishSuccess(true)
        if (onPublished) {
          onPublished({ synced: 0, message: 'All items already synced to CRM' })
        }
        return
      }

      // Sync action items to CRM
      const result = await integrationsApi.crm.syncActionItems(
        pendingItems.map(item => item.id)
      )

      if (result.failed > 0 && result.synced === 0) {
        throw new Error(result.errors?.[0]?.error || 'Failed to sync to CRM')
      }

      setPublishSuccess(true)

      // Refresh data to get updated sync status
      await fetchMeetingData()

      if (onPublished) {
        onPublished({
          synced: result.synced,
          failed: result.failed,
          message: `${result.synced} items synced to CRM`
        })
      }
    } catch (err) {
      console.error('[MeetingSummaryWidget] Publish error:', err)
      setPublishError(err.message || 'Failed to publish to CRM')
    } finally {
      setPublishing(false)
    }
  }

  // Get decisions (limit to 3)
  const getDecisions = () => {
    const decisions = meetingData?.decisions || meetingData?.key_points || []
    return Array.isArray(decisions) ? decisions.slice(0, 3) : []
  }

  // Get action items
  const getActionItems = () => {
    return meetingData?.actionItems || []
  }

  // Get next steps
  const getNextSteps = () => {
    // Next steps might be in different fields depending on AI output
    if (meetingData?.next_steps) {
      return Array.isArray(meetingData.next_steps) ? meetingData.next_steps : []
    }
    // Fall back to deriving from action items
    const items = getActionItems()
    return items
      .filter(item => item.priority === 'high')
      .slice(0, 3)
      .map(item => item.task_description)
  }

  // Check if all items are synced
  const getAllSynced = () => {
    const items = getActionItems()
    return items.length > 0 && items.every(item => item.crm_sync_status === 'synced')
  }

  // Render loading state
  if (loading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
          <span className="ml-2 text-gray-500">Generating AI summary...</span>
        </div>
      </div>
    )
  }

  // Render error state
  if (error) {
    return (
      <div className={`bg-white rounded-lg border border-red-200 p-6 ${className}`}>
        <div className="flex items-center text-red-600 mb-4">
          <AlertCircle className="w-5 h-5 mr-2" />
          <span className="font-medium">Failed to load summary</span>
        </div>
        <p className="text-sm text-gray-600 mb-4">{error}</p>
        <button
          onClick={handleRefresh}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
      </div>
    )
  }

  // No data state
  if (!meetingData) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="text-center py-8 text-gray-500">
          <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No meeting data available</p>
        </div>
      </div>
    )
  }

  const decisions = getDecisions()
  const actionItems = getActionItems()
  const nextSteps = getNextSteps()
  const allSynced = getAllSynced()

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary-600" />
          <h3 className="font-semibold text-gray-900">AI Meeting Summary</h3>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
          title="Refresh summary"
          aria-label="Refresh summary"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className={compact ? 'p-4 space-y-4' : 'p-5 space-y-6'}>
        {/* Key Decisions Section */}
        {decisions.length > 0 && (
          <section>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
              <Target className="w-4 h-4 text-blue-600" />
              Key Decisions
            </h4>
            <ul className="space-y-2">
              {decisions.map((decision, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-gray-700"
                >
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{decision}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Action Items Section */}
        {actionItems.length > 0 && (
          <section>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
              <Users className="w-4 h-4 text-purple-600" />
              Action Items ({actionItems.length})
            </h4>
            <div className="space-y-2">
              {actionItems.slice(0, compact ? 3 : 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between p-2 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 font-medium truncate">
                      {item.task_description}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      {item.assigned_to_name && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {item.assigned_to_name}
                        </span>
                      )}
                      {item.due_date && (
                        <span>
                          Due: {new Date(item.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ml-2 flex-shrink-0">
                    <PriorityBadge priority={item.priority} />
                  </div>
                </div>
              ))}
              {actionItems.length > (compact ? 3 : 5) && (
                <p className="text-xs text-gray-500 text-center pt-1">
                  +{actionItems.length - (compact ? 3 : 5)} more items
                </p>
              )}
            </div>
          </section>
        )}

        {/* Next Steps Section */}
        {nextSteps.length > 0 && (
          <section>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
              <ArrowRight className="w-4 h-4 text-orange-600" />
              Next Steps
            </h4>
            <ul className="space-y-2">
              {nextSteps.map((step, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-gray-700"
                >
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Empty State */}
        {decisions.length === 0 && actionItems.length === 0 && nextSteps.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No summary data extracted from this meeting</p>
          </div>
        )}
      </div>

      {/* Footer with CRM Publish */}
      {actionItems.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-lg">
          {publishError && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {publishError}
            </div>
          )}

          {publishSuccess && !publishError && (
            <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Successfully published to Logos CRM
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {allSynced ? (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-3 h-3" />
                  All items synced to CRM
                </span>
              ) : (
                <span>
                  {actionItems.filter(i => i.crm_sync_status === 'pending').length} items pending sync
                </span>
              )}
            </div>

            <button
              onClick={handlePublishToCRM}
              disabled={publishing || allSynced}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${allSynced
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50'
                }
              `}
            >
              {publishing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Publishing...
                </>
              ) : allSynced ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Published
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Publish to Logos CRM
                  <ExternalLink className="w-3 h-3" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Priority Badge Component
 */
function PriorityBadge({ priority }) {
  const config = {
    high: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      label: 'High'
    },
    medium: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-700',
      label: 'Medium'
    },
    low: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      label: 'Low'
    }
  }

  const { bg, text, label } = config[priority] || config.medium

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  )
}

/**
 * Compact variant for sidebar use
 */
export function MeetingSummaryWidgetCompact(props) {
  return <MeetingSummaryWidget {...props} compact={true} />
}
