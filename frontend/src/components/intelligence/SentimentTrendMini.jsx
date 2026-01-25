import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

/**
 * SentimentTrendMini - Compact sparkline chart showing sentiment over time
 *
 * Displays:
 * - Mini bar chart of recent sentiment scores
 * - Trend indicator (improving, declining, stable)
 * - Current sentiment with color coding
 */
export default function SentimentTrendMini({ sentiment, className = '' }) {
  if (!sentiment || !sentiment.history || sentiment.history.length === 0) {
    return null
  }

  const getTrendIcon = () => {
    if (sentiment.trend === 'improving') return <TrendingUp className="w-3 h-3 text-semantic-success" />
    if (sentiment.trend === 'declining') return <TrendingDown className="w-3 h-3 text-semantic-error" />
    return <Minus className="w-3 h-3 text-content-tertiary" />
  }

  const getSentimentColor = (sentimentType) => {
    if (sentimentType === 'positive') return 'text-semantic-success'
    if (sentimentType === 'negative') return 'text-semantic-error'
    return 'text-content-tertiary'
  }

  const getBarColor = (sentimentType) => {
    if (sentimentType === 'positive') return 'bg-green-500'
    if (sentimentType === 'negative') return 'bg-semantic-error'
    return 'bg-gray-400'
  }

  // Take last 5 data points for mini chart
  const recentHistory = sentiment.history.slice(-5)
  const maxScore = Math.max(...recentHistory.map(h => h.score))

  return (
    <div className={`bg-semantic-info-dim border border-semantic-info rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-semantic-info">Sentiment Trend</span>
          {getTrendIcon()}
        </div>
        <span className={`text-sm font-semibold ${getSentimentColor(sentiment.current)}`}>
          {sentiment.current.charAt(0).toUpperCase() + sentiment.current.slice(1)}
        </span>
      </div>

      {/* Sparkline Chart */}
      <div className="flex items-end gap-1 h-12">
        {recentHistory.map((item, index) => {
          const heightPercentage = (item.score / maxScore) * 100
          return (
            <div key={index} className="flex-1 flex flex-col items-center justify-end">
              <div
                className={`w-full rounded-t ${getBarColor(item.sentiment)} transition-all duration-300`}
                style={{ height: `${heightPercentage}%` }}
                title={`${new Date(item.date).toLocaleDateString()}: ${item.score}%`}
              />
            </div>
          )
        })}
      </div>

      {/* Date Range */}
      {recentHistory.length >= 2 && (
        <div className="flex items-center justify-between mt-2 text-xs text-content-tertiary">
          <span>{new Date(recentHistory[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          <span>{new Date(recentHistory[recentHistory.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        </div>
      )}
    </div>
  )
}
