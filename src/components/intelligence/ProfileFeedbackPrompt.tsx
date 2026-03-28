/**
 * ProfileFeedbackPrompt
 * Post-meeting inline prompt for rating the intelligence profile's helpfulness.
 */

import React, { useState } from 'react';

interface ProfileFeedbackPromptProps {
  meetingId: string;
  profileName: string;
  profileIcon: string;
  onSubmit: (rating: number, feedback?: string) => void;
  onDismiss: () => void;
}

export const ProfileFeedbackPrompt: React.FC<ProfileFeedbackPromptProps> = ({
  profileName,
  profileIcon,
  onSubmit,
  onDismiss,
}) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  const handleRate = (star: number) => {
    setRating(star);
    setShowFeedback(true);
  };

  const handleSubmit = () => {
    if (rating > 0) {
      onSubmit(rating, feedback || undefined);
    }
  };

  return (
    <div
      className="rounded-xl border p-4 transition-all duration-300"
      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
          How helpful was the <span className="font-medium">{profileIcon} {profileName}</span> profile?
        </p>
        <button onClick={onDismiss} className="text-sm ml-2 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
          &times;
        </button>
      </div>

      <div className="flex gap-1 mt-3">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onClick={() => handleRate(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="text-2xl transition-transform hover:scale-110"
            style={{
              color: star <= (hoverRating || rating)
                ? 'var(--accent-tertiary, #FFB800)'
                : 'var(--border-subtle)',
            }}
          >
            ★
          </button>
        ))}
      </div>

      {showFeedback && (
        <div className="mt-3 space-y-2">
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            placeholder="Any specific feedback? (optional)"
            rows={2}
            className="w-full px-3 py-2 rounded-lg border text-sm resize-y"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
          />
          <button
            onClick={handleSubmit}
            className="px-4 py-1.5 rounded-lg text-sm font-medium text-white"
            style={{ background: 'var(--accent-primary)' }}
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
};
