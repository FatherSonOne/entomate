import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useToast } from '../vc/ToastProvider';

/**
 * FeedbackPrompt Component
 * Shows when user overrides an AI recommendation
 * Allows user to provide optional feedback to help AI learn
 */
export default function FeedbackPrompt({
  agentType,
  agentExecutionId,
  originalRecommendation,
  userChoice,
  context,
  onClose,
  onSubmit
}) {
  const toast = useToast();
  const [feedbackReason, setFeedbackReason] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [otherText, setOtherText] = useState('');
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoCloseTimer, setAutoCloseTimer] = useState(30);

  // Auto-close timer
  useEffect(() => {
    const timer = setInterval(() => {
      setAutoCloseTimer(prev => {
        if (prev <= 1) {
          handleSkip();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Get feedback options based on agent type
  const getFeedbackOptions = () => {
    const options = {
      assignment: [
        { value: 'client_relationship', label: 'Has the client relationship' },
        { value: 'requested_project', label: 'Requested this project' },
        { value: 'more_experience', label: 'More experience in this area' },
        { value: 'currently_available', label: 'Currently available' },
        { value: 'better_skill_match', label: 'Better skill match' },
        { value: 'team_preference', label: 'Team preference' }
      ],
      priority: [
        { value: 'higher_business_impact', label: 'Higher business impact than AI thinks' },
        { value: 'more_urgent', label: 'More urgent than AI calculated' },
        { value: 'blocking_other_work', label: 'Blocking other work' },
        { value: 'strategic_importance', label: 'Strategic importance' },
        { value: 'customer_commitment', label: 'Customer commitment' }
      ],
      deadline: [
        { value: 'more_complex', label: 'More complex than estimated' },
        { value: 'team_slower', label: 'Team is slower on this type of work' },
        { value: 'external_dependency', label: 'External dependency' },
        { value: 'quality_buffer', label: 'Quality buffer needed' }
      ],
      followup: [
        { value: 'needs_followup', label: 'Does need follow-up' },
        { value: 'no_followup_needed', label: 'No follow-up needed' },
        { value: 'different_timing', label: 'Different timing needed' },
        { value: 'different_assignee', label: 'Different assignee needed' }
      ]
    };

    return options[agentType] || [];
  };

  const handleSkip = async () => {
    // Save "don't ask again" preference if checked
    if (dontAskAgain) {
      try {
        await api.learning.setFeedbackPreference(agentType, false);
      } catch (error) {
        console.error('Failed to save preference:', error);
      }
    }

    // Still capture the override without feedback
    try {
      await api.learning.captureOverride({
        agentType,
        agentExecutionId,
        originalRecommendation,
        userChoice,
        feedbackReason: null,
        feedbackText: null,
        context
      });
    } catch (error) {
      console.error('Failed to capture override:', error);
    }

    if (onClose) onClose();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Determine final feedback text
      let finalFeedbackText = feedbackText;
      if (feedbackReason === 'other' && otherText.trim()) {
        finalFeedbackText = otherText.trim();
      }

      // Save "don't ask again" preference if checked
      if (dontAskAgain) {
        await api.learning.setFeedbackPreference(agentType, false);
      }

      // Capture override with feedback
      await api.learning.captureOverride({
        agentType,
        agentExecutionId,
        originalRecommendation,
        userChoice,
        feedbackReason: feedbackReason === 'other' ? null : feedbackReason,
        feedbackText: finalFeedbackText || null,
        context
      });

      if (onSubmit) onSubmit();
      if (onClose) onClose();
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast.error('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAgentDisplayName = () => {
    const names = {
      assignment: 'Assignment Agent',
      priority: 'Priority Agent',
      deadline: 'Deadline Agent',
      followup: 'Follow-up Agent'
    };
    return names[agentType] || 'AI Agent';
  };

  const getChangeDescription = () => {
    if (!originalRecommendation || !userChoice) return '';

    switch (agentType) {
      case 'assignment':
        return `You assigned this to ${userChoice.name} instead of ${originalRecommendation.name}.`;
      case 'priority':
        return `You changed priority from ${originalRecommendation.value} to ${userChoice.value}.`;
      case 'deadline':
        return `You changed deadline from ${originalRecommendation.date} to ${userChoice.date}.`;
      default:
        return 'You made changes to the AI recommendation.';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-lg shadow-xl max-w-md w-full p-6 relative">
        {/* Auto-close indicator */}
        <div className="absolute top-2 right-2 text-xs text-content-tertiary">
          Auto-closes in {autoCloseTimer}s
        </div>

        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🤔</span>
            <h3 className="text-lg font-semibold text-content-primary">
              Help the AI Learn
            </h3>
          </div>
          <p className="text-sm text-content-secondary">
            {getChangeDescription()}
          </p>
        </div>

        {/* Feedback Options */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-content-secondary mb-2">
            Reason (optional):
          </label>
          <div className="space-y-2">
            {getFeedbackOptions().map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 cursor-pointer hover:bg-surface-muted p-2 rounded"
              >
                <input
                  type="radio"
                  name="feedbackReason"
                  value={option.value}
                  checked={feedbackReason === option.value}
                  onChange={(e) => {
                    setFeedbackReason(e.target.value);
                    setFeedbackText(option.label);
                  }}
                  className="text-accent-primary"
                />
                <span className="text-sm text-content-secondary">{option.label}</span>
              </label>
            ))}

            {/* Other option with text input */}
            <label className="flex items-start gap-2 cursor-pointer hover:bg-surface-muted p-2 rounded">
              <input
                type="radio"
                name="feedbackReason"
                value="other"
                checked={feedbackReason === 'other'}
                onChange={(e) => {
                  setFeedbackReason(e.target.value);
                  setFeedbackText('');
                }}
                className="mt-1 text-accent-primary"
              />
              <div className="flex-1">
                <span className="text-sm text-content-secondary block mb-1">Other:</span>
                {feedbackReason === 'other' && (
                  <input
                    type="text"
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    placeholder="Enter your reason..."
                    className="w-full px-3 py-2 border border-line-strong rounded-md text-sm"
                    autoFocus
                  />
                )}
              </div>
            </label>
          </div>
        </div>

        {/* Don't ask again checkbox */}
        <div className="mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dontAskAgain}
              onChange={(e) => setDontAskAgain(e.target.checked)}
              className="rounded text-accent-primary"
            />
            <span className="text-sm text-content-secondary">
              Don't ask me again for {getAgentDisplayName()}
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSkip}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-surface-muted text-content-secondary rounded-md hover:bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || (feedbackReason === 'other' && !otherText.trim())}
            className="vbtn vbtn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>

        {/* Info text */}
        <p className="mt-4 text-xs text-content-tertiary text-center">
          Your feedback helps the AI learn your preferences and improve recommendations over time.
        </p>
      </div>
    </div>
  );
}
