/**
 * SuggestionBanner
 * Displays an auto-suggested intelligence profile with accept/customize/dismiss actions.
 */

import React from 'react';
import type { ProfileSuggestion } from '../../intelligence/types';

interface SuggestionBannerProps {
  suggestion: ProfileSuggestion;
  onAccept: () => void;
  onCustomize: () => void;
  onDismiss: () => void;
}

export const SuggestionBanner: React.FC<SuggestionBannerProps> = ({
  suggestion,
  onAccept,
  onCustomize,
  onDismiss,
}) => {
  const confidencePercent = Math.round(suggestion.confidence * 100);
  const isHighConfidence = confidencePercent >= 80;

  return (
    <div
      className="relative rounded-xl p-4 border transition-all duration-300 animate-in fade-in slide-in-from-top-2"
      style={{
        background: 'var(--bg-elevated, #FFF0F4)',
        borderColor: isHighConfidence ? 'var(--accent-primary, #FF2D6B)' : 'var(--border-subtle, rgba(0,0,0,0.06))',
        boxShadow: isHighConfidence ? '0 0 20px var(--accent-primary-glow, rgba(255,45,107,0.32))' : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-2xl flex-shrink-0">{suggestion.profile.icon}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {suggestion.profile.name}
              </span>
              <span
                className="font-mono text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: isHighConfidence ? 'var(--accent-primary-dim, rgba(255,45,107,0.12))' : 'var(--accent-tertiary-dim, rgba(255,184,0,0.12))',
                  color: isHighConfidence ? 'var(--accent-primary, #FF2D6B)' : 'var(--accent-tertiary, #FFB800)',
                }}
              >
                {confidencePercent}% match
              </span>
            </div>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {suggestion.reason}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={onAccept}
          className="px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-all duration-200 hover:opacity-90"
          style={{ background: 'var(--accent-primary, #FF2D6B)' }}
        >
          Accept
        </button>
        <button
          onClick={onCustomize}
          className="px-4 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 hover:opacity-80"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
        >
          Customize
        </button>
        <button
          onClick={onDismiss}
          className="px-3 py-1.5 rounded-lg text-sm transition-all duration-200 hover:opacity-80"
          style={{ color: 'var(--text-tertiary)' }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};
