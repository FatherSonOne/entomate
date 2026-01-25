import React from 'react'
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import ExpandableCard from './ExpandableCard'

/**
 * DealRiskAlertCard - Deal risk alert card with risk scoring
 *
 * Displays:
 * - Deal name, value, stage
 * - Risk score badge (color-coded)
 * - Top risk factors with impact levels
 * - Recommended recovery actions
 */
export default function DealRiskAlertCard({ data, onAction }) {
  if (!data || !data.deal) return null

  const { deal, riskScore, riskFactors, predictions, recommendedActions } = data

  // Risk level colors
  const getRiskColor = (level) => {
    switch (level) {
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'medium':
        return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Risk level emoji
  const getRiskEmoji = (level) => {
    switch (level) {
      case 'low':
        return '🟢'
      case 'medium':
        return '🟡'
      case 'high':
        return '🟠'
      case 'critical':
        return '🔴'
      default:
        return '⚪'
    }
  }

  // Impact level colors
  const getImpactColor = (impact) => {
    switch (impact) {
      case 'high':
        return 'text-red-600'
      case 'medium':
        return 'text-amber-600'
      case 'low':
        return 'text-green-600'
      default:
        return 'text-gray-600'
    }
  }

  // Trend icon
  const getTrendIcon = () => {
    if (riskScore.trend === 'improving') return <TrendingDown className="w-4 h-4 text-green-600" />
    if (riskScore.trend === 'worsening') return <TrendingUp className="w-4 h-4 text-red-600" />
    return <Minus className="w-4 h-4 text-gray-600" />
  }

  // Compact content
  const compactContent = (
    <div className="space-y-3">
      {/* Deal header with risk badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 truncate mb-1">{deal.name}</h4>
          <p className="text-sm text-gray-500">
            ${deal.value.toLocaleString()} • {deal.stage}
          </p>
        </div>
        <div className={`px-3 py-1.5 rounded-lg border font-medium text-sm flex items-center gap-2 ${getRiskColor(riskScore.level)}`}>
          <span>{getRiskEmoji(riskScore.level)}</span>
          <span>Risk: {riskScore.score}/100</span>
        </div>
      </div>

      {/* Risk trend */}
      {riskScore.trend && riskScore.trend !== 'stable' && (
        <div className="flex items-center gap-2 text-xs">
          {getTrendIcon()}
          <span className="text-gray-600">
            Trend: {riskScore.trend.charAt(0).toUpperCase() + riskScore.trend.slice(1)}
          </span>
        </div>
      )}

      {/* Top risk factors */}
      {riskFactors && riskFactors.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-700 mb-2">Top Risk Factors:</h5>
          <div className="space-y-2">
            {riskFactors.slice(0, 3).map((factor, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <span className={`font-semibold ${getImpactColor(factor.impact)}`}>
                  {factor.impact === 'high' ? '🔴' : factor.impact === 'medium' ? '🟡' : '🟢'}
                </span>
                <div className="flex-1">
                  <p className="text-gray-900">{factor.factor}</p>
                  {factor.detail && (
                    <p className="text-xs text-gray-600 mt-0.5">{factor.detail}</p>
                  )}
                </div>
                <span className={`text-xs font-medium ${getImpactColor(factor.impact)}`}>
                  {factor.impact.charAt(0).toUpperCase() + factor.impact.slice(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended actions preview */}
      {recommendedActions && recommendedActions.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <h5 className="text-xs font-semibold text-purple-900 mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Recommended Actions
          </h5>
          <ol className="space-y-1.5">
            {recommendedActions.slice(0, 3).map((action, index) => (
              <li key={index} className="text-sm text-purple-900 flex items-start gap-2">
                <span className="font-semibold">{index + 1}.</span>
                <span className="flex-1">{action.action}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )

  // Expanded content
  const expandedContent = (
    <div className="space-y-4">
      {/* All risk factors with details */}
      {riskFactors && riskFactors.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-700 mb-3">
            All Risk Factors (Weighted)
          </h5>
          <div className="space-y-3">
            {riskFactors.map((factor, index) => (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-start gap-2 flex-1">
                    <span className={`font-semibold ${getImpactColor(factor.impact)}`}>
                      {factor.impact === 'high' ? '🔴' : factor.impact === 'medium' ? '🟡' : '🟢'}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{factor.factor}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Weight: {(factor.weight * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{factor.score}/100</p>
                    <p className={`text-xs font-medium ${getImpactColor(factor.impact)}`}>
                      {factor.impact.charAt(0).toUpperCase() + factor.impact.slice(1)}
                    </p>
                  </div>
                </div>
                {factor.detail && (
                  <p className="text-sm text-gray-700 ml-6">{factor.detail}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Predictions */}
      {predictions && (
        <div>
          <h5 className="text-xs font-semibold text-gray-700 mb-2">Predictions</h5>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-800">Churn risk (90 days):</span>
              <span className="font-semibold text-blue-900">
                {(predictions.churnRisk * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-800">Close probability:</span>
              <span className="font-semibold text-blue-900">
                {(predictions.closeProbability * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-800">Expected close:</span>
              <span className="font-semibold text-blue-900">
                {new Date(predictions.expectedCloseDate).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-800">Confidence:</span>
              <span className="font-semibold text-blue-900">
                {(predictions.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* All recommended actions */}
      {recommendedActions && recommendedActions.length > 3 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-700 mb-2">All Recommended Actions</h5>
          <ol className="space-y-2">
            {recommendedActions.map((action, index) => (
              <li key={index} className="text-sm flex items-start gap-2">
                <span className="font-semibold text-gray-700">{index + 1}.</span>
                <div className="flex-1">
                  <p className="text-gray-900">{action.action}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                    <span>Priority: <span className={`font-medium ${
                      action.priority === 'high' ? 'text-red-600' :
                      action.priority === 'medium' ? 'text-amber-600' : 'text-green-600'
                    }`}>{action.priority}</span></span>
                    <span>Effort: <span className="font-medium">{action.effort}</span></span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )

  // Quick actions
  const actions = [
    {
      label: 'Schedule Call',
      handler: () => onAction('scheduleCall', deal.id),
      primary: true
    },
    {
      label: 'Create Task',
      handler: () => onAction('createTask', deal.id)
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
