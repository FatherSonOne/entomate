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
    if (confidence >= 80) return 'text-semantic-success';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-semantic-warning';
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
      <div className="bg-surface rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-line-default px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{getAgentIcon(pattern.agent_type)}</span>
            <div>
              <h2 className="text-xl font-bold text-content-primary">Review Detected Pattern</h2>
              <p className="text-sm text-content-secondary">{getAgentName(pattern.agent_type)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-content-tertiary hover:text-content-secondary p-1 rounded-full hover:bg-surface-muted"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Pattern Description */}
          <div>
            <h3 className="text-lg font-semibold text-content-primary mb-2">Pattern Description</h3>
            <p className="text-content-secondary text-base">{patternData.description}</p>
          </div>

          {/* Evidence */}
          <div>
            <h3 className="text-lg font-semibold text-content-primary mb-3">Evidence</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-semantic-info-dim rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={16} className="text-semantic-info" />
                  <div className="text-xs font-medium text-semantic-info">Sample Size</div>
                </div>
                <div className="text-2xl font-bold text-semantic-info">{patternData.sampleSize || 0}</div>
                <div className="text-xs text-semantic-info">overrides in last 90 days</div>
              </div>

              <div className="bg-semantic-success-dim rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle size={16} className="text-semantic-success" />
                  <div className="text-xs font-medium text-semantic-success">Consistency</div>
                </div>
                <div className="text-2xl font-bold text-semantic-success">
                  {Math.round((patternData.consistency || 0) * 100)}%
                </div>
                <div className="text-xs text-semantic-success">
                  {Math.round((patternData.sampleSize || 0) * (patternData.consistency || 0))} out of{' '}
                  {patternData.sampleSize || 0} times
                </div>
              </div>

              <div className={`bg-surface-muted rounded-lg p-4`}>
                <div className="flex items-center gap-2 mb-1">
                  <Target size={16} className="text-content-secondary" />
                  <div className="text-xs font-medium text-content-primary">Confidence</div>
                </div>
                <div className={`text-2xl font-bold ${getConfidenceColor(pattern.confidence)}`}>
                  {pattern.confidence}%
                </div>
                <div className="text-xs text-content-secondary">{getConfidenceLabel(pattern.confidence)} confidence</div>
              </div>

              <div className="bg-accent-tertiary-dim rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar size={16} className="text-accent-tertiary" />
                  <div className="text-xs font-medium text-accent-tertiary">Recency</div>
                </div>
                <div className="text-2xl font-bold text-accent-tertiary">
                  {patternData.daysSinceLastOverride || 0}
                </div>
                <div className="text-xs text-accent-tertiary">days since last override</div>
              </div>
            </div>
          </div>

          {/* User Feedback */}
          {patternData.feedbackReasons && patternData.feedbackReasons.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-content-primary mb-3">User Feedback</h3>
              <div className="bg-semantic-warning-dim border border-semantic-warning rounded-lg p-4">
                <div className="space-y-2">
                  {patternData.feedbackReasons.slice(0, 5).map((feedback, index) => (
                    <div key={index} className="text-sm text-semantic-warning">
                      "{feedback.text || feedback.reason || 'No feedback provided'}"
                    </div>
                  ))}
                  {patternData.feedbackReasons.length > 5 && (
                    <div className="text-xs text-semantic-warning font-medium">
                      + {patternData.feedbackReasons.length - 5} more feedback entries
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* How It Will Improve AI */}
          <div>
            <h3 className="text-lg font-semibold text-content-primary mb-3">How This Will Improve AI</h3>
            <div className="bg-accent-primary-dim border border-indigo-200 rounded-lg p-4">
              {pattern.pattern_type === 'preference' && patternData.preferredOption && (
                <div className="space-y-2">
                  <div className="text-sm text-accent-primary">
                    <span className="font-semibold">Skill Match Factor:</span> +15% for{' '}
                    {patternData.preferredOption} on {patternData.context} tasks
                  </div>
                  <div className="text-sm text-accent-primary">
                    <span className="font-semibold">Reduces Future Overrides:</span> Estimated 80% accuracy for
                    similar tasks
                  </div>
                  <div className="text-sm text-accent-primary">
                    <span className="font-semibold">Time Saved:</span> ~2 minutes per week
                  </div>
                </div>
              )}

              {pattern.pattern_type === 'boost' && (
                <div className="space-y-2">
                  <div className="text-sm text-accent-primary">
                    <span className="font-semibold">Priority Adjustment:</span>{' '}
                    {patternData.direction === 'increase' ? '+' : ''}
                    {patternData.boostAmount}% for {patternData.context} tasks
                  </div>
                  <div className="text-sm text-accent-primary">
                    <span className="font-semibold">Better Alignment:</span> Matches your strategic priorities
                  </div>
                </div>
              )}

              {pattern.pattern_type === 'constraint' && (
                <div className="space-y-2">
                  <div className="text-sm text-accent-primary">
                    <span className="font-semibold">Exclusion Rule:</span> Will avoid suggesting{' '}
                    {patternData.excludedOptions?.join(', ')}
                  </div>
                  <div className="text-sm text-accent-primary">
                    <span className="font-semibold">Prevents Errors:</span> Eliminates repeatedly rejected options
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Why Was This Detected */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle size={20} className="text-content-secondary" />
              <h3 className="text-lg font-semibold text-content-primary">Why Did the AI Learn This?</h3>
            </div>
            <div className="text-sm text-content-secondary space-y-2">
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
            <h3 className="text-lg font-semibold text-content-primary mb-3">Action</h3>
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border-2 border-line-default hover:border-indigo-300 hover:bg-accent-primary-dim transition-colors">
                <input
                  type="radio"
                  name="action"
                  value="approve"
                  checked={action === 'approve'}
                  onChange={(e) => setAction(e.target.value)}
                  className="mt-1 text-accent-primary focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-content-primary">Accept and apply this pattern</div>
                  <div className="text-sm text-content-secondary">
                    The AI will use this pattern to improve future recommendations
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border-2 border-line-default hover:border-indigo-300 hover:bg-accent-primary-dim transition-colors opacity-50 cursor-not-allowed">
                <input
                  type="radio"
                  name="action"
                  value="customize"
                  disabled
                  className="mt-1 text-accent-primary focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-content-primary">Customize pattern (Coming Soon)</div>
                  <div className="text-sm text-content-secondary">
                    Fine-tune when this pattern should apply
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border-2 border-line-default hover:border-semantic-error hover:bg-semantic-error-dim transition-colors">
                <input
                  type="radio"
                  name="action"
                  value="reject"
                  checked={action === 'reject'}
                  onChange={(e) => setAction(e.target.value)}
                  className="mt-1 text-semantic-error focus:ring-red-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-content-primary">Reject this pattern</div>
                  <div className="text-sm text-content-secondary">
                    The AI will not use this pattern
                  </div>
                </div>
              </label>

              {action === 'reject' && (
                <div className="ml-9 mt-2">
                  <label className="block text-sm font-medium text-content-secondary mb-1">
                    Reason (optional):
                  </label>
                  <input
                    type="text"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Why are you rejecting this pattern?"
                    className="w-full px-3 py-2 border border-line-strong rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-surface-muted border-t border-line-default px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-surface border border-line-strong text-content-secondary rounded-md hover:bg-surface-muted font-medium"
          >
            Cancel
          </button>
          <button
            onClick={action === 'reject' ? handleReject : handleApprove}
            className={`flex-1 px-4 py-2 rounded-md font-medium ${
              action === 'reject'
                ? 'bg-semantic-error text-white hover:opacity-90'
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
