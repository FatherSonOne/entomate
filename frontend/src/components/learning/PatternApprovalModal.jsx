import React, { useState } from 'react';
import {
  X, CheckCircle, AlertCircle, TrendingUp, Target, Calendar, HelpCircle
} from 'lucide-react';

/**
 * Pattern Approval Modal Component
 * Detailed modal for reviewing and approving/rejecting learning patterns
 */
export default function PatternApprovalModal({
  pattern,
  onApprove,
  onReject,
  onClose,
  getAgentIcon,
  getAgentName
}) {
  const [action, setAction] = useState('approve'); // 'approve', 'customize', 'reject'
  const [customization, setCustomization] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const patternData = pattern.pattern_data || {};

  const getConfidenceColor = (confidence) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getConfidenceLabel = (confidence) => {
    if (confidence >= 80) return 'High';
    if (confidence >= 60) return 'Medium';
    return 'Low';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const handleApprove = () => {
    if (action === 'customize') {
      onApprove(pattern, customization);
    } else {
      onApprove(pattern, null);
    }
  };

  const handleReject = () => {
    onReject(pattern, rejectionReason || null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{getAgentIcon(pattern.agent_type)}</span>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Review Detected Pattern</h2>
              <p className="text-sm text-gray-600">{getAgentName(pattern.agent_type)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Pattern Description */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Pattern Description</h3>
            <p className="text-gray-700 text-base">{patternData.description}</p>
          </div>

          {/* Evidence */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Evidence</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={16} className="text-blue-600" />
                  <div className="text-xs font-medium text-blue-900">Sample Size</div>
                </div>
                <div className="text-2xl font-bold text-blue-700">{patternData.sampleSize || 0}</div>
                <div className="text-xs text-blue-600">overrides in last 90 days</div>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle size={16} className="text-green-600" />
                  <div className="text-xs font-medium text-green-900">Consistency</div>
                </div>
                <div className="text-2xl font-bold text-green-700">
                  {Math.round((patternData.consistency || 0) * 100)}%
                </div>
                <div className="text-xs text-green-600">
                  {Math.round((patternData.sampleSize || 0) * (patternData.consistency || 0))} out of{' '}
                  {patternData.sampleSize || 0} times
                </div>
              </div>

              <div className={`bg-gray-50 rounded-lg p-4`}>
                <div className="flex items-center gap-2 mb-1">
                  <Target size={16} className="text-gray-600" />
                  <div className="text-xs font-medium text-gray-900">Confidence</div>
                </div>
                <div className={`text-2xl font-bold ${getConfidenceColor(pattern.confidence)}`}>
                  {pattern.confidence}%
                </div>
                <div className="text-xs text-gray-600">{getConfidenceLabel(pattern.confidence)} confidence</div>
              </div>

              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar size={16} className="text-purple-600" />
                  <div className="text-xs font-medium text-purple-900">Recency</div>
                </div>
                <div className="text-2xl font-bold text-purple-700">
                  {patternData.daysSinceLastOverride || 0}
                </div>
                <div className="text-xs text-purple-600">days since last override</div>
              </div>
            </div>
          </div>

          {/* User Feedback */}
          {patternData.feedbackReasons && patternData.feedbackReasons.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">User Feedback</h3>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="space-y-2">
                  {patternData.feedbackReasons.slice(0, 5).map((feedback, index) => (
                    <div key={index} className="text-sm text-amber-900">
                      "{feedback.text || feedback.reason || 'No feedback provided'}"
                    </div>
                  ))}
                  {patternData.feedbackReasons.length > 5 && (
                    <div className="text-xs text-amber-700 font-medium">
                      + {patternData.feedbackReasons.length - 5} more feedback entries
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* How It Will Improve AI */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">How This Will Improve AI</h3>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              {pattern.pattern_type === 'preference' && patternData.preferredOption && (
                <div className="space-y-2">
                  <div className="text-sm text-indigo-900">
                    <span className="font-semibold">Skill Match Factor:</span> +15% for{' '}
                    {patternData.preferredOption} on {patternData.context} tasks
                  </div>
                  <div className="text-sm text-indigo-900">
                    <span className="font-semibold">Reduces Future Overrides:</span> Estimated 80% accuracy for
                    similar tasks
                  </div>
                  <div className="text-sm text-indigo-900">
                    <span className="font-semibold">Time Saved:</span> ~2 minutes per week
                  </div>
                </div>
              )}

              {pattern.pattern_type === 'boost' && (
                <div className="space-y-2">
                  <div className="text-sm text-indigo-900">
                    <span className="font-semibold">Priority Adjustment:</span>{' '}
                    {patternData.direction === 'increase' ? '+' : ''}
                    {patternData.boostAmount}% for {patternData.context} tasks
                  </div>
                  <div className="text-sm text-indigo-900">
                    <span className="font-semibold">Better Alignment:</span> Matches your strategic priorities
                  </div>
                </div>
              )}

              {pattern.pattern_type === 'constraint' && (
                <div className="space-y-2">
                  <div className="text-sm text-indigo-900">
                    <span className="font-semibold">Exclusion Rule:</span> Will avoid suggesting{' '}
                    {patternData.excludedOptions?.join(', ')}
                  </div>
                  <div className="text-sm text-indigo-900">
                    <span className="font-semibold">Prevents Errors:</span> Eliminates repeatedly rejected options
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Why Was This Detected */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle size={20} className="text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Why Did the AI Learn This?</h3>
            </div>
            <div className="text-sm text-gray-700 space-y-2">
              <p>
                The AI detected this pattern because you consistently made the same choice{' '}
                {Math.round((patternData.consistency || 0) * 100)}% of the time (
                {Math.round((patternData.sampleSize || 0) * (patternData.consistency || 0))} out of{' '}
                {patternData.sampleSize || 0} overrides) when working with {patternData.context} tasks.
              </p>
              {patternData.topFeedbackReason && (
                <p>
                  The most common reason you provided was: "{patternData.topFeedbackReason}"
                </p>
              )}
            </div>
          </div>

          {/* Action Selection */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Action</h3>
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border-2 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
                <input
                  type="radio"
                  name="action"
                  value="approve"
                  checked={action === 'approve'}
                  onChange={(e) => setAction(e.target.value)}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Accept and apply this pattern</div>
                  <div className="text-sm text-gray-600">
                    The AI will use this pattern to improve future recommendations
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border-2 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors opacity-50 cursor-not-allowed">
                <input
                  type="radio"
                  name="action"
                  value="customize"
                  disabled
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Customize pattern (Coming Soon)</div>
                  <div className="text-sm text-gray-600">
                    Fine-tune when this pattern should apply
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border-2 border-gray-200 hover:border-red-300 hover:bg-red-50 transition-colors">
                <input
                  type="radio"
                  name="action"
                  value="reject"
                  checked={action === 'reject'}
                  onChange={(e) => setAction(e.target.value)}
                  className="mt-1 text-red-600 focus:ring-red-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Reject this pattern</div>
                  <div className="text-sm text-gray-600">
                    The AI will not use this pattern
                  </div>
                </div>
              </label>

              {action === 'reject' && (
                <div className="ml-9 mt-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason (optional):
                  </label>
                  <input
                    type="text"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Why are you rejecting this pattern?"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={action === 'reject' ? handleReject : handleApprove}
            className={`flex-1 px-4 py-2 rounded-md font-medium ${
              action === 'reject'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {action === 'reject' ? 'Reject Pattern' : 'Accept & Apply Pattern'}
          </button>
        </div>
      </div>
    </div>
  );
}
