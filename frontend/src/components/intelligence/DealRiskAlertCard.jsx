import React from 'react'
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { StatusLow, StatusMedium, StatusHigh, StatusCritical, StatusUnknown } from '../icons/AnimatedIcons'
import ExpandableCard from './ExpandableCard'
import RiskFactorBreakdown from './RiskFactorBreakdown'
import PredictionGauge from './PredictionGauge'

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
        return 'bg-semantic-success-dim text-semantic-success border-semantic-success'
      case 'medium':
        return 'bg-semantic-warning-dim text-semantic-warning border-semantic-warning'
      case 'high':
        return 'bg-semantic-warning-dim text-semantic-warning border-semantic-warning'
      case 'critical':
        return 'bg-semantic-error-dim text-semantic-error border-semantic-error'
      default:
        return 'bg-surface-muted text-content-primary border-line-default'
    }
  }

  // Risk level icon
  const getRiskIcon = (level) => {
    const size = 16
    switch (level) {
      case 'low':      return <StatusLow size={size} />
      case 'medium':   return <StatusMedium size={size} />
      case 'high':     return <StatusHigh size={size} />
      case 'critical': return <StatusCritical size={size} />
      default:         return <StatusUnknown size={size} />
    }
  }

  // Impact level colors
  const getImpactColor = (impact) => {
    switch (impact) {
      case 'high':
        return 'text-semantic-error'
      case 'medium':
        return 'text-semantic-warning'
      case 'low':
        return 'text-semantic-success'
      default:
        return 'text-content-secondary'
    }
  }

  // Trend icon
  const getTrendIcon = () => {
    if (riskScore.trend === 'improving') return <TrendingDown className="w-4 h-4 text-semantic-success" />
    if (riskScore.trend === 'worsening') return <TrendingUp className="w-4 h-4 text-semantic-error" />
    return <Minus className="w-4 h-4 text-content-secondary" />
  }

  // Compact content
  const compactContent = (
    <div className="space-y-3">
      {/* Deal header with risk badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-content-primary truncate mb-1">{deal.name}</h4>
          <p className="text-sm text-content-tertiary">
            ${deal.value.toLocaleString()} • {deal.stage}
          </p>
        </div>
        <div className={`px-3 py-1.5 rounded-lg border font-medium text-sm flex items-center gap-2 ${getRiskColor(riskScore.level)}`}>
          <span className="flex items-center">{getRiskIcon(riskScore.level)}</span>
          <span>Risk: {riskScore.score}/100</span>
        </div>
      </div>

      {/* Risk trend */}
      {riskScore.trend && riskScore.trend !== 'stable' && (
        <div className="flex items-center gap-2 text-xs">
          {getTrendIcon()}
          <span className="text-content-secondary">
            Trend: {riskScore.trend.charAt(0).toUpperCase() + riskScore.trend.slice(1)}
          </span>
        </div>
      )}

      {/* Top risk factors */}
      {riskFactors && riskFactors.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-content-secondary mb-2">Top Risk Factors:</h5>
          <div className="space-y-2">
            {riskFactors.slice(0, 3).map((factor, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <span className={`flex items-center ${getImpactColor(factor.impact)}`}>
                  {factor.impact === 'high' ? <StatusCritical size={14} /> : factor.impact === 'medium' ? <StatusMedium size={14} /> : <StatusLow size={14} />}
                </span>
                <div className="flex-1">
                  <p className="text-content-primary">{factor.factor}</p>
                  {factor.detail && (
                    <p className="text-xs text-content-secondary mt-0.5">{factor.detail}</p>
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
        <div className="bg-accent-tertiary-dim border border-accent-tertiary rounded-lg p-3">
          <h5 className="text-xs font-semibold text-accent-tertiary mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Recommended Actions
          </h5>
          <ol className="space-y-1.5">
            {recommendedActions.slice(0, 3).map((action, index) => (
              <li key={index} className="text-sm text-accent-tertiary flex items-start gap-2">
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
      {/* Risk Factor Breakdown - Enhanced visualization */}
      {riskFactors && riskFactors.length > 0 && (
        <RiskFactorBreakdown factors={riskFactors} />
      )}

      {/* Predictions Gauge - Enhanced visualization */}
      {predictions && (
        <PredictionGauge predictions={predictions} riskScore={riskScore.score} />
      )}

      {/* All recommended actions */}
      {recommendedActions && recommendedActions.length > 3 && (
        <div>
          <h5 className="text-xs font-semibold text-content-secondary mb-2">All Recommended Actions</h5>
          <ol className="space-y-2">
            {recommendedActions.map((action, index) => (
              <li key={index} className="text-sm flex items-start gap-2">
                <span className="font-semibold text-content-secondary">{index + 1}.</span>
                <div className="flex-1">
                  <p className="text-content-primary">{action.action}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-content-secondary">
                    <span>Priority: <span className={`font-medium ${
                      action.priority === 'high' ? 'text-semantic-error' :
                      action.priority === 'medium' ? 'text-semantic-warning' : 'text-semantic-success'
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
