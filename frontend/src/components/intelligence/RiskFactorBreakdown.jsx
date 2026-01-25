import React from 'react'
import { AlertTriangle } from 'lucide-react'

/**
 * RiskFactorBreakdown - Weighted horizontal bars showing risk factors
 *
 * Displays each risk factor with:
 * - Factor name and impact level
 * - Weight percentage
 * - Score bar (color-coded by impact)
 * - Detail text
 */
export default function RiskFactorBreakdown({ factors, className = '' }) {
  if (!factors || factors.length === 0) return null

  const getImpactColor = (impact) => {
    switch (impact) {
      case 'high':
        return { bar: 'bg-semantic-error', text: 'text-semantic-error', bg: 'bg-semantic-error-dim' }
      case 'medium':
        return { bar: 'bg-semantic-warning', text: 'text-semantic-warning', bg: 'bg-semantic-warning-dim' }
      case 'low':
        return { bar: 'bg-semantic-success', text: 'text-semantic-success', bg: 'bg-semantic-success-dim' }
      default:
        return { bar: 'bg-surface-muted', text: 'text-content-tertiary', bg: 'bg-surface-muted' }
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-accent-primary" />
        <h5 className="text-sm font-semibold text-content-primary">
          Risk Factor Breakdown
        </h5>
        <span className="text-xs text-content-tertiary">
          (Weighted by importance)
        </span>
      </div>

      {factors.map((factor, index) => {
        const colors = getImpactColor(factor.impact)
        const weightPercentage = (factor.weight * 100).toFixed(0)

        return (
          <div key={index} className={`${colors.bg} border border-${factor.impact === 'high' ? 'semantic-error' : factor.impact === 'medium' ? 'semantic-warning' : 'semantic-success'} rounded-lg p-3`}>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold ${colors.text} uppercase tracking-wide`}>
                    {factor.impact} Impact
                  </span>
                  <span className="text-xs text-content-tertiary">
                    • Weight: {weightPercentage}%
                  </span>
                </div>
                <p className="font-medium text-content-primary">{factor.factor}</p>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-bold ${colors.text}`}>
                  {factor.score}
                </p>
                <p className="text-xs text-content-tertiary">/ 100</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-surface rounded-full overflow-hidden mb-2">
              <div
                className={`h-full ${colors.bar} rounded-full transition-all duration-500`}
                style={{ width: `${factor.score}%` }}
              />
            </div>

            {/* Detail */}
            {factor.detail && (
              <p className="text-sm text-content-secondary">
                {factor.detail}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
