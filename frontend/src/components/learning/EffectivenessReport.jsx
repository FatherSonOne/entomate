import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertTriangle,
  Info,
  Clock,
  Target,
  BarChart3
} from 'lucide-react';
import api from '../../services/api';

/**
 * Effectiveness Report Component
 * Displays comprehensive effectiveness metrics for learning patterns
 */
export default function EffectivenessReport({ days = 30, className = '' }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadReport();
  }, [days]);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.learning.getEffectivenessReport(days);
      setReport(response.data);
    } catch (err) {
      console.error('[EffectivenessReport] Load error:', err);
      setError(err.message || 'Failed to load effectiveness report');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 vc-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-semantic-error-dim border border-semantic-error rounded-lg p-4">
        <div className="flex items-center gap-2 text-semantic-error">
          <AlertTriangle size={20} />
          <span>Error: {error}</span>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="bg-surface-muted border border-line-default rounded-lg p-4">
        <div className="flex items-center gap-2 text-content-secondary">
          <Info size={20} />
          <span>No report data available</span>
        </div>
      </div>
    );
  }

  const {
    period,
    activePatternsCount,
    overrides,
    patterns,
    topPerformingPatterns,
    lowPerformingPatterns,
    estimatedTimeSaved,
    recommendations
  } = report;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Report Header */}
      <div className="bg-surface border border-line-default rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-content-primary">Learning Effectiveness Report</h2>
            <p className="text-sm text-content-secondary mt-1">
              {new Date(period.startDate).toLocaleDateString()} - {new Date(period.endDate).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-accent-primary-dim rounded-lg">
            <BarChart3 size={20} className="text-accent-primary" />
            <span className="text-sm font-medium text-accent-primary">{period.days} Day Report</span>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Active Patterns */}
          <div className="bg-accent-primary-dim rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target size={18} className="text-accent-primary" />
              <span className="text-sm font-medium text-accent-primary">Active Patterns</span>
            </div>
            <div className="text-3xl font-bold text-accent-primary">{activePatternsCount}</div>
          </div>

          {/* Total Overrides */}
          <div className="bg-semantic-info-dim rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info size={18} className="text-semantic-info" />
              <span className="text-sm font-medium text-semantic-info">Total Overrides</span>
            </div>
            <div className="text-3xl font-bold text-semantic-info">{overrides.total}</div>
          </div>

          {/* Success Rate */}
          <div className={`rounded-lg p-4 ${
            overrides.successRate >= 70 ? 'bg-semantic-success-dim' :
            overrides.successRate >= 50 ? 'vc-bg-warning-dim' : 'bg-semantic-error-dim'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={18} className={
                overrides.successRate >= 70 ? 'text-semantic-success' :
                overrides.successRate >= 50 ? 'vc-text-warning' : 'text-semantic-error'
              } />
              <span className={`text-sm font-medium ${
                overrides.successRate >= 70 ? 'text-semantic-success' :
                overrides.successRate >= 50 ? 'vc-text-warning' : 'text-semantic-error'
              }`}>Success Rate</span>
            </div>
            <div className={`text-3xl font-bold ${
              overrides.successRate >= 70 ? 'text-semantic-success' :
              overrides.successRate >= 50 ? 'vc-text-warning' : 'text-semantic-error'
            }`}>{overrides.successRate}%</div>
            <div className="text-xs text-content-secondary mt-1">
              {overrides.successful} / {overrides.withOutcomes} tracked
            </div>
          </div>

          {/* Time Saved */}
          <div className="bg-accent-tertiary-dim rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={18} className="text-accent-tertiary" />
              <span className="text-sm font-medium text-accent-tertiary">Time Saved</span>
            </div>
            <div className="text-3xl font-bold text-accent-tertiary">
              {estimatedTimeSaved.hoursSaved}h
            </div>
            <div className="text-xs text-content-secondary mt-1">
              ~{estimatedTimeSaved.overridesPreventedEstimate} overrides prevented
            </div>
          </div>
        </div>
      </div>

      {/* Top Performing Patterns */}
      {topPerformingPatterns && topPerformingPatterns.length > 0 && (
        <div className="bg-surface border border-line-default rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={20} className="text-semantic-success" />
            <h3 className="text-lg font-semibold text-content-primary">Top Performing Patterns</h3>
          </div>
          <div className="space-y-3">
            {topPerformingPatterns.map((pattern, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-semantic-success-dim border border-semantic-success rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-content-primary">{pattern.description}</p>
                  <p className="text-xs text-content-secondary mt-1">
                    {pattern.totalOutcomes} outcomes tracked • Confidence: {pattern.confidence}%
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-semantic-success">{pattern.successRate}%</div>
                    <div className="text-xs text-content-secondary">Success</div>
                  </div>
                  <CheckCircle size={24} className="text-semantic-success" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Low Performing Patterns */}
      {lowPerformingPatterns && lowPerformingPatterns.length > 0 && (
        <div className="bg-surface border border-line-default rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown size={20} className="text-semantic-warning" />
            <h3 className="text-lg font-semibold text-content-primary">Patterns Needing Attention</h3>
          </div>
          <div className="space-y-3">
            {lowPerformingPatterns.map((pattern, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 vc-bg-warning-dim border border-semantic-warning rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-content-primary">{pattern.description}</p>
                  <p className="text-xs vc-text-warning mt-1 italic">{pattern.recommendation}</p>
                  <p className="text-xs text-content-secondary mt-1">
                    {pattern.totalOutcomes} outcomes tracked • Confidence: {pattern.confidence}%
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-semantic-warning">{pattern.successRate}%</div>
                    <div className="text-xs text-content-secondary">Success</div>
                  </div>
                  <AlertTriangle size={24} className="text-semantic-warning" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Patterns Overview */}
      {patterns && patterns.length > 0 && (
        <div className="bg-surface border border-line-default rounded-lg p-6">
          <h3 className="text-lg font-semibold text-content-primary mb-4">All Active Patterns</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-content-tertiary uppercase tracking-wider">
                    Pattern
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-content-tertiary uppercase tracking-wider">
                    Confidence
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-content-tertiary uppercase tracking-wider">
                    Validation
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-content-tertiary uppercase tracking-wider">
                    Activated
                  </th>
                </tr>
              </thead>
              <tbody className="bg-surface divide-y divide-gray-200">
                {patterns.map((pattern, index) => (
                  <tr key={pattern.id || index}>
                    <td className="px-4 py-4 text-sm text-content-primary">
                      {pattern.description || 'No description'}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        pattern.confidence >= 80 ? 'bg-semantic-success-dim text-semantic-success' :
                        pattern.confidence >= 60 ? 'vc-bg-warning-dim vc-text-warning' :
                        'bg-surface-muted text-content-primary'
                      }`}>
                        {pattern.confidence}%
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-content-secondary">
                      {pattern.validation ? (
                        <div>
                          <div className="font-medium">
                            {pattern.validation.successRate
                              ? `${Math.round(pattern.validation.successRate * 100)}%`
                              : 'N/A'}
                          </div>
                          <div className="text-xs text-content-tertiary">
                            {pattern.validation.totalOutcomes || 0} outcomes
                          </div>
                        </div>
                      ) : (
                        <span className="text-content-tertiary">Not validated</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-content-secondary">
                      {pattern.activated ? new Date(pattern.activated).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="bg-surface border border-line-default rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Info size={20} className="text-semantic-info" />
            <h3 className="text-lg font-semibold text-content-primary">Recommendations</h3>
          </div>
          <div className="space-y-2">
            {recommendations.map((rec, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  rec.type === 'warning' ? 'vc-bg-warning-dim border border-semantic-warning' :
                  rec.type === 'suggestion' ? 'bg-semantic-info-dim border border-semantic-info' :
                  'bg-surface-muted border border-line-default'
                }`}
              >
                {rec.type === 'warning' ? (
                  <AlertTriangle size={18} className="text-semantic-warning mt-0.5 flex-shrink-0" />
                ) : rec.type === 'suggestion' ? (
                  <Info size={18} className="text-semantic-info mt-0.5 flex-shrink-0" />
                ) : (
                  <CheckCircle size={18} className="text-content-secondary mt-0.5 flex-shrink-0" />
                )}
                <p className={`text-sm ${
                  rec.type === 'warning' ? 'text-semantic-warning' :
                  rec.type === 'suggestion' ? 'text-semantic-info' :
                  'text-content-secondary'
                }`}>
                  {rec.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Data State */}
      {activePatternsCount === 0 && overrides.total === 0 && (
        <div className="bg-surface-muted border border-line-default rounded-lg p-8 text-center">
          <Info size={48} className="text-content-tertiary mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-content-secondary mb-2">No Learning Data Yet</h3>
          <p className="text-content-secondary">
            Start using the system and providing feedback to generate effectiveness insights.
          </p>
        </div>
      )}
    </div>
  );
}
