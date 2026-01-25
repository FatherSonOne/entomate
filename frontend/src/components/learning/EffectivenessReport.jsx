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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-800">
          <AlertTriangle size={20} />
          <span>Error: {error}</span>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-gray-600">
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
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Learning Effectiveness Report</h2>
            <p className="text-sm text-gray-600 mt-1">
              {new Date(period.startDate).toLocaleDateString()} - {new Date(period.endDate).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-lg">
            <BarChart3 size={20} className="text-indigo-600" />
            <span className="text-sm font-medium text-indigo-900">{period.days} Day Report</span>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Active Patterns */}
          <div className="bg-indigo-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target size={18} className="text-indigo-600" />
              <span className="text-sm font-medium text-indigo-900">Active Patterns</span>
            </div>
            <div className="text-3xl font-bold text-indigo-600">{activePatternsCount}</div>
          </div>

          {/* Total Overrides */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info size={18} className="text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Total Overrides</span>
            </div>
            <div className="text-3xl font-bold text-blue-600">{overrides.total}</div>
          </div>

          {/* Success Rate */}
          <div className={`rounded-lg p-4 ${
            overrides.successRate >= 70 ? 'bg-green-50' :
            overrides.successRate >= 50 ? 'bg-yellow-50' : 'bg-red-50'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={18} className={
                overrides.successRate >= 70 ? 'text-green-600' :
                overrides.successRate >= 50 ? 'text-yellow-600' : 'text-red-600'
              } />
              <span className={`text-sm font-medium ${
                overrides.successRate >= 70 ? 'text-green-900' :
                overrides.successRate >= 50 ? 'text-yellow-900' : 'text-red-900'
              }`}>Success Rate</span>
            </div>
            <div className={`text-3xl font-bold ${
              overrides.successRate >= 70 ? 'text-green-600' :
              overrides.successRate >= 50 ? 'text-yellow-600' : 'text-red-600'
            }`}>{overrides.successRate}%</div>
            <div className="text-xs text-gray-600 mt-1">
              {overrides.successful} / {overrides.withOutcomes} tracked
            </div>
          </div>

          {/* Time Saved */}
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={18} className="text-purple-600" />
              <span className="text-sm font-medium text-purple-900">Time Saved</span>
            </div>
            <div className="text-3xl font-bold text-purple-600">
              {estimatedTimeSaved.hoursSaved}h
            </div>
            <div className="text-xs text-gray-600 mt-1">
              ~{estimatedTimeSaved.overridesPreventedEstimate} overrides prevented
            </div>
          </div>
        </div>
      </div>

      {/* Top Performing Patterns */}
      {topPerformingPatterns && topPerformingPatterns.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={20} className="text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Top Performing Patterns</h3>
          </div>
          <div className="space-y-3">
            {topPerformingPatterns.map((pattern, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{pattern.description}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {pattern.totalOutcomes} outcomes tracked • Confidence: {pattern.confidence}%
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">{pattern.successRate}%</div>
                    <div className="text-xs text-gray-600">Success</div>
                  </div>
                  <CheckCircle size={24} className="text-green-600" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Low Performing Patterns */}
      {lowPerformingPatterns && lowPerformingPatterns.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown size={20} className="text-orange-600" />
            <h3 className="text-lg font-semibold text-gray-900">Patterns Needing Attention</h3>
          </div>
          <div className="space-y-3">
            {lowPerformingPatterns.map((pattern, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-orange-50 border border-orange-200 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{pattern.description}</p>
                  <p className="text-xs text-orange-700 mt-1 italic">{pattern.recommendation}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {pattern.totalOutcomes} outcomes tracked • Confidence: {pattern.confidence}%
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-orange-600">{pattern.successRate}%</div>
                    <div className="text-xs text-gray-600">Success</div>
                  </div>
                  <AlertTriangle size={24} className="text-orange-600" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Patterns Overview */}
      {patterns && patterns.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">All Active Patterns</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pattern
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Confidence
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Validation
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Activated
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {patterns.map((pattern, index) => (
                  <tr key={pattern.id || index}>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {pattern.description || 'No description'}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        pattern.confidence >= 80 ? 'bg-green-100 text-green-800' :
                        pattern.confidence >= 60 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {pattern.confidence}%
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {pattern.validation ? (
                        <div>
                          <div className="font-medium">
                            {pattern.validation.successRate
                              ? `${Math.round(pattern.validation.successRate * 100)}%`
                              : 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {pattern.validation.totalOutcomes || 0} outcomes
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">Not validated</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
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
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Info size={20} className="text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Recommendations</h3>
          </div>
          <div className="space-y-2">
            {recommendations.map((rec, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  rec.type === 'warning' ? 'bg-orange-50 border border-orange-200' :
                  rec.type === 'suggestion' ? 'bg-blue-50 border border-blue-200' :
                  'bg-gray-50 border border-gray-200'
                }`}
              >
                {rec.type === 'warning' ? (
                  <AlertTriangle size={18} className="text-orange-600 mt-0.5 flex-shrink-0" />
                ) : rec.type === 'suggestion' ? (
                  <Info size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <CheckCircle size={18} className="text-gray-600 mt-0.5 flex-shrink-0" />
                )}
                <p className={`text-sm ${
                  rec.type === 'warning' ? 'text-orange-800' :
                  rec.type === 'suggestion' ? 'text-blue-800' :
                  'text-gray-700'
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
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <Info size={48} className="text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Learning Data Yet</h3>
          <p className="text-gray-600">
            Start using the system and providing feedback to generate effectiveness insights.
          </p>
        </div>
      )}
    </div>
  );
}
