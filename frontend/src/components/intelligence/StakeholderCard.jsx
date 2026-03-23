import React from 'react'
import { User, Star, TrendingUp, TrendingDown, Minus, Calendar, Mail } from 'lucide-react'

/**
 * StakeholderCard - Individual stakeholder display with role, influence, relationship metrics
 *
 * Displays:
 * - Name, title, company
 * - Role badge (Champion, Economic Buyer, Influencer, Blocker)
 * - Influence score (star rating)
 * - Relationship strength meter
 * - Engagement metrics (last contact, meeting count)
 * - Sentiment indicator
 */
export default function StakeholderCard({ stakeholder, onAction, className = '' }) {
  if (!stakeholder) return null

  // Role badge styling
  const getRoleBadge = (role) => {
    const badges = {
      champion: { label: 'Champion', color: 'bg-semantic-success-dim text-semantic-success border-semantic-success', icon: '⭐' },
      influencer: { label: 'Influencer', color: 'bg-semantic-info-dim text-semantic-info border-semantic-info', icon: '💼' },
      economic_buyer: { label: 'Economic Buyer', color: 'bg-accent-tertiary-dim text-accent-tertiary border-accent-tertiary', icon: '💰' },
      blocker: { label: 'Blocker', color: 'bg-semantic-error-dim text-semantic-error border-semantic-error', icon: '⚠️' },
      unknown: { label: 'Unknown', color: 'bg-surface-muted text-content-tertiary border-line-default', icon: '❓' }
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
    return <Minus className="w-3 h-3 text-content-tertiary" />
  }

  const roleBadge = getRoleBadge(stakeholder.role)

  return (
    <div className={`bg-surface border border-line-default rounded-lg p-4 hover:border-accent-primary transition-colors ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-primary to-accent-tertiary flex items-center justify-center text-white font-semibold flex-shrink-0">
            {(stakeholder.name || stakeholder.email || '?')[0].toUpperCase()}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-content-primary truncate">
              {stakeholder.name}
            </p>
            {stakeholder.title && (
              <p className="text-sm text-content-secondary truncate">
                {stakeholder.title}
              </p>
            )}
            {stakeholder.company && (
              <p className="text-xs text-content-tertiary truncate">
                {stakeholder.company}
              </p>
            )}
          </div>
        </div>

        {/* Role Badge */}
        <span className={`px-2 py-1 text-xs font-medium rounded border flex items-center gap-1 ${roleBadge.color} flex-shrink-0`}>
          <span>{roleBadge.icon}</span>
          <span>{roleBadge.label}</span>
        </span>
      </div>

      {/* Influence Score */}
      {stakeholder.influenceScore !== undefined && (
        <div className="mb-3 pb-3 border-b border-line-subtle">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-content-tertiary">Influence</span>
            <span className="text-xs font-medium text-content-primary">
              {stakeholder.influenceScore}/100
            </span>
          </div>
          {renderStars(stakeholder.influenceScore)}
        </div>
      )}

      {/* Relationship Strength */}
      {stakeholder.relationshipStrength && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-content-tertiary">Relationship Strength</span>
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-content-primary">
                {stakeholder.relationshipStrength.score}/100
              </span>
              {getTrendIcon(stakeholder.relationshipStrength.trend)}
            </div>
          </div>
          <div className="w-full h-1.5 bg-surface-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                stakeholder.relationshipStrength.score >= 75 ? 'vc-bg-success' :
                stakeholder.relationshipStrength.score >= 50 ? 'vc-bg-warning' : 'vc-bg-error'
              }`}
              style={{ width: `${stakeholder.relationshipStrength.score}%` }}
            />
          </div>
        </div>
      )}

      {/* Engagement Metrics */}
      {stakeholder.engagement && (
        <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
          <div className="flex items-center gap-1 text-content-secondary">
            <Calendar className="w-3 h-3" />
            <span>{stakeholder.engagement.meetingCount} meetings</span>
          </div>
          <div className="flex items-center gap-1 text-content-secondary">
            <span>Last: {stakeholder.engagement.daysSinceLastContact}d ago</span>
          </div>
        </div>
      )}

      {/* Sentiment */}
      {stakeholder.sentiment && (
        <div className="flex items-center justify-between text-xs mb-3 pb-3 border-b border-line-subtle">
          <span className="text-content-tertiary">Sentiment</span>
          <span className={`font-medium ${
            stakeholder.sentiment.current === 'positive' ? 'text-semantic-success' :
            stakeholder.sentiment.current === 'negative' ? 'text-semantic-error' : 'text-content-secondary'
          }`}>
            {stakeholder.sentiment.current.charAt(0).toUpperCase() + stakeholder.sentiment.current.slice(1)}
            {stakeholder.sentiment.trend !== 'stable' && ` (${stakeholder.sentiment.trend})`}
          </span>
        </div>
      )}

      {/* Actions */}
      {onAction && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAction('email', stakeholder.id)}
            className="btn btn-xs btn-ghost flex-1"
          >
            <Mail className="w-3 h-3" />
            Email
          </button>
          <button
            onClick={() => onAction('schedule', stakeholder.id)}
            className="btn btn-xs btn-ghost flex-1"
          >
            <Calendar className="w-3 h-3" />
            Meeting
          </button>
        </div>
      )}
    </div>
  )
}
