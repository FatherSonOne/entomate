import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Send } from 'lucide-react';

/**
 * ExplanationFeedback - Collects user feedback on explanation quality
 *
 * Props:
 * - executionId: ID of the agent execution
 * - onFeedbackSubmitted: Callback when feedback is submitted
 */
export default function ExplanationFeedback({ executionId, onFeedbackSubmitted }) {
  const [rating, setRating] = useState(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!rating) return;

    setIsSubmitting(true);

    try {
      // Store feedback in database
      const response = await fetch(`/api/agents/executions/${executionId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: rating === 'positive' ? 5 : 1,
          notes: comment
        })
      });

      if (response.ok) {
        setSubmitted(true);
        if (onFeedbackSubmitted) {
          onFeedbackSubmitted({ rating, comment });
        }
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="explanation-feedback submitted">
        <div className="feedback-success">
          ✓ Thank you for your feedback!
        </div>
      </div>
    );
  }

  return (
    <div className="explanation-feedback">
      <div className="feedback-header">
        <h5>Was this explanation helpful?</h5>
      </div>

      <div className="feedback-buttons">
        <button
          onClick={() => setRating('positive')}
          className={`feedback-btn ${rating === 'positive' ? 'active positive' : ''}`}
          title="Helpful explanation"
        >
          <ThumbsUp size={18} />
          <span>Helpful</span>
        </button>

        <button
          onClick={() => setRating('negative')}
          className={`feedback-btn ${rating === 'negative' ? 'active negative' : ''}`}
          title="Not helpful"
        >
          <ThumbsDown size={18} />
          <span>Not Helpful</span>
        </button>
      </div>

      {rating && (
        <div className="feedback-details">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional: Tell us more (What was helpful? What could be better?)"
            className="feedback-textarea"
            rows="3"
          />

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="feedback-submit"
          >
            <Send size={14} />
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>
      )}
    </div>
  );
}
