import React from 'react'
import { TrendingUp, TrendingDown, Target } from 'lucide-react'

/**
 * PredictionGauge - Circular risk meter with predictions
 *
 * Displays:
 * - Circular gauge showing overall risk level
 * - Churn risk percentage
 * - Close probability
 * - Expected close date
 * - Confidence score
 */
export default function PredictionGauge({ predictions, riskScore, className = '' }) {
  if (!predictions) return null

  const getRiskLevel = (score) => {
    if (score >= 75) return { label: 'Critical', color: 'text-semantic-error', bgColor: 'bg-semantic-error' }
    if (score >= 50) return { label: 'High', color: 'text-semantic-warning', bgColor: 'bg-semantic-warning' }
    if (score >= 25) return { label: 'Medium', color: 'text-semantic-info', bgColor: 'bg-semantic-info' }
    return { label: 'Low', color: 'text-semantic-success', bgColor: 'bg-semantic-success' }
  }

  const risk = getRiskLevel(riskScore || 0)
  const circumference = 2 * Math.PI * 45 // radius = 45
  const dashOffset = circumference - (riskScore / 100) * circumference

  return (
    <div className={`bg-surface-muted border border-line-default rounded-lg p-4 ${className}`}>
      <h5 className="text-sm font-semibold text-content-primary mb-4 flex items-center gap-2">
        <Target className="w-4 h-4" />
        AI Predictions
      </h5>

      <div className="flex items-start gap-4">
        {/* Circular Gauge */}
        <div className="flex-shrink-0">
          <div className="relative w-24 h-24">
            {/* Background circle */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="45"
                fill="none"
                stroke="var(--bg-surface)"
                strokeWidth="6"
              />
              {/* Progress circle */}
              <circle
                cx="48"
                cy="48"
                r="45"
                fill="none"
                stroke={`var(--semantic-${risk.label.toLowerCase() === 'critical' ? 'error' : risk.label.toLowerCase() === 'high' ? 'warning' : risk.label.toLowerCase() === 'medium' ? 'info' : 'success'})`}
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className={`text-2xl font-bold ${risk.color}`}>
                {riskScore}
              </p>
              <p className="text-xs text-content-tertiary">Risk</p>
            </div>
          </div>
          <p className={`text-center text-xs font-semibold ${risk.color} mt-2`}>
            {risk.label}
          </p>
        </div>

        {/* Predictions List */}
        <div className="flex-1 space-y-3">
          {/* Churn Risk */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-semantic-error" />
              <span className="text-sm text-content-secondary">Churn Risk (90d)</span>
            </div>
            <span className={`text-sm font-semibold ${predictions.churnRisk >= 0.5 ? 'text-semantic-error' : 'text-semantic-success'}`}>
              {(predictions.churnRisk * 100).toFixed(0)}%
            </span>
          </div>

          {/* Close Probability */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-semantic-success" />
              <span className="text-sm text-content-secondary">Close Probability</span>
            </div>
            <span className={`text-sm font-semibold ${predictions.closeProbability >= 0.7 ? 'text-semantic-success' : 'text-semantic-warning'}`}>
              {(predictions.closeProbability * 100).toFixed(0)}%
            </span>
          </div>

          {/* Expected Close */}
          {predictions.expectedCloseDate && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-content-secondary">Expected Close</span>
              <span className="text-sm font-semibold text-content-primary">
                {new Date(predictions.expectedCloseDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
            </div>
          )}

          {/* Confidence */}
          <div className="flex items-center justify-between pt-2 border-t border-line-subtle">
            <span className="text-xs text-content-tertiary">Model Confidence</span>
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 bg-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-primary rounded-full transition-all"
                  style={{ width: `${(predictions.confidence * 100)}%` }}
                />
              </div>
              <span className="text-xs font-medium text-content-primary">
                {(predictions.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
