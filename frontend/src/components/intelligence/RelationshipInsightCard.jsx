import React from 'react'
import { Users, Star, TrendingUp, TrendingDown, Minus, AlertTriangle, Calendar } from 'lucide-react'
import ExpandableCard from './ExpandableCard'

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
      champion: { label: 'Champion', color: 'bg-green-100 text-green-800 border-green-200' },
      influencer: { label: 'Influencer', color: 'bg-blue-100 text-blue-800 border-blue-200' },
      economic_buyer: { label: 'Economic Buyer', color: 'bg-purple-100 text-purple-800 border-purple-200' },
      blocker: { label: 'Blocker', color: 'bg-red-100 text-red-800 border-red-200' },
      unknown: { label: 'Unknown', color: 'bg-gray-100 text-gray-800 border-gray-200' }
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
              i < stars ? 'text-amber-400 fill-amber-400' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    )
  }

  // Trend icon
  const getTrendIcon = (trend) => {
    if (trend === 'growing') return <TrendingUp className="w-3 h-3 text-green-600" />
    if (trend === 'declining') return <TrendingDown className="w-3 h-3 text-red-600" />
    return <Minus className="w-3 h-3 text-gray-600" />
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
          <h5 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
            <Star className="w-4 h-4 text-amber-500" />
            New Champion Identified
          </h5>
          {newChampions.slice(0, 2).map((champion, index) => {
            const stakeholder = stakeholders?.find(s => s.name === champion.stakeholder)
            if (!stakeholder) return null

            return (
              <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{stakeholder.name}</p>
                    <p className="text-sm text-gray-600">{stakeholder.title}</p>
                    {stakeholder.company && (
                      <p className="text-xs text-gray-500">{stakeholder.company}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-600 mb-1">Influence</p>
                    {renderStars(stakeholder.influenceScore)}
                  </div>
                </div>

                <div className="space-y-1.5 mb-3">
                  <p className="text-xs font-semibold text-green-900">Signals:</p>
                  {champion.signals.slice(0, 3).map((signal, idx) => (
                    <p key={idx} className="text-xs text-green-800 flex items-start gap-1">
                      <span className="text-green-600 mt-0.5">•</span>
                      <span className="flex-1">{signal}</span>
                    </p>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onAction('addToCRM', stakeholder.id)}
                    className="px-2 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    Add to CRM
                  </button>
                  <button
                    onClick={() => onAction('scheduleMeeting', stakeholder.id)}
                    className="px-2 py-1 text-xs font-medium bg-white border border-green-300 text-green-700 rounded hover:bg-green-50 transition-colors"
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
          <h5 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Champion Health Alert
          </h5>
          {atRiskChampions.slice(0, 2).map((alert, index) => {
            const stakeholder = stakeholders?.find(s => s.name === alert.stakeholder)
            if (!stakeholder) return null

            return (
              <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{stakeholder.name}</p>
                    <p className="text-sm text-gray-600">{stakeholder.title}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-red-600 font-semibold">
                      Health: {alert.healthScore}/100
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 mb-2">
                  <p className="text-xs font-semibold text-red-900">Red Flags:</p>
                  {alert.redFlags.slice(0, 2).map((flag, idx) => (
                    <p key={idx} className="text-xs text-red-800 flex items-start gap-1">
                      <span className="text-red-600 mt-0.5">⚠</span>
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
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <h5 className="text-xs font-semibold text-amber-900 mb-2 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" />
            Coverage Gaps Detected
          </h5>
          {coverage.gaps.slice(0, 2).map((gap, index) => (
            <div key={index} className="mb-3 last:mb-0">
              <div className="flex items-start gap-2">
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                  gap.importance === 'critical' ? 'bg-red-100 text-red-800' :
                  gap.importance === 'high' ? 'bg-amber-100 text-amber-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {gap.importance}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900">
                    Missing: {gap.missingPersona}
                  </p>
                  <p className="text-xs text-amber-800 mt-1">
                    Risk: {gap.risk}
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    💡 {gap.recommendation}
                  </p>
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={() => onAction('getIntroduction', coverage.gaps[0])}
            className="w-full mt-3 px-3 py-1.5 text-xs font-medium bg-white border border-amber-300 text-amber-700 rounded hover:bg-amber-50 transition-colors"
          >
            Get Introduction
          </button>
        </div>
      )}

      {/* Coverage score */}
      {coverage && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700">Stakeholder Coverage</span>
            <span className="text-sm font-bold text-gray-900">
              {coverage.coverageScore}/100
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                coverage.coverageScore >= 75 ? 'bg-green-500' :
                coverage.coverageScore >= 50 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${coverage.coverageScore}%` }}
            />
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
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
      {/* All stakeholders */}
      {stakeholders && stakeholders.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-700 mb-3">
            All Stakeholders ({stakeholders.length})
          </h5>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {stakeholders.map((stakeholder, index) => {
              const roleBadge = getRoleBadge(stakeholder.role)

              return (
                <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{stakeholder.name}</p>
                      <p className="text-sm text-gray-600">{stakeholder.title}</p>
                      {stakeholder.company && (
                        <p className="text-xs text-gray-500">{stakeholder.company}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${roleBadge.color} mb-1`}>
                        {roleBadge.label}
                      </span>
                      {renderStars(stakeholder.influenceScore)}
                    </div>
                  </div>

                  {/* Engagement metrics */}
                  {stakeholder.engagement && (
                    <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Calendar className="w-3 h-3" />
                        <span>{stakeholder.engagement.meetingCount} meetings</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-600">
                        <span>Last: {stakeholder.engagement.daysSinceLastContact}d ago</span>
                      </div>
                    </div>
                  )}

                  {/* Relationship strength */}
                  {stakeholder.relationshipStrength && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-600">Relationship:</span>
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            stakeholder.relationshipStrength.score >= 75 ? 'bg-green-500' :
                            stakeholder.relationshipStrength.score >= 50 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${stakeholder.relationshipStrength.score}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-700">
                        {stakeholder.relationshipStrength.score}/100
                      </span>
                      {getTrendIcon(stakeholder.relationshipStrength.trend)}
                    </div>
                  )}

                  {/* Sentiment */}
                  {stakeholder.sentiment && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">Sentiment:</span>
                      <span className={`font-medium ${
                        stakeholder.sentiment.current === 'positive' ? 'text-green-600' :
                        stakeholder.sentiment.current === 'negative' ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {stakeholder.sentiment.current.charAt(0).toUpperCase() + stakeholder.sentiment.current.slice(1)}
                        ({stakeholder.sentiment.score})
                        {stakeholder.sentiment.trend !== 'stable' && ` • ${stakeholder.sentiment.trend}`}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* All recommendations */}
      {insights && insights.recommendations && insights.recommendations.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-700 mb-2">Recommendations</h5>
          <ul className="space-y-1.5">
            {insights.recommendations.map((rec, index) => (
              <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-primary-600 mt-1">•</span>
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
