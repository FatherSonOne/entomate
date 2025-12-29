/**
 * PredictionBadge Component
 * Displays prediction scores with visual indicators
 */

import React, { useState } from 'react';
import type { DealProbabilityResult, TaskEtaResult } from '../analytics/types';
import {
  getProbabilityColor,
  getProbabilityBgColor,
  getConfidenceColor,
  formatPredictedDate
} from '../hooks/usePredictions';

interface PredictionTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
}

/**
 * Simple tooltip wrapper
 */
function PredictionTooltip({ children, content }: PredictionTooltipProps) {
  const [show, setShow] = useState(false);

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '8px',
            padding: '12px',
            backgroundColor: '#1f2937',
            color: '#f9fafb',
            borderRadius: '8px',
            fontSize: '13px',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            minWidth: '200px',
            maxWidth: '300px'
          }}
        >
          {content}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              borderWidth: '6px',
              borderStyle: 'solid',
              borderColor: '#1f2937 transparent transparent transparent'
            }}
          />
        </div>
      )}
    </div>
  );
}

interface DealProbabilityBadgeProps {
  prediction: DealProbabilityResult | null;
  loading?: boolean;
  compact?: boolean;
}

/**
 * Badge showing deal close probability
 */
export function DealProbabilityBadge({ prediction, loading, compact }: DealProbabilityBadgeProps) {
  if (loading) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: compact ? '2px 6px' : '4px 10px',
          backgroundColor: '#f3f4f6',
          borderRadius: '12px',
          fontSize: compact ? '11px' : '13px'
        }}
      >
        <span style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          border: '2px solid #d1d5db',
          borderTopColor: '#9ca3af',
          animation: 'spin 1s linear infinite',
          marginRight: '6px'
        }} />
        ...
      </span>
    );
  }

  if (!prediction) {
    return null;
  }

  const { probability, riskFlags, explanation } = prediction;
  const color = getProbabilityColor(probability);
  const bgColor = getProbabilityBgColor(probability);

  const badge = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: compact ? '2px 8px' : '4px 12px',
        backgroundColor: bgColor,
        color: color,
        borderRadius: '12px',
        fontSize: compact ? '11px' : '13px',
        fontWeight: 600,
        cursor: 'help'
      }}
    >
      <span style={{ fontSize: compact ? '10px' : '12px' }}>🎯</span>
      {probability}%
    </span>
  );

  const tooltipContent = (
    <div style={{ whiteSpace: 'normal' }}>
      <div style={{ fontWeight: 600, marginBottom: '8px' }}>
        Deal Win Probability: {probability}%
      </div>
      <div style={{ fontSize: '12px', color: '#d1d5db', marginBottom: '8px' }}>
        {explanation}
      </div>
      {riskFlags.length > 0 && (
        <div style={{ fontSize: '12px' }}>
          <span style={{ color: '#fbbf24' }}>⚠️ Risk Factors:</span>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            {riskFlags.map((flag, i) => (
              <li key={i} style={{ color: '#fbbf24' }}>
                {formatRiskFlag(flag)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '8px' }}>
        Model: {prediction.modelVersion}
      </div>
    </div>
  );

  return (
    <PredictionTooltip content={tooltipContent}>
      {badge}
    </PredictionTooltip>
  );
}

interface TaskEtaBadgeProps {
  prediction: TaskEtaResult | null;
  loading?: boolean;
  compact?: boolean;
}

/**
 * Badge showing task ETA prediction
 */
export function TaskEtaBadge({ prediction, loading, compact }: TaskEtaBadgeProps) {
  if (loading) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: compact ? '2px 6px' : '4px 10px',
          backgroundColor: '#f3f4f6',
          borderRadius: '12px',
          fontSize: compact ? '11px' : '13px'
        }}
      >
        <span style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          border: '2px solid #d1d5db',
          borderTopColor: '#9ca3af',
          animation: 'spin 1s linear infinite',
          marginRight: '6px'
        }} />
        ...
      </span>
    );
  }

  if (!prediction) {
    return null;
  }

  const { predictedCompletionDate, confidence, explanation } = prediction;
  const formattedDate = formatPredictedDate(predictedCompletionDate);
  const confidenceColor = getConfidenceColor(confidence);

  const badge = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: compact ? '2px 8px' : '4px 12px',
        backgroundColor: '#eff6ff',
        color: '#3b82f6',
        borderRadius: '12px',
        fontSize: compact ? '11px' : '13px',
        fontWeight: 500,
        cursor: 'help'
      }}
    >
      <span style={{ fontSize: compact ? '10px' : '12px' }}>📅</span>
      {formattedDate}
    </span>
  );

  const tooltipContent = (
    <div style={{ whiteSpace: 'normal' }}>
      <div style={{ fontWeight: 600, marginBottom: '8px' }}>
        Predicted Completion: {new Date(predictedCompletionDate).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        })}
      </div>
      <div style={{ fontSize: '12px', color: '#d1d5db', marginBottom: '8px' }}>
        {explanation}
      </div>
      <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>Confidence:</span>
        <span
          style={{
            padding: '2px 8px',
            backgroundColor: confidenceColor + '20',
            color: confidenceColor,
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'capitalize'
          }}
        >
          {confidence}
        </span>
      </div>
      <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '8px' }}>
        Model: {prediction.modelVersion}
      </div>
    </div>
  );

  return (
    <PredictionTooltip content={tooltipContent}>
      {badge}
    </PredictionTooltip>
  );
}

/**
 * Format risk flag for display
 */
function formatRiskFlag(flag: string): string {
  const flagMap: Record<string, string> = {
    overdue_high_tasks: 'High priority tasks overdue',
    overdue_medium_tasks: 'Medium priority tasks overdue',
    no_recent_meeting: 'No recent meetings',
    stale_deal: 'Deal inactive for extended period',
    negative_sentiment: 'Negative meeting sentiment'
  };
  return flagMap[flag] || flag.replace(/_/g, ' ');
}

/**
 * Inline styles for spinner animation
 */
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
if (typeof document !== 'undefined' && !document.querySelector('#prediction-spinner-style')) {
  spinnerStyle.id = 'prediction-spinner-style';
  document.head.appendChild(spinnerStyle);
}

export default { DealProbabilityBadge, TaskEtaBadge };
