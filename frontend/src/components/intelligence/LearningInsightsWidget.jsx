import React from 'react'
import { Brain, TrendingUp, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react'

/**
 * LearningInsightsWidget - Dashboard widget showing AI learning system stats
 *
 * Displays:
 * - Active patterns count
 * - Pending approvals (with "Review" button)
 * - Effectiveness improvement % (week-over-week)
 * - Quick link to full Learning Dashboard
 */
export default function LearningInsightsWidget({ insights, onReview, onNavigate, className = '' }) {
  if (!insights) return null

  const { activePatterns, pendingApprovals, effectiveness, weekOverWeek } = insights

  return (
    <div className={`bg-accent-tertiary-dim border border-accent-tertiary rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-accent-tertiary" />
          <h3 className="font-semibold text-content-primary">AI Learning System</h3>
        </div>
        {onNavigate && (
          <button
            onClick={onNavigate}
            className="text-xs text-accent-tertiary hover:text-accent-tertiary-light font-medium flex items-center gap-1"
          >
            View All
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {/* Active Patterns */}
        <div className="bg-surface border border-line-default rounded-lg p-3">
          <div className="flex items-center gap-1 mb-1">
            <CheckCircle className="w-3 h-3 text-semantic-success" />
            <span className="text-xs text-content-tertiary">Active</span>
          </div>
          <p className="text-2xl font-bold text-content-primary">
            {activePatterns || 0}
          </p>
          <p className="text-xs text-content-tertiary mt-1">Patterns</p>
        </div>

        {/* Pending Approvals */}
        <div className="bg-surface border border-line-default rounded-lg p-3">
          <div className="flex items-center gap-1 mb-1">
            <AlertCircle className="w-3 h-3 text-semantic-warning" />
            <span className="text-xs text-content-tertiary">Pending</span>
          </div>
          <p className="text-2xl font-bold text-semantic-warning">
            {pendingApprovals || 0}
          </p>
          <p className="text-xs text-content-tertiary mt-1">Reviews</p>
        </div>

        {/* Effectiveness Improvement */}
        <div className="bg-surface border border-line-default rounded-lg p-3">
          <div className="flex items-center gap-1 mb-1">
            <TrendingUp className="w-3 h-3 text-semantic-success" />
            <span className="text-xs text-content-tertiary">Improvement</span>
          </div>
          <p className={`text-2xl font-bold ${weekOverWeek >= 0 ? 'text-semantic-success' : 'text-semantic-error'}`}>
            {weekOverWeek >= 0 ? '+' : ''}{weekOverWeek}%
          </p>
          <p className="text-xs text-content-tertiary mt-1">This Week</p>
        </div>
      </div>

      {/* Effectiveness Score */}
      {effectiveness !== undefined && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-content-secondary">
              Overall Effectiveness
            </span>
            <span className="text-sm font-bold text-content-primary">
              {(effectiveness * 100).toFixed(0)}%
            </span>
          </div>
          <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                effectiveness >= 0.8 ? 'bg-semantic-success' :
                effectiveness >= 0.6 ? 'bg-semantic-info' : 'bg-semantic-warning'
              }`}
              style={{ width: `${(effectiveness * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Pending Approvals Action */}
      {pendingApprovals > 0 && onReview && (
        <button
          onClick={onReview}
          className="w-full btn btn-sm bg-accent-tertiary text-white hover:opacity-90 flex items-center justify-center gap-2"
        >
          <AlertCircle className="w-4 h-4" />
          Review {pendingApprovals} Pending Pattern{pendingApprovals !== 1 ? 's' : ''}
        </button>
      )}

      {/* No Pending Message */}
      {pendingApprovals === 0 && (
        <div className="text-center py-2">
          <CheckCircle className="w-8 h-8 text-semantic-success mx-auto mb-2" />
          <p className="text-sm text-content-secondary">
            All patterns reviewed!
          </p>
        </div>
      )}
    </div>
  )
}
