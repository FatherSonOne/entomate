/**
 * Shared meeting display helpers
 */
import React from 'react'
import { SentimentPositive, SentimentNeutral, SentimentNegative } from '../components/icons/AnimatedIcons'

export function getSentimentIcon(sentiment, size = 20) {
  switch (sentiment) {
    case 'Positive': return <SentimentPositive size={size} />
    case 'Negative': return <SentimentNegative size={size} />
    default: return <SentimentNeutral size={size} />
  }
}

/** @deprecated Use getSentimentIcon instead */
export const getSentimentEmoji = getSentimentIcon

export function getSentimentBadgeColor(sentiment) {
  switch (sentiment) {
    case 'Positive': return 'mint'
    case 'Negative': return 'crimson'
    default: return 'neutral'
  }
}
