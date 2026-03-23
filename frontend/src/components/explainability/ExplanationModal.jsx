import React from 'react';
import { X, Brain, TrendingUp, Award, HelpCircle } from 'lucide-react';
import FactorBreakdown from './FactorBreakdown';

/**
 * Explanation Modal Component
 * Full-screen detailed explanation of AI decision
 */
export default function ExplanationModal({ explanation, onClose, agentType }) {
  if (!explanation) return null;

  const { recommendation, confidence, factors, alternatives, metadata } = explanation;

  const getConfidenceColor = (conf) => {
    if (conf >= 80) return 'text-semantic-success bg-semantic-success-dim';
    if (conf >= 60) return 'vc-text-warning vc-bg-warning-dim';
    return 'text-semantic-warning bg-semantic-warning-dim';
  };

  const getConfidenceLabel = (conf) => {
    if (conf >= 80) return 'High Confidence';
    if (conf >= 60) return 'Medium Confidence';
    return 'Low Confidence';
  };

  const getAgentDisplayName = (type) => {
    const names = {
      assignment: 'Assignment Agent',
      priority: 'Priority Agent',
      deadline: 'Deadline Agent',
      followup: 'Follow-up Agent'
    };
    return names[type] || 'AI Agent';
  };

  const getAgentIcon = (type) => {
    const icons = {
      assignment: '👥',
      priority: '🎯',
      deadline: '📅',
      followup: '🔔'
    };
    return icons[type] || '🤖';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 px-6 py-4 flex items-center justify-between" style={{ background: 'var(--c)' }}>
          <div className="flex items-center gap-4 text-white">
            <div className="text-4xl">{getAgentIcon(agentType)}</div>
            <div>
              <h2 className="text-2xl font-bold">AI Decision Explanation</h2>
              <p className="text-content-tertiary">{getAgentDisplayName(agentType)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface hover:bg-opacity-20" style={{ color: 'var(--t0)' }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Recommendation Summary */}
          <div className="rounded-lg p-6 border vc-border-subtle" style={{ background: 'var(--cd)' }}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <Brain size={32} className="text-accent-primary" />
                <div>
                  <h3 className="text-xl font-bold text-content-primary">Recommendation</h3>
                  <p className="text-content-secondary">What the AI suggests and why</p>
                </div>
              </div>
              <span className={`px-4 py-2 rounded-full text-sm font-medium ${getConfidenceColor(confidence)}`}>
                {confidence}% {getConfidenceLabel(confidence)}
              </span>
            </div>

            <div className="bg-surface bg-opacity-60 rounded-lg p-4">
              <div className="text-lg font-semibold text-content-primary mb-2">
                {recommendation?.name || recommendation?.value || JSON.stringify(recommendation)}
              </div>
              {metadata?.summary && (
                <p className="text-content-secondary">{metadata.summary}</p>
              )}
            </div>
          </div>

          {/* Decision Factors */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={24} className="text-accent-primary" />
              <h3 className="text-xl font-bold text-content-primary">Decision Factors</h3>
            </div>
            <div className="text-sm text-content-secondary mb-4">
              The AI considered {factors.length} factors to make this decision. Each factor is weighted based on importance and scored based on how well the option performs.
            </div>
            <FactorBreakdown factors={factors} showDetails={true} compact={false} />
          </div>

          {/* Alternatives Considered */}
          {alternatives && alternatives.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Award size={24} className="text-accent-primary" />
                <h3 className="text-xl font-bold text-content-primary">Alternatives Considered</h3>
              </div>
              <div className="text-sm text-content-secondary mb-4">
                The AI evaluated {alternatives.length + 1} total options. Here's why the other options scored lower:
              </div>
              <div className="space-y-3">
                {alternatives.map((alt, index) => (
                  <div
                    key={index}
                    className="bg-surface-muted rounded-lg p-4 border border-line-default"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-content-tertiary font-bold">#{index + 2}</span>
                        <span className="font-semibold text-content-primary">
                          {alt.option?.name || alt.option?.value || JSON.stringify(alt.option)}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-content-secondary">
                        Score: {alt.score} / 100
                      </span>
                    </div>

                    {/* Why Lower */}
                    <div className="mb-3">
                      <div className="text-xs font-medium text-content-tertiary mb-1">Why ranked lower:</div>
                      <p className="text-sm text-content-secondary">{alt.whyLower}</p>
                    </div>

                    {/* Alternative Factors */}
                    {alt.factors && alt.factors.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-line-default">
                        <div className="text-xs font-medium text-content-tertiary mb-2">Factor Comparison:</div>
                        <FactorBreakdown factors={alt.factors} showDetails={false} compact={true} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* How to Improve AI */}
          <div className="bg-semantic-info-dim border border-semantic-info rounded-lg p-6">
            <div className="flex items-start gap-3">
              <HelpCircle size={24} className="text-semantic-info flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-semibold text-semantic-info mb-2">Help the AI Learn</h4>
                <p className="text-sm text-semantic-info mb-3">
                  If you disagree with this recommendation, you can override it. The AI will learn from your corrections and improve its future recommendations.
                </p>
                <div className="text-xs text-semantic-info">
                  Learn more about{' '}
                  <a href="#" className="underline font-medium">
                    AI Learning & Feedback
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Metadata */}
          {metadata && (
            <div className="text-xs text-content-tertiary border-t border-line-default pt-4">
              <div>Generated: {new Date(metadata.generatedAt || explanation.created_at).toLocaleString()}</div>
              <div>Explanation Version: {metadata.version || '1.0'}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-surface-muted border-t border-line-default px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-md font-medium" style={{ background: 'var(--c)', color: 'var(--t0)' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
