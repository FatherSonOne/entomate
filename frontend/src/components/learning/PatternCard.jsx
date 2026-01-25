import React from 'react';
import {
  CheckCircle, X, TrendingUp, AlertCircle, Calendar, Target, Settings
} from 'lucide-react';

/**
 * Pattern Card Component
 * Displays a single learning pattern with details and actions
 */
export default function PatternCard({
  pattern,
  status, // 'active' or 'pending'
  onApprove,
  onReject,
  onDeactivate,
  onCustomize,
  getAgentIcon,
  getAgentName
}) {
  const patternData = pattern.pattern_data || {};

  const getConfidenceColor = (confidence) => {
    if (confidence >= 80) return 'text-green-600 bg-green-100';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-orange-600 bg-orange-100';
  };

  const getConfidenceLabel = (confidence) => {
    if (confidence >= 80) return 'High';
    if (confidence >= 60) return 'Medium';
    return 'Low';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getPatternIcon = (patternType) => {
    const icons = {
      preference: '⭐',
      constraint: '🚫',
      boost: '📈',
      context: '🎯'
    };
    return icons[patternType] || '📊';
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3 flex-1">
          {/* Agent Icon */}
          <div className="text-2xl">{getAgentIcon(pattern.agent_type)}</div>

          {/* Pattern Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{getPatternIcon(pattern.pattern_type)}</span>
              <h3 className="font-semibold text-gray-900">
                {getAgentName(pattern.agent_type)} Pattern
              </h3>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${getConfidenceColor(
                  pattern.confidence
                )}`}
              >
                {getConfidenceLabel(pattern.confidence)} ({pattern.confidence}%)
              </span>
            </div>

            <p className="text-sm text-gray-700 font-medium mb-2">{patternData.description}</p>

            {/* Pattern Details */}
            <div className="text-xs text-gray-600 space-y-1">
              {patternData.context && (
                <div className="flex items-center gap-1">
                  <Target size={12} />
                  <span>Context: {patternData.context}</span>
                </div>
              )}
              {patternData.sampleSize && (
                <div className="flex items-center gap-1">
                  <TrendingUp size={12} />
                  <span>Based on {patternData.sampleSize} override{patternData.sampleSize > 1 ? 's' : ''}</span>
                </div>
              )}
              {patternData.consistency && (
                <div className="flex items-center gap-1">
                  <CheckCircle size={12} />
                  <span>Consistency: {Math.round(patternData.consistency * 100)}%</span>
                </div>
              )}
              {status === 'active' && pattern.activated_at && (
                <div className="flex items-center gap-1">
                  <Calendar size={12} />
                  <span>Active since {formatDate(pattern.activated_at)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          {status === 'active' ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <CheckCircle size={12} />
              Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              <AlertCircle size={12} />
              Pending
            </span>
          )}
        </div>
      </div>

      {/* Feedback Reasons (if available) */}
      {patternData.topFeedbackReason && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <div className="text-xs font-medium text-blue-900 mb-1">Most Common Feedback:</div>
          <div className="text-sm text-blue-700">"{formatFeedbackReason(patternData.topFeedbackReason)}"</div>
        </div>
      )}

      {/* Pattern Type Specific Details */}
      {pattern.pattern_type === 'preference' && patternData.preferredOption && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-xs font-medium text-gray-700 mb-1">Pattern Details:</div>
          <div className="text-sm text-gray-900">
            Prefer <span className="font-semibold text-indigo-600">{patternData.preferredOption}</span>
            {patternData.alternativeOption && (
              <> over <span className="font-semibold text-gray-600">{patternData.alternativeOption}</span></>
            )}
          </div>
        </div>
      )}

      {pattern.pattern_type === 'boost' && patternData.boostAmount && (
        <div className="mb-4 p-3 bg-purple-50 rounded-lg">
          <div className="text-xs font-medium text-purple-900 mb-1">Impact:</div>
          <div className="text-sm text-purple-700">
            {patternData.direction === 'increase' ? 'Increase' : 'Decrease'} {patternData.factor} by{' '}
            {Math.abs(patternData.boostAmount)}%
          </div>
        </div>
      )}

      {pattern.pattern_type === 'constraint' && patternData.excludedOptions && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg">
          <div className="text-xs font-medium text-red-900 mb-1">Constraints:</div>
          <div className="text-sm text-red-700">
            Avoid: {patternData.excludedOptions.join(', ')}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
        {status === 'pending' && (
          <>
            <button
              onClick={() => onApprove && onApprove(pattern)}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium text-sm flex items-center justify-center gap-1"
            >
              <CheckCircle size={16} />
              Approve & Apply
            </button>
            <button
              onClick={() => onReject && onReject(pattern)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium text-sm flex items-center justify-center gap-1"
            >
              <X size={16} />
              Reject
            </button>
          </>
        )}

        {status === 'active' && (
          <>
            <button
              onClick={() => onCustomize && onCustomize(pattern)}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 font-medium text-sm flex items-center justify-center gap-1"
            >
              <Settings size={16} />
              Customize
            </button>
            <button
              onClick={() => onDeactivate && onDeactivate(pattern)}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 font-medium text-sm flex items-center justify-center gap-1"
            >
              <X size={16} />
              Deactivate
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Format feedback reason for display
 */
function formatFeedbackReason(reason) {
  const reasonMap = {
    client_relationship: 'Has the client relationship',
    requested_project: 'Requested this project',
    more_experience: 'More experience in this area',
    currently_available: 'Currently available',
    better_skill_match: 'Better skill match',
    team_preference: 'Team preference',
    higher_business_impact: 'Higher business impact than AI thinks',
    more_urgent: 'More urgent than AI calculated',
    blocking_other_work: 'Blocking other work',
    strategic_importance: 'Strategic importance',
    customer_commitment: 'Customer commitment',
    more_complex: 'More complex than estimated',
    team_slower: 'Team is slower on this type of work',
    external_dependency: 'External dependency',
    quality_buffer: 'Quality buffer needed'
  };

  return reasonMap[reason] || reason;
}
