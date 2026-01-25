import React from 'react';
import FactorDetail from './FactorDetail';

/**
 * FactorList - Displays a list of decision factors
 *
 * Props:
 * - factors: Array of factor objects
 * - compact: Boolean for compact view
 * - showWeights: Boolean to show factor weights
 * - showProgressBars: Boolean to show progress bars
 */
export default function FactorList({
  factors,
  compact = false,
  showWeights = false,
  showProgressBars = false
}) {
  if (!factors || factors.length === 0) {
    return null;
  }

  return (
    <div className={`factor-list ${compact ? 'compact' : 'detailed'}`}>
      {factors.map((factor, index) => (
        <FactorDetail
          key={index}
          factor={factor}
          rank={index + 1}
          compact={compact}
          showWeight={showWeights}
          showProgressBar={showProgressBars}
        />
      ))}
    </div>
  );
}
