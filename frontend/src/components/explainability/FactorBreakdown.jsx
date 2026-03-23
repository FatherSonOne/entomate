import React from 'react';
import { TrendingUp, TrendingDown, Minus, CheckCircle, Info } from 'lucide-react';

/**
 * Factor Breakdown Component
 * Displays decision factors with scores, weights, and visual indicators
 */
export default function FactorBreakdown({ factors, showDetails = true, compact = false }) {
  const getImpactIcon = (impact) => {
    switch (impact) {
      case 'strong':
        return <TrendingUp size={16} className="text-semantic-success" />;
      case 'moderate':
        return <Minus size={16} className="vc-text-warning" />;
      case 'weak':
        return <TrendingDown size={16} className="text-semantic-warning" />;
      default:
        return <Minus size={16} className="text-content-tertiary" />;
    }
  };

  const getImpactColor = (impact) => {
    switch (impact) {
      case 'strong':
        return 'vc-border-success vc-bg-success-dim';
      case 'moderate':
        return 'vc-border-warning vc-bg-warning-dim';
      case 'weak':
        return 'vc-border-warning vc-bg-warning-dim';
      default:
        return 'border-line-strong bg-surface-muted';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-semantic-success';
    if (score >= 60) return 'vc-text-warning';
    if (score >= 40) return 'text-semantic-warning';
    return 'text-semantic-error';
  };

  const getScoreBarColor = (score) => {
    if (score >= 80) return 'vc-bg-success';
    if (score >= 60) return 'vc-bg-warning';
    if (score >= 40) return 'vc-bg-warning';
    return 'bg-semantic-error';
  };

  if (compact) {
    return (
      <div className="space-y-2">
        {factors.map((factor, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {getImpactIcon(factor.impact)}
                  <span className="text-sm font-medium text-content-secondary">{factor.name}</span>
                  {factor.learningApplied && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent-primary-dim vc-text-accent">
                      <CheckCircle size={10} />
                      Learned
                    </span>
                  )}
                </div>
                <span className={`text-sm font-semibold ${getScoreColor(factor.score)}`}>
                  {factor.score}
                </span>
              </div>
              <div className="w-full bg-surface-muted rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${getScoreBarColor(factor.score)}`}
                  style={{ width: `${factor.score}%` }}
                ></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {factors.map((factor, index) => (
        <div
          key={index}
          className={`rounded-lg border-l-4 p-4 ${getImpactColor(factor.impact)}`}
        >
          {/* Factor Header */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              {getImpactIcon(factor.impact)}
              <div>
                <h4 className="font-semibold text-content-primary">{factor.name}</h4>
                <p className="text-xs text-content-secondary">Weight: {Math.round(factor.weight * 100)}%</p>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${getScoreColor(factor.score)}`}>
                {factor.score}
              </div>
              <div className="text-xs text-content-secondary">/ 100</div>
            </div>
          </div>

          {/* Score Bar */}
          <div className="mb-3">
            <div className="w-full bg-surface-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getScoreBarColor(factor.score)}`}
                style={{ width: `${factor.score}%` }}
              ></div>
            </div>
          </div>

          {/* Natural Language */}
          {factor.naturalLanguage && (
            <div className="mb-2">
              <p className="text-sm text-content-secondary italic">"{factor.naturalLanguage}"</p>
            </div>
          )}

          {/* Details */}
          {showDetails && factor.details && factor.details.length > 0 && (
            <div className="mt-2 space-y-1">
              {factor.details.map((detail, detailIndex) => (
                <div key={detailIndex} className="flex items-start gap-2 text-sm text-content-secondary">
                  <Info size={14} className="mt-0.5 flex-shrink-0" />
                  <span>{detail}</span>
                </div>
              ))}
            </div>
          )}

          {/* Learning Applied Badge */}
          {factor.learningApplied && (
            <div className="mt-3 pt-3 border-t border-line-default">
              <div className="flex items-center gap-2 text-xs text-accent-primary">
                <CheckCircle size={14} />
                <span className="font-medium">Learning Applied:</span>
                <span>{factor.learningApplied.reason}</span>
                {factor.learningApplied.boost && (
                  <span className="font-semibold">({factor.learningApplied.boost > 0 ? '+' : ''}
                  {factor.learningApplied.boost}%)</span>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
