import React, { useState } from 'react'
import { User, AlertCircle, Calendar, Sparkles, ThumbsUp, ThumbsDown, HelpCircle } from 'lucide-react'
import ExplanationModal from '../explainability/ExplanationModal'

/**
 * AgentRecommendationPanel - AI agent recommendations for task creation/editing
 *
 * Displays recommendations from:
 * - Assignment Agent: Who should own this task
 * - Priority Agent: What priority level
 * - Deadline Agent: When it should be due
 *
 * Features:
 * - Confidence scores for each recommendation
 * - Explainability: "Why?" buttons to see AI reasoning
 * - Accept/Override with feedback capture
 * - Visual confidence indicators
 */
export default function AgentRecommendationPanel({
  recommendations,
  onAccept,
  onOverride,
  taskData,
  className = ''
}) {
  const [showExplanation, setShowExplanation] = useState(null)
  const [feedbackCapture, setFeedbackCapture] = useState({})

  if (!recommendations) return null

  const { assignment, priority, deadline } = recommendations

  // Confidence level color
  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'text-semantic-success'
    if (confidence >= 0.6) return 'text-semantic-warning'
    return 'text-semantic-error'
  }

  // Confidence badge
  const getConfidenceBadge = (confidence) => {
    if (confidence >= 0.8) return 'bg-semantic-success-dim text-semantic-success border-semantic-success'
    if (confidence >= 0.6) return 'bg-semantic-warning-dim text-semantic-warning border-semantic-warning'
    return 'bg-semantic-error-dim text-semantic-error border-semantic-error'
  }

  const handleAccept = (type, value) => {
    onAccept?.(type, value)
  }

  const handleOverride = (type, reason) => {
    setFeedbackCapture({ ...feedbackCapture, [type]: reason })
    onOverride?.(type, reason)
  }

  const handleExplain = (type) => {
    const explanationData = {
      assignment: assignment?.explanation,
      priority: priority?.explanation,
      deadline: deadline?.explanation
    }
    setShowExplanation(explanationData[type])
  }

  return (
    <div className={`bg-accent-primary-dim border border-accent-primary rounded-lg p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-accent-primary" />
        <h3 className="font-semibold text-content-primary">AI Recommendations</h3>
        <span className="text-xs text-content-tertiary">
          Based on task context and historical patterns
        </span>
      </div>

      <div className="space-y-3">
        {/* Assignment Recommendation */}
        {assignment && (
          <div className="bg-surface border border-line-default rounded-lg p-3">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-start gap-2 flex-1">
                <User className="w-4 h-4 text-accent-primary mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-content-secondary mb-1">
                    Recommended Assignee
                  </p>
                  <p className="text-sm font-medium text-content-primary">
                    {assignment.recommended_user?.name || assignment.recommended_user?.email}
                  </p>
                  {assignment.reasoning_preview && (
                    <p className="text-xs text-content-tertiary mt-1">
                      {assignment.reasoning_preview}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getConfidenceBadge(assignment.confidence)}`}>
                  {(assignment.confidence * 100).toFixed(0)}%
                </span>
                <button
                  onClick={() => handleExplain('assignment')}
                  className="p-1 hover:bg-surface-muted rounded transition-colors"
                  title="Why this recommendation?"
                >
                  <HelpCircle className="w-4 h-4 text-content-tertiary" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAccept('assignment', assignment.recommended_user)}
                className="btn btn-xs bg-semantic-success text-white hover:opacity-90"
              >
                <ThumbsUp className="w-3 h-3" />
                Accept
              </button>
              <button
                onClick={() => handleOverride('assignment', 'user_preference')}
                className="btn btn-xs btn-ghost"
              >
                <ThumbsDown className="w-3 h-3" />
                Override
              </button>
            </div>
          </div>
        )}

        {/* Priority Recommendation */}
        {priority && (
          <div className="bg-surface border border-line-default rounded-lg p-3">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-start gap-2 flex-1">
                <AlertCircle className="w-4 h-4 text-accent-primary mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-content-secondary mb-1">
                    Suggested Priority
                  </p>
                  <p className="text-sm font-medium text-content-primary capitalize">
                    {priority.recommended_priority}
                  </p>
                  {priority.reasoning_preview && (
                    <p className="text-xs text-content-tertiary mt-1">
                      {priority.reasoning_preview}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getConfidenceBadge(priority.confidence)}`}>
                  {(priority.confidence * 100).toFixed(0)}%
                </span>
                <button
                  onClick={() => handleExplain('priority')}
                  className="p-1 hover:bg-surface-muted rounded transition-colors"
                  title="Why this recommendation?"
                >
                  <HelpCircle className="w-4 h-4 text-content-tertiary" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAccept('priority', priority.recommended_priority)}
                className="btn btn-xs bg-semantic-success text-white hover:opacity-90"
              >
                <ThumbsUp className="w-3 h-3" />
                Accept
              </button>
              <button
                onClick={() => handleOverride('priority', 'user_preference')}
                className="btn btn-xs btn-ghost"
              >
                <ThumbsDown className="w-3 h-3" />
                Override
              </button>
            </div>
          </div>
        )}

        {/* Deadline Recommendation */}
        {deadline && (
          <div className="bg-surface border border-line-default rounded-lg p-3">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-start gap-2 flex-1">
                <Calendar className="w-4 h-4 text-accent-primary mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-content-secondary mb-1">
                    Recommended Deadline
                  </p>
                  <p className="text-sm font-medium text-content-primary">
                    {new Date(deadline.recommended_deadline).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                    <span className="text-xs text-content-tertiary ml-2">
                      ({deadline.days_from_now} days)
                    </span>
                  </p>
                  {deadline.reasoning_preview && (
                    <p className="text-xs text-content-tertiary mt-1">
                      {deadline.reasoning_preview}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getConfidenceBadge(deadline.confidence)}`}>
                  {(deadline.confidence * 100).toFixed(0)}%
                </span>
                <button
                  onClick={() => handleExplain('deadline')}
                  className="p-1 hover:bg-surface-muted rounded transition-colors"
                  title="Why this recommendation?"
                >
                  <HelpCircle className="w-4 h-4 text-content-tertiary" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAccept('deadline', deadline.recommended_deadline)}
                className="btn btn-xs bg-semantic-success text-white hover:opacity-90"
              >
                <ThumbsUp className="w-3 h-3" />
                Accept
              </button>
              <button
                onClick={() => handleOverride('deadline', 'user_preference')}
                className="btn btn-xs btn-ghost"
              >
                <ThumbsDown className="w-3 h-3" />
                Override
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Explanation Modal */}
      {showExplanation && (
        <ExplanationModal
          explanation={showExplanation}
          onClose={() => setShowExplanation(null)}
        />
      )}
    </div>
  )
}
