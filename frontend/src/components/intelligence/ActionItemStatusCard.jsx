import React from 'react'
import { CheckCircle2, Clock, AlertTriangle, XCircle, Users, ArrowRight } from 'lucide-react'
import ExpandableCard from './ExpandableCard'
import BlockingChainDiagram from './BlockingChainDiagram'

/**
 * ActionItemStatusCard - Action item tracking card
 *
 * Displays:
 * - Summary metrics (total, completed, overdue, completion rate)
 * - Completion rate progress bar
 * - Critical overdue items
 * - Blocking chains if detected
 */
export default function ActionItemStatusCard({ data, onAction }) {
  if (!data) return null

  const { summary, trends, benchmarks, criticalOverdue, blockingChains } = data

  // Compact content
  const compactContent = (
    <div className="space-y-4">
      {/* Summary metrics */}
      <div>
        <h4 className="font-semibold text-content-primary mb-3">From Last Week's Meetings</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-semantic-success-dim border border-semantic-success rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-semantic-success" />
              <span className="text-xs font-medium text-semantic-success">Completed</span>
            </div>
            <p className="text-lg font-bold text-semantic-success">
              {summary.completed}/{summary.total}
            </p>
            <div className="w-full h-1.5 bg-green-200 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-semantic-success rounded-full transition-all"
                style={{ width: `${(summary.completionRate * 100).toFixed(0)}%` }}
              />
            </div>
            <p className="text-xs text-semantic-success mt-1">
              {(summary.completionRate * 100).toFixed(0)}%
            </p>
          </div>

          <div className="bg-semantic-warning-dim border border-semantic-warning rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-semantic-warning" />
              <span className="text-xs font-medium text-semantic-warning">Overdue</span>
            </div>
            <p className="text-lg font-bold text-semantic-warning">
              {summary.overdue}
            </p>
            <p className="text-xs text-semantic-warning mt-1">
              {((summary.overdue / summary.total) * 100).toFixed(0)}% of total
            </p>
          </div>

          {summary.blocked > 0 && (
            <div className="bg-semantic-error-dim border border-semantic-error rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-4 h-4 text-semantic-error" />
                <span className="text-xs font-medium text-semantic-error">Blocked</span>
              </div>
              <p className="text-lg font-bold text-semantic-error">
                {summary.blocked}
              </p>
              <p className="text-xs text-semantic-error mt-1">Action required</p>
            </div>
          )}

          {summary.inProgress > 0 && (
            <div className="bg-semantic-info-dim border border-semantic-info rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-semantic-info" />
                <span className="text-xs font-medium text-semantic-info">In Progress</span>
              </div>
              <p className="text-lg font-bold text-semantic-info">
                {summary.inProgress}
              </p>
              <p className="text-xs text-semantic-info mt-1">On track</p>
            </div>
          )}
        </div>
      </div>

      {/* Critical overdue items */}
      {criticalOverdue && criticalOverdue.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-content-secondary mb-2 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4 text-semantic-error" />
            Critical Overdue ({criticalOverdue.length})
          </h5>
          <div className="space-y-2">
            {criticalOverdue.slice(0, 3).map((item, index) => (
              <div key={index} className="bg-semantic-error-dim border border-semantic-error rounded-lg p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-medium text-content-primary flex-1">{item.task}</p>
                  <span className="text-xs font-semibold text-semantic-error flex-shrink-0">
                    {item.daysOverdue}d overdue
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-content-secondary">
                  <Users className="w-3 h-3" />
                  <span>Assigned: {item.assignedTo}</span>
                </div>
                {item.isBlocking && item.blockedTasks && item.blockedTasks.length > 0 && (
                  <div className="mt-2 bg-semantic-error-dim border border-semantic-error rounded px-2 py-1 text-xs text-semantic-error">
                    <span className="font-medium">⚠ Blocking {item.blockedTasks.length} task(s)</span>
                  </div>
                )}
                {item.relatedDeal && (
                  <div className="mt-2 text-xs text-content-secondary">
                    Deal: {item.relatedDeal.name} (${item.relatedDeal.value.toLocaleString()})
                  </div>
                )}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => onAction('nudge', item.id)}
                    className="px-2 py-1 text-xs font-medium bg-surface border border-semantic-error text-semantic-error rounded hover:bg-semantic-error-dim transition-colors"
                  >
                    Nudge Owner
                  </button>
                  <button
                    onClick={() => onAction('reassign', item.id)}
                    className="px-2 py-1 text-xs font-medium bg-surface border border-line-strong text-content-secondary rounded hover:bg-surface-muted transition-colors"
                  >
                    Reassign
                  </button>
                  <button
                    onClick={() => onAction('complete', item.id)}
                    className="px-2 py-1 text-xs font-medium bg-semantic-success text-white rounded hover:opacity-90 transition-colors"
                  >
                    Mark Complete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // Expanded content
  const expandedContent = (
    <div className="space-y-4">
      {/* Trends */}
      {trends && trends.weekOverWeek && (
        <div>
          <h5 className="text-xs font-semibold text-content-secondary mb-2">Week-over-Week Trends</h5>
          <div className="bg-surface-muted border border-line-default rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-content-secondary">Completion Rate:</span>
              <span className={`font-semibold flex items-center gap-1 ${
                trends.weekOverWeek.completionRate >= 0 ? 'text-semantic-success' : 'text-semantic-error'
              }`}>
                {(summary.completionRate * 100).toFixed(0)}%
                {trends.weekOverWeek.completionRate !== 0 && (
                  <span className="text-xs">
                    ({trends.weekOverWeek.completionRate > 0 ? '+' : ''}
                    {(trends.weekOverWeek.completionRate * 100).toFixed(0)}%)
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-content-secondary">Avg Time to Complete:</span>
              <span className={`font-semibold ${
                trends.weekOverWeek.avgTimeToComplete <= 0 ? 'text-semantic-success' : 'text-semantic-error'
              }`}>
                {Math.abs(trends.weekOverWeek.avgTimeToComplete).toFixed(1)} days
                {trends.weekOverWeek.avgTimeToComplete !== 0 && (
                  <span className="text-xs ml-1">
                    ({trends.weekOverWeek.avgTimeToComplete > 0 ? '+' : ''}
                    {trends.weekOverWeek.avgTimeToComplete.toFixed(1)}d)
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Benchmarks */}
      {benchmarks && (
        <div>
          <h5 className="text-xs font-semibold text-content-secondary mb-2">Team Benchmarks</h5>
          <div className="bg-semantic-info-dim border border-semantic-info rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-semantic-info">Your Completion Rate:</span>
              <span className="font-semibold text-semantic-info">
                {(benchmarks.userCompletionRate * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-semantic-info">Team Average:</span>
              <span className="font-semibold text-semantic-info">
                {(benchmarks.teamAverage * 100).toFixed(0)}%
              </span>
            </div>
            {benchmarks.topPerformer && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-semantic-info">Top Performer:</span>
                <span className="font-semibold text-semantic-info">
                  {benchmarks.topPerformer.name} ({(benchmarks.topPerformer.rate * 100).toFixed(0)}%)
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Blocking Chains - Enhanced visualization */}
      {blockingChains && blockingChains.length > 0 && (
        <BlockingChainDiagram chains={blockingChains} />
      )}

      {/* All overdue items */}
      {criticalOverdue && criticalOverdue.length > 3 && (
        <div>
          <h5 className="text-xs font-semibold text-content-secondary mb-2">
            All Overdue Items ({criticalOverdue.length})
          </h5>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {criticalOverdue.map((item, index) => (
              <div key={index} className="bg-surface-muted border border-line-default rounded p-2 text-sm">
                <p className="text-content-primary font-medium">{item.task}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-content-secondary">
                  <span>{item.assignedTo}</span>
                  <span className="text-semantic-error">{item.daysOverdue}d overdue</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <ExpandableCard
      title="Action Item Status"
      compactContent={compactContent}
      expandedContent={expandedContent}
      className="mb-3"
    />
  )
}
