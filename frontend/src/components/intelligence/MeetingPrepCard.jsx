import React from 'react'
import { Calendar, Users, DollarSign, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react'
import ExpandableCard from './ExpandableCard'

/**
 * MeetingPrepCard - Meeting preparation intelligence card
 *
 * Displays:
 * - Meeting title, time, attendees
 * - Sentiment trend analysis
 * - Overdue action items count
 * - AI-generated talking points
 * - Quick actions for meeting prep
 */
export default function MeetingPrepCard({ data, onAction }) {
  if (!data || !data.meeting) return null

  const { meeting, dealContext, history, sentiment, actionItems, insights, talkingPoints } = data

  // Format time
  const meetingTime = new Date(meeting.scheduledAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })

  // Sentiment trend icon
  const getSentimentIcon = () => {
    if (sentiment.trend === 'improving') return <TrendingUp className="w-4 h-4 text-green-600" />
    if (sentiment.trend === 'declining') return <TrendingDown className="w-4 h-4 text-red-600" />
    return <Minus className="w-4 h-4 text-gray-600" />
  }

  // Sentiment color
  const getSentimentColor = () => {
    if (sentiment.current === 'positive') return 'text-green-600'
    if (sentiment.current === 'negative') return 'text-red-600'
    return 'text-gray-600'
  }

  // Compact content
  const compactContent = (
    <div className="space-y-3">
      {/* Meeting header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-indigo-500 flex-shrink-0" />
            <h4 className="font-semibold text-gray-900 truncate">{meeting.title}</h4>
          </div>
          <p className="text-sm text-gray-500">{meetingTime}</p>
        </div>
        {dealContext && (
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-medium text-gray-900">{dealContext.name}</p>
            <p className="text-xs text-gray-500">
              ${dealContext.value.toLocaleString()} • {dealContext.stage}
            </p>
          </div>
        )}
      </div>

      {/* Attendees preview */}
      {meeting.attendees && meeting.attendees.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Users className="w-3 h-3" />
          <span>
            {meeting.attendees.slice(0, 3).map(a => a.name || a.email).join(', ')}
            {meeting.attendees.length > 3 && ` +${meeting.attendees.length - 3} more`}
          </span>
        </div>
      )}

      {/* Key context */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <h5 className="text-xs font-semibold text-blue-900 mb-2 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Key Context
        </h5>
        <div className="space-y-1.5">
          {history && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-blue-800">Last contact:</span>
              <span className="font-medium text-blue-900">
                {history.daysSinceLastContact} days ago
              </span>
            </div>
          )}
          {sentiment && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-blue-800">Sentiment:</span>
              <div className="flex items-center gap-1">
                {getSentimentIcon()}
                <span className={`font-medium ${getSentimentColor()}`}>
                  {sentiment.current.charAt(0).toUpperCase() + sentiment.current.slice(1)}
                  {sentiment.trend !== 'stable' && ` (${sentiment.trend})`}
                </span>
              </div>
            </div>
          )}
          {actionItems && actionItems.overdue > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-blue-800">Overdue items:</span>
              <span className="font-medium text-red-600">{actionItems.overdue}</span>
            </div>
          )}
          {insights && insights.competitorMentions && insights.competitorMentions.length > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-blue-800">Competitor mentioned:</span>
              <span className="font-medium text-amber-600">
                {insights.competitorMentions[0]}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Talking points preview */}
      {talkingPoints && talkingPoints.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-700 mb-2">Suggested Talking Points:</h5>
          <ul className="space-y-1">
            {talkingPoints.slice(0, 3).map((point, index) => (
              <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-primary-600 mt-1">•</span>
                <span className="flex-1">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )

  // Expanded content
  const expandedContent = (
    <div className="space-y-4">
      {/* Full attendee list */}
      {meeting.attendees && meeting.attendees.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-700 mb-2">All Attendees ({meeting.attendees.length})</h5>
          <div className="space-y-2">
            {meeting.attendees.map((attendee, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-medium text-xs">
                  {(attendee.name || attendee.email || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{attendee.name || attendee.email}</p>
                  {attendee.title && (
                    <p className="text-xs text-gray-500">{attendee.title}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sentiment history */}
      {sentiment && sentiment.history && sentiment.history.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-700 mb-2">Sentiment Trend</h5>
          <div className="space-y-2">
            {sentiment.history.map((item, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-20">
                  {new Date(item.date).toLocaleDateString()}
                </span>
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      item.sentiment === 'positive' ? 'bg-green-500' :
                      item.sentiment === 'negative' ? 'bg-red-500' : 'bg-gray-400'
                    }`}
                    style={{ width: `${item.score}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-700 w-12 text-right">
                  {item.score}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overdue action items */}
      {actionItems && actionItems.items && actionItems.items.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-700 mb-2">
            Action Items ({actionItems.overdue} overdue)
          </h5>
          <div className="space-y-2">
            {actionItems.items.map((item, index) => (
              <div key={index} className="bg-amber-50 border border-amber-200 rounded p-2 text-sm">
                <p className="text-gray-900">{item.task}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                  <span>{item.owner}</span>
                  <span>•</span>
                  <span className="text-red-600">Due: {new Date(item.dueDate).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All talking points */}
      {talkingPoints && talkingPoints.length > 3 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-700 mb-2">All Talking Points</h5>
          <ul className="space-y-1.5">
            {talkingPoints.map((point, index) => (
              <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-primary-600 mt-1">•</span>
                <span className="flex-1">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )

  // Quick actions
  const actions = [
    {
      label: 'Prepare Brief',
      handler: () => onAction('prepareBrief', meeting.id),
      primary: true
    },
    {
      label: 'Reschedule',
      handler: () => onAction('reschedule', meeting.id)
    }
  ]

  return (
    <ExpandableCard
      compactContent={compactContent}
      expandedContent={expandedContent}
      actions={actions}
      className="mb-3"
    />
  )
}
