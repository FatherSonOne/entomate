import React from 'react';

/**
 * ProgressBar - Visual representation of a score
 *
 * Props:
 * - value: Current value (score)
 * - max: Maximum value (default 100)
 * - showLabel: Boolean to show percentage label
 */
export default function ProgressBar({ value, max = 100, showLabel = false }) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  // Determine color based on percentage
  let colorClass = 'low';
  if (percentage >= 80) {
    colorClass = 'high';
  } else if (percentage >= 60) {
    colorClass = 'medium';
  }

  return (
    <div className="progress-bar-container">
      <div className="progress-bar">
        <div
          className={`progress-bar-fill ${colorClass}`}
          style={{ width: `${percentage}%` }}
        >
          {showLabel && <span className="progress-label">{Math.round(percentage)}%</span>}
        </div>
      </div>
    </div>
  );
}
