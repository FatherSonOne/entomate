/**
 * Shared meeting display helpers
 */

export function getSentimentEmoji(sentiment) {
  switch (sentiment) {
    case 'Positive': return '😊'
    case 'Negative': return '😟'
    default: return '😐'
  }
}

export function getSentimentBadgeColor(sentiment) {
  switch (sentiment) {
    case 'Positive': return 'mint'
    case 'Negative': return 'crimson'
    default: return 'neutral'
  }
}
