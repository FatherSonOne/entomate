/**
 * ProfileSelector
 * Grid of profile cards for selecting an intelligence profile.
 */

import React from 'react';
import type { IntelligenceProfile, ProfileSuggestion } from '../../intelligence/types';

interface ProfileSelectorProps {
  profiles: IntelligenceProfile[];
  selectedProfileId?: string | null;
  suggestions?: ProfileSuggestion[];
  onSelect: (profile: IntelligenceProfile) => void;
}

export const ProfileSelector: React.FC<ProfileSelectorProps> = ({
  profiles,
  selectedProfileId,
  suggestions = [],
  onSelect,
}) => {
  const suggestionMap = new Map(suggestions.map(s => [s.profile.id, s]));

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
        Choose a profile
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {profiles.map(profile => {
          const isSelected = profile.id === selectedProfileId;
          const suggestion = suggestionMap.get(profile.id);
          const isSuggested = !!suggestion;

          return (
            <button
              key={profile.id}
              onClick={() => onSelect(profile)}
              className="relative flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all duration-200 hover:scale-[1.02]"
              style={{
                background: isSelected ? 'var(--accent-primary-dim, rgba(255,45,107,0.12))' : 'var(--bg-surface, #fff)',
                borderColor: isSelected
                  ? 'var(--accent-primary, #FF2D6B)'
                  : isSuggested
                    ? 'var(--accent-tertiary, #FFB800)'
                    : 'var(--border-subtle, rgba(0,0,0,0.06))',
                boxShadow: isSelected
                  ? '0 0 16px var(--accent-primary-glow, rgba(255,45,107,0.32))'
                  : isSuggested
                    ? '0 0 12px var(--accent-tertiary-dim, rgba(255,184,0,0.12))'
                    : undefined,
              }}
            >
              {isSuggested && (
                <span
                  className="absolute -top-1.5 -right-1.5 font-mono text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{
                    background: 'var(--accent-tertiary, #FFB800)',
                    color: '#000',
                  }}
                >
                  {Math.round(suggestion!.confidence * 100)}%
                </span>
              )}
              <span className="text-2xl">{profile.icon}</span>
              <span className="text-sm font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>
                {profile.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
