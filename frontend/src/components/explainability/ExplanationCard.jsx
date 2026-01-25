import React, { useState } from 'react';
import FactorList from './FactorList';
import AlternativesList from './AlternativesList';
import ConfidenceBadge from './ConfidenceBadge';
import api from '../../services/api';

/**
 * ExplanationCard - Displays AI agent decision explanations
 *
 * Features:
 * - Adaptive UI (concise by default, expandable for details)
 * - Shows top factors, confidence, and alternatives
 * - Allows users to accept or change recommendations
 */
export default function ExplanationCard({
  recommendation,
  explanation,
  onAccept,
  onChangeRecommendation,
  executionId, // Add executionId prop for analytics
  className = ''
}) {
  const [expanded, setExpanded] = useState(false);

  // Track analytics event
  const trackEvent = async (eventType, metadata = {}) => {
    if (!executionId) return;

    try {
      await api.post('/agents/analytics/track', {
        eventType,
        executionId,
        metadata
      });
    } catch (error) {
      // Silently fail - analytics shouldn't break UX
      console.log('Analytics tracking failed:', error);
    }
  };

  // Handle expansion with analytics
  const handleToggleExpand = () => {
    setExpanded(!expanded);

    // Track expansion event
    if (!expanded) {
      trackEvent('expansion');
    }
  };

  // Handle acceptance with analytics
  const handleAccept = () => {
    trackEvent('acceptance', {
      recommendationId: recommendation?.id || recommendation?.name
    });

    if (onAccept) {
      onAccept();
    }
  };

  // Handle alternative selection with analytics
  const handleAlternativeSelect = (alternative) => {
    trackEvent('alternative_selected', {
      alternativeId: alternative?.id || alternative?.name
    });

    trackEvent('override', {
      originalId: recommendation?.id || recommendation?.name,
      selectedId: alternative?.id || alternative?.name
    });

    if (onChangeRecommendation) {
      onChangeRecommendation(alternative);
    }
  };

  // If no explanation provided, show basic recommendation
  if (!explanation) {
    return (
      <div className={`explanation-card ${className}`}>
        <div className="recommendation-header">
          <div className="recommendation-title">
            ✅ Recommended: {recommendation?.label || recommendation?.name || 'N/A'}
          </div>
        </div>
        <div className="explanation-actions">
          {onAccept && (
            <button onClick={handleAccept} className="btn-primary">
              ✓ Accept
            </button>
          )}
          {onChangeRecommendation && (
            <button onClick={() => handleAlternativeSelect(null)} className="btn-secondary">
              ↻ Change
            </button>
          )}
        </div>
      </div>
    );
  }

  const { factors, alternatives, confidence } = explanation;

  // Top 3 factors for concise view
  const topFactors = factors?.slice(0, 3) || [];

  return (
    <div className={`explanation-card ${expanded ? 'expanded' : ''} ${className}`}>
      {/* Header with Recommendation and Confidence */}
      <div className="recommendation-header">
        <div className="recommendation-title">
          ✅ Recommended: {recommendation?.label || recommendation?.name || 'N/A'}
        </div>
        <ConfidenceBadge confidence={confidence} />
      </div>

      {/* Concise View (Always Visible) */}
      {topFactors.length > 0 && (
        <div className="factors-concise">
          <h4>Top Factors:</h4>
          <FactorList
            factors={topFactors}
            compact={true}
            showWeights={false}
          />
        </div>
      )}

      {/* Expanded View (On Demand) */}
      {expanded && (
        <div className="explanation-expanded">
          {/* All Decision Factors */}
          {factors && factors.length > 0 && (
            <div className="factors-detailed">
              <h4>All Decision Factors (Weighted):</h4>
              <FactorList
                factors={factors}
                compact={false}
                showWeights={true}
                showProgressBars={true}
              />
            </div>
          )}

          {/* Divider */}
          {alternatives && alternatives.length > 0 && (
            <div className="divider" />
          )}

          {/* Alternatives Considered */}
          {alternatives && alternatives.length > 0 && (
            <div className="alternatives">
              <h4>Alternatives Considered:</h4>
              <AlternativesList
                alternatives={alternatives}
                onSelect={handleAlternativeSelect}
              />
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="explanation-actions">
        {onAccept && (
          <button
            onClick={handleAccept}
            className="btn-primary"
          >
            ✓ Accept {recommendation?.label || recommendation?.name || 'Recommendation'}
          </button>
        )}

        {onChangeRecommendation && (
          <button
            onClick={() => handleAlternativeSelect(null)}
            className="btn-secondary"
          >
            ↻ Pick Different
          </button>
        )}

        {factors && factors.length > 3 && (
          <button
            onClick={handleToggleExpand}
            className="btn-expand"
          >
            {expanded ? '▲ Hide Details' : '▼ Show More Details'}
          </button>
        )}
      </div>
    </div>
  );
}
