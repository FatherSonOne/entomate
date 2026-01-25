import React from 'react';

/**
 * AlternativesList - Displays alternative recommendations that were considered
 *
 * Props:
 * - alternatives: Array of alternative option objects
 * - onSelect: Callback function when an alternative is selected
 */
export default function AlternativesList({ alternatives, onSelect }) {
  if (!alternatives || alternatives.length === 0) {
    return (
      <div className="alternatives-list">
        <p className="no-alternatives">No alternative options available</p>
      </div>
    );
  }

  return (
    <div className="alternatives-list">
      {alternatives.map((alt, index) => (
        <div key={index} className="alternative-item">
          <div className="alternative-header">
            <span className="alternative-rank">{index + 2}.</span>
            <span className="alternative-name">
              {alt.option?.label || alt.option?.name || `Option ${index + 2}`}
            </span>
            <span className="alternative-score">{alt.score}/100</span>
          </div>

          <div className="alternative-reason">
            <strong>Why lower:</strong> {alt.whyLower}
          </div>

          {onSelect && (
            <button
              onClick={() => onSelect(alt.option)}
              className="btn-select-alternative"
            >
              Select {alt.option?.label || alt.option?.name || 'This Option'} Instead
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
