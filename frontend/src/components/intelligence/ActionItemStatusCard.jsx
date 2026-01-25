import React from 'react'
import { CheckCircle2, Clock, AlertTriangle, XCircle, Users, ArrowRight } from 'lucide-react'
import ExpandableCard from './ExpandableCard'

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
        <h4 className="font-semibold text-gray-900 mb-3">From Last Week's Meetings</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-xs font-medium text-green-900">Completed</span>
            </div>
            <p className="text-lg font-bold text-green-900">
              {summary.completed}/{summary.total}
            </p>
            <div className="w-full h-1.5 bg-green-200 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-green-600 rounded-full transition-all"
                style={{ width: `${(summary.completionRate * 100).toFixed(0)}%` }}
              />
            </div>
            <p className="text-xs text-green-700 mt-1">
              {(summary.completionRate * 100).toFixed(0)}%
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-900">Overdue</span>
            </div>
            <p className="text-lg font-bold text-amber-900">
              {summary.overdue}
            </p>
            <p className="text-xs text-amber-700 mt-1">
              {((summary.overdue / summary.total) * 100).toFixed(0)}% of total
            </p>
          </div>

          {summary.blocked > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-4 h-4 text-red-600" />
                <span className="text-xs font-medium text-red-900">Blocked</span>
              </div>
              <p className="text-lg font-bold text-red-900">
                {summary.blocked}
              </p>
              <p className="text-xs text-red-700 mt-1">Action required</p>
            </div>
          )}

          {summary.inProgress > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-900">In Progress</span>
              </div>
              <p className="text-lg font-bold text-blue-900">
                {summary.inProgress}
              </p>
              <p className="text-xs text-blue-700 mt-1">On track</p>
            </div>
          )}
        </div>
      </div>

      {/* Critical overdue items */}
      {criticalOverdue && criticalOverdue.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Critical Overdue ({criticalOverdue.length})
          </h5>
          <div className="space-y-2">
            {criticalOverdue.slice(0, 3).map((item, index) => (
              <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-medium text-gray-900 flex-1">{item.task}</p>
                  <span className="text-xs font-semibold text-red-600 flex-shrink-0">
                    {item.daysOverdue}d overdue
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Users className="w-3 h-3" />
                  <span>Assigned: {item.assignedTo}</span>
                </div>
                {item.isBlocking && item.blockedTasks && item.blockedTasks.length > 0 && (
                  <div className="mt-2 bg-red-100 border border-red-300 rounded px-2 py-1 text-xs text-red-800">
                    <span className="font-medium">⚠ Blocking {item.blockedTasks.length} task(s)</span>
                  </div>
                )}
                {item.relatedDeal && (
                  <div className="mt-2 text-xs text-gray-600">
                    Deal: {item.relatedDeal.name} (${item.relatedDeal.value.toLocaleString()})
                  </div>
                )}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => onAction('nudge', item.id)}
                    className="px-2 py-1 text-xs font-medium bg-white border border-red-300 text-red-700 rounded hover:bg-red-50 transition-colors"
                  >
                    Nudge Owner
                  </button>
                  <button
                    onClick={() => onAction('reassign', item.id)}
                    className="px-2 py-1 text-xs font-medium bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                  >
                    Reassign
                  </button>
                  <button
                    onClick={() => onAction('complete', item.id)}
                    className="px-2 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
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
          <h5 className="text-xs font-semibold text-gray-700 mb-2">Week-over-Week Trends</h5>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700">Completion Rate:</span>
              <span className={`font-semibold flex items-center gap-1 ${
                trends.weekOverWeek.completionRate >= 0 ? 'text-green-600' : 'text-red-600'
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
              <span className="text-gray-700">Avg Time to Complete:</span>
              <span className={`font-semibold ${
                trends.weekOverWeek.avgTimeToComplete <= 0 ? 'text-green-600' : 'text-red-600'
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
          <h5 className="text-xs font-semibold text-gray-700 mb-2">Team Benchmarks</h5>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-800">Your Completion Rate:</span>
              <span className="font-semibold text-blue-900">
                {(benchmarks.userCompletionRate * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-800">Team Average:</span>
              <span className="font-semibold text-blue-900">
                {(benchmarks.teamAverage * 100).toFixed(0)}%
              </span>
            </div>
            {benchmarks.topPerformer && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-800">Top Performer:</span>
                <span className="font-semibold text-blue-900">
                  {benchmarks.topPerformer.name} ({(benchmarks.topPerformer.rate * 100).toFixed(0)}%)
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Blocking chains visualization */}
      {blockingChains && blockingChains.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-700 mb-2">Blocking Chains Detected</h5>
          {blockingChains.map((chain, index) => (
            <div key={index} className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-amber-900">
                  Chain {index + 1}: {chain.totalBlocked} task(s) blocked
                </p>
                <span className="text-xs text-amber-700">
                  Length: {chain.chainLength}
                </span>
              </div>
              <div className="space-y-2">
                {chain.nodes.map((node, nodeIndex) => (
                  <div key={nodeIndex} className="relative">
                    <div className="flex items-start gap-2">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        node.status === 'overdue' ? 'bg-red-500' :
                        node.status === 'waiting' ? 'bg-gray-400' : 'bg-green-500'
                      }`} />
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">{node.task}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-600">
                          <span>{node.owner}</span>
                          <span className={`font-medium ${
                            node.status === 'overdue' ? 'text-red-600' :
                            node.status === 'waiting' ? 'text-gray-500' : 'text-green-600'
                          }`}>
                            {node.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    {nodeIndex < chain.nodes.length - 1 && (
                      <div className="ml-1 h-4 w-0.5 bg-amber-300" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All overdue items */}
      {criticalOverdue && criticalOverdue.length > 3 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-700 mb-2">
            All Overdue Items ({criticalOverdue.length})
          </h5>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {criticalOverdue.map((item, index) => (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded p-2 text-sm">
                <p className="text-gray-900 font-medium">{item.task}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                  <span>{item.assignedTo}</span>
                  <span className="text-red-600">{item.daysOverdue}d overdue</span>
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
