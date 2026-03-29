import React from 'react'
import { Users, Star, TrendingUp, TrendingDown, Minus, AlertTriangle, Calendar } from 'lucide-react'
import ExpandableCard from './ExpandableCard'
import StakeholderCard from './StakeholderCard'

/**
 * RelationshipInsightCard - Stakeholder relationship intelligence
 *
 * Displays:
 * - New champions detected
 * - Stakeholder role badges
 * - Influence score (star rating)
 * - Coverage gaps with recommendations
 */
export default function RelationshipInsightCard({ data, onAction }) {
  if (!data) return null

  const { stakeholders, coverage, insights } = data

  // Role badge colors
  const getRoleBadge = (role) => {
    const badges = {
      champion: { label: 'Champion', color: 'bg-semantic-success-dim text-semantic-success border-semantic-success' },
      influencer: { label: 'Influencer', color: 'bg-semantic-info-dim text-semantic-info border-semantic-info' },
      economic_buyer: { label: 'Economic Buyer', color: 'bg-accent-tertiary-dim text-accent-tertiary border-accent-tertiary' },
      blocker: { label: 'Blocker', color: 'bg-semantic-error-dim text-semantic-error border-semantic-error' },
      unknown: { label: 'Unknown', color: 'bg-surface-muted text-content-primary border-line-default' }
    }
    return badges[role] || badges.unknown
  }

  // Render star rating
  const renderStars = (score) => {
    const stars = Math.round((score / 100) * 5)
    return (
      <div className="flex items-center gap-0.5">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`w-3 h-3 ${
              i < stars ? 'vc-fill-warning' : 'vc-text-dim'
            }`}
          />
        ))}
      </div>
    )
  }

  // Trend icon
  const getTrendIcon = (trend) => {
    if (trend === 'growing') return <TrendingUp className="w-3 h-3 text-semantic-success" />
    if (trend === 'declining') return <TrendingDown className="w-3 h-3 text-semantic-error" />
    return <Minus className="w-3 h-3 text-content-secondary" />
  }

  // New champions from insights
  const newChampions = insights?.newChampions || []
  const atRiskChampions = insights?.atRiskChampions || []

  // Compact content
  const compactContent = (
    <div className="space-y-4">
      {/* New champions */}
      {newChampions.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-content-secondary mb-2 flex items-center gap-1">
            <Star className="w-4 h-4 vc-text-warning" />
            New Champion Identified
          </h5>
          {newChampions.slice(0, 2).map((champion, index) => {
            const stakeholder = stakeholders?.find(s => s.name === champion.stakeholder)
            if (!stakeholder) return null

            return (
              <div key={index} className="bg-semantic-success-dim border border-semantic-success rounded-lg p-3">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <p className="font-semibold text-content-primary">{stakeholder.name}</p>
                    <p className="text-sm text-content-secondary">{stakeholder.title}</p>
                    {stakeholder.company && (
                      <p className="text-xs text-content-tertiary">{stakeholder.company}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-content-secondary mb-1">Influence</p>
                    {renderStars(stakeholder.influenceScore)}
                  </div>
                </div>

                <div className="space-y-1.5 mb-3">
                  <p className="text-xs font-semibold text-semantic-success">Signals:</p>
                  {champion.signals.slice(0, 3).map((signal, idx) => (
                    <p key={idx} className="text-xs text-semantic-success flex items-start gap-1">
                      <span className="text-semantic-success mt-0.5">•</span>
                      <span className="flex-1">{signal}</span>
                    </p>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onAction('addToCRM', stakeholder.id)}
                    className="px-2 py-1 text-xs font-medium bg-semantic-success text-white rounded hover:opacity-90 transition-colors"
                  >
                    Add to CRM
                  </button>
                  <button
                    onClick={() => onAction('scheduleMeeting', stakeholder.id)}
                    className="px-2 py-1 text-xs font-medium bg-surface border border-semantic-success text-semantic-success rounded hover:bg-semantic-success-dim transition-colors"
                  >
                    Schedule Meeting
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* At-risk champions */}
      {atRiskChampions.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-content-secondary mb-2 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4 text-semantic-error" />
            Champion Health Alert
          </h5>
          {atRiskChampions.slice(0, 2).map((alert, index) => {
            const stakeholder = stakeholders?.find(s => s.name === alert.stakeholder)
            if (!stakeholder) return null

            return (
              <div key={index} className="bg-semantic-error-dim border border-semantic-error rounded-lg p-3">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <p className="font-semibold text-content-primary">{stakeholder.name}</p>
                    <p className="text-sm text-content-secondary">{stakeholder.title}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-semantic-error font-semibold">
                      Health: {alert.healthScore}/100
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 mb-2">
                  <p className="text-xs font-semibold text-semantic-error">Red Flags:</p>
                  {alert.redFlags.slice(0, 2).map((flag, idx) => (
                    <p key={idx} className="text-xs text-semantic-error flex items-start gap-1">
                      <span className="text-semantic-error mt-0.5">⚠</span>
                      <span className="flex-1">{flag}</span>
                    </p>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Coverage gaps */}
      {coverage && coverage.gaps && coverage.gaps.length > 0 && (
        <div className="bg-semantic-warning-dim border border-semantic-warning rounded-lg p-3">
          <h5 className="text-xs font-semibold text-semantic-warning mb-2 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" />
            Coverage Gaps Detected
          </h5>
          {coverage.gaps.slice(0, 2).map((gap, index) => (
            <div key={index} className="mb-3 last:mb-0">
              <div className="flex items-start gap-2">
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                  gap.importance === 'critical' ? 'bg-semantic-error-dim text-semantic-error' :
                  gap.importance === 'high' ? 'bg-semantic-warning-dim text-semantic-warning' :
                  'bg-surface-muted text-content-primary'
                }`}>
                  {gap.importance}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-semantic-warning">
                    Missing: {gap.missingPersona}
                  </p>
                  <p className="text-xs text-semantic-warning mt-1">
                    Risk: {gap.risk}
                  </p>
                  <p className="text-xs text-semantic-warning mt-1">
                    💡 {gap.recommendation}
                  </p>
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={() => onAction('getIntroduction', coverage.gaps[0])}
            className="w-full mt-3 px-3 py-1.5 text-xs font-medium bg-surface border border-semantic-warning text-semantic-warning rounded hover:bg-semantic-warning-dim transition-colors"
          >
            Get Introduction
          </button>
        </div>
      )}

      {/* Coverage score */}
      {coverage && (
        <div className="bg-surface-muted border border-line-default rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-content-secondary">Stakeholder Coverage</span>
            <span className="text-sm font-bold text-content-primary">
              {coverage.coverageScore}/100
            </span>
          </div>
          <div className="w-full h-2 bg-surface-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                coverage.coverageScore >= 75 ? 'vc-bg-success' :
                coverage.coverageScore >= 50 ? 'vc-bg-warning' : 'vc-bg-error'
              }`}
              style={{ width: `${coverage.coverageScore}%` }}
            />
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-content-secondary">
            <span className="flex items-center gap-1">
              {coverage.hasChampion ? '✓' : '✗'} Champion
            </span>
            <span className="flex items-center gap-1">
              {coverage.hasEconomicBuyer ? '✓' : '✗'} Economic Buyer
            </span>
            <span className="flex items-center gap-1">
              {coverage.multiThreaded ? '✓' : '✗'} Multi-threaded
            </span>
          </div>
        </div>
      )}
    </div>
  )

  // Expanded content
  const expandedContent = (
    <div className="space-y-4">
      {/* All Stakeholders - Enhanced visualization */}
      {stakeholders && stakeholders.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-content-secondary mb-3">
            All Stakeholders ({stakeholders.length})
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
            {stakeholders.map((stakeholder, index) => (
              <StakeholderCard
                key={index}
                stakeholder={stakeholder}
                onAction={(action, id) => onAction(action, id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* All recommendations */}
      {insights && insights.recommendations && insights.recommendations.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-content-secondary mb-2">Recommendations</h5>
          <ul className="space-y-1.5">
            {insights.recommendations.map((rec, index) => (
              <li key={index} className="text-sm text-content-secondary flex items-start gap-2">
                <span className="text-accent-primary mt-1">•</span>
                <span className="flex-1">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )

  return (
    <ExpandableCard
      title="Relationship Insights"
      compactContent={compactContent}
      expandedContent={expandedContent}
      className="mb-3"
    />
  )
}
