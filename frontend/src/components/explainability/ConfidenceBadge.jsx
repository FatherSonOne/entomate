import React from 'react';
import Tooltip from './Tooltip';

/**
 * ConfidenceBadge - Displays AI confidence level with color coding
 *
 * Props:
 * - confidence: Confidence score from 0-100
 */
export default function ConfidenceBadge({ confidence }) {
  if (confidence === undefined || confidence === null) {
    return null;
  }

  // Determine confidence level and styling
  let level = 'low';
  let label = 'Low Confidence';

  if (confidence >= 80) {
    level = 'high';
    label = 'Highly Confident';
  } else if (confidence >= 60) {
    level = 'medium';
    label = 'Moderately Confident';
  } else {
    level = 'low';
    label = 'Low Confidence - Review Carefully';
  }

  const tooltipText = level === 'high'
    ? 'High confidence: All factors align well and no close alternatives exist'
    : level === 'medium'
    ? 'Moderate confidence: Good overall fit, but some factors could be stronger or alternatives are close'
    : 'Low confidence: Review carefully - critical factors are weak or alternatives are very close';

  return (
    <Tooltip content={tooltipText} position="bottom">
      <div className={`confidence-badge ${level}`}>
        <span className="confidence-icon">
          {level === 'high' && '🟢'}
          {level === 'medium' && '🟡'}
          {level === 'low' && '🔴'}
        </span>
        <span className="confidence-text">
          {label}
        </span>
        <span className="confidence-score">
          {Math.round(confidence)}%
        </span>
      </div>
    </Tooltip>
  );
}
