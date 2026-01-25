import React from 'react'
import { ArrowDown, AlertTriangle, Clock, XCircle, CheckCircle2 } from 'lucide-react'

/**
 * BlockingChainDiagram - Vertical flow diagram showing task blocking chains
 *
 * Displays:
 * - Task nodes in vertical flow
 * - Status indicators (overdue, waiting, completed)
 * - Arrows showing dependencies
 * - Owner information
 * - Chain statistics
 */
export default function BlockingChainDiagram({ chains, className = '' }) {
  if (!chains || chains.length === 0) return null

  const getStatusIcon = (status) => {
    switch (status) {
      case 'overdue':
        return <XCircle className="w-4 h-4 text-semantic-error" />
      case 'waiting':
        return <Clock className="w-4 h-4 text-content-tertiary" />
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-semantic-success" />
      default:
        return <Clock className="w-4 h-4 text-content-tertiary" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'overdue':
        return 'border-semantic-error bg-semantic-error-dim'
      case 'waiting':
        return 'border-line-default bg-surface-muted'
      case 'completed':
        return 'border-semantic-success bg-semantic-success-dim'
      default:
        return 'border-line-default bg-surface-muted'
    }
  }

  const getStatusTextColor = (status) => {
    switch (status) {
      case 'overdue':
        return 'text-semantic-error'
      case 'waiting':
        return 'text-content-tertiary'
      case 'completed':
        return 'text-semantic-success'
      default:
        return 'text-content-secondary'
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-semantic-warning" />
        <h5 className="text-sm font-semibold text-content-primary">
          Blocking Chains Detected
        </h5>
      </div>

      {chains.map((chain, chainIndex) => (
        <div key={chainIndex} className="bg-semantic-warning-dim border border-semantic-warning rounded-lg p-4">
          {/* Chain Header */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-semantic-warning">
            <div>
              <p className="font-semibold text-semantic-warning">
                Chain #{chainIndex + 1}
              </p>
              <p className="text-xs text-content-secondary mt-1">
                {chain.totalBlocked} task{chain.totalBlocked !== 1 ? 's' : ''} blocked • {chain.chainLength} step{chain.chainLength !== 1 ? 's' : ''}
              </p>
            </div>
            {chain.rootTask && (
              <div className="text-right">
                <p className="text-xs text-content-tertiary">Root Cause</p>
                <p className="text-sm font-medium text-semantic-warning">
                  {chain.rootTask}
                </p>
              </div>
            )}
          </div>

          {/* Chain Flow */}
          <div className="space-y-0">
            {chain.nodes.map((node, nodeIndex) => (
              <div key={nodeIndex} className="relative">
                {/* Task Node */}
                <div className={`border rounded-lg p-3 ${getStatusColor(node.status)}`}>
                  <div className="flex items-start gap-3">
                    {/* Status Icon */}
                    <div className="mt-0.5">
                      {getStatusIcon(node.status)}
                    </div>

                    {/* Task Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-content-primary">
                        {node.task}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-content-secondary">
                          Owner: {node.owner}
                        </span>
                        <span className={`text-xs font-medium uppercase tracking-wide ${getStatusTextColor(node.status)}`}>
                          {node.status}
                        </span>
                        {node.isOverdue && node.daysOverdue && (
                          <span className="text-xs text-semantic-error font-medium">
                            {node.daysOverdue}d overdue
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Arrow Connector */}
                {nodeIndex < chain.nodes.length - 1 && (
                  <div className="flex items-center justify-center py-2">
                    <div className="flex flex-col items-center">
                      <div className="w-0.5 h-4 bg-semantic-warning"></div>
                      <ArrowDown className="w-4 h-4 text-semantic-warning" />
                      <div className="w-0.5 h-4 bg-semantic-warning"></div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Chain Impact */}
          {chain.totalBlocked > 0 && (
            <div className="mt-4 pt-3 border-t border-semantic-warning">
              <p className="text-xs text-semantic-warning font-medium flex items-center gap-2">
                <AlertTriangle className="w-3 h-3" />
                Resolving the root task will unblock {chain.totalBlocked} downstream task{chain.totalBlocked !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
