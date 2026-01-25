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
        return <TrendingUp size={16} className="text-green-600" />;
      case 'moderate':
        return <Minus size={16} className="text-yellow-600" />;
      case 'weak':
        return <TrendingDown size={16} className="text-orange-600" />;
      default:
        return <Minus size={16} className="text-gray-400" />;
    }
  };

  const getImpactColor = (impact) => {
    switch (impact) {
      case 'strong':
        return 'border-green-500 bg-green-50';
      case 'moderate':
        return 'border-yellow-500 bg-yellow-50';
      case 'weak':
        return 'border-orange-500 bg-orange-50';
      default:
        return 'border-gray-300 bg-gray-50';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBarColor = (score) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
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
                  <span className="text-sm font-medium text-gray-700">{factor.name}</span>
                  {factor.learningApplied && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                      <CheckCircle size={10} />
                      Learned
                    </span>
                  )}
                </div>
                <span className={`text-sm font-semibold ${getScoreColor(factor.score)}`}>
                  {factor.score}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
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
                <h4 className="font-semibold text-gray-900">{factor.name}</h4>
                <p className="text-xs text-gray-600">Weight: {Math.round(factor.weight * 100)}%</p>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${getScoreColor(factor.score)}`}>
                {factor.score}
              </div>
              <div className="text-xs text-gray-600">/ 100</div>
            </div>
          </div>

          {/* Score Bar */}
          <div className="mb-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getScoreBarColor(factor.score)}`}
                style={{ width: `${factor.score}%` }}
              ></div>
            </div>
          </div>

          {/* Natural Language */}
          {factor.naturalLanguage && (
            <div className="mb-2">
              <p className="text-sm text-gray-700 italic">"{factor.naturalLanguage}"</p>
            </div>
          )}

          {/* Details */}
          {showDetails && factor.details && factor.details.length > 0 && (
            <div className="mt-2 space-y-1">
              {factor.details.map((detail, detailIndex) => (
                <div key={detailIndex} className="flex items-start gap-2 text-sm text-gray-600">
                  <Info size={14} className="mt-0.5 flex-shrink-0" />
                  <span>{detail}</span>
                </div>
              ))}
            </div>
          )}

          {/* Learning Applied Badge */}
          {factor.learningApplied && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2 text-xs text-indigo-700">
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
