/**
 * ProfileEffectivenessCard
 * Compact card showing effectiveness metrics for a single intelligence profile.
 */

import React from 'react';
import type { ProfileEffectiveness } from '../../intelligence/analyticsService';

interface ProfileEffectivenessCardProps {
  profileName: string;
  profileIcon: string;
  effectiveness: ProfileEffectiveness;
}

export const ProfileEffectivenessCard: React.FC<ProfileEffectivenessCardProps> = ({
  profileName,
  profileIcon,
  effectiveness,
}) => {
  const totalUses = effectiveness.timesAccepted + effectiveness.timesManuallySelected;

  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-center gap-2">
        <span className="text-xl">{profileIcon}</span>
        <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{profileName}</span>
        <span className="ml-auto font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {totalUses} uses
        </span>
      </div>

      <div className="space-y-2">
        <MetricBar
          label="Acceptance"
          value={effectiveness.acceptanceRate}
          format="percent"
        />
        <MetricBar
          label="Completion"
          value={effectiveness.completionRate}
          format="percent"
        />
        {effectiveness.avgOutputQuality != null && (
          <MetricBar
            label="Quality"
            value={effectiveness.avgOutputQuality}
            format="percent"
          />
        )}
      </div>

      {effectiveness.avgUserRating != null && (
        <div className="flex items-center gap-1">
          <span className="text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Rating</span>
          <div className="flex gap-0.5 ml-auto">
            {[1, 2, 3, 4, 5].map(star => (
              <span key={star} className="text-sm" style={{
                color: star <= Math.round(effectiveness.avgUserRating!) ? 'var(--accent-tertiary)' : 'var(--border-subtle)',
              }}>
                ★
              </span>
            ))}
          </div>
        </div>
      )}

      {effectiveness.lastUsedAt && (
        <p className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
          Last used {new Date(effectiveness.lastUsedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
};

const MetricBar: React.FC<{
  label: string;
  value: number;
  format: 'percent';
}> = ({ label, value }) => {
  const percent = Math.round(value * 100);
  const color = percent >= 70
    ? 'var(--accent-secondary, #00F5D4)'
    : percent >= 40
      ? 'var(--accent-tertiary, #FFB800)'
      : 'var(--semantic-error, #ef4444)';

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono uppercase tracking-wider w-20" style={{ color: 'var(--text-tertiary)' }}>
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${percent}%`, background: color }} />
      </div>
      <span className="text-xs font-mono w-10 text-right" style={{ color: 'var(--text-secondary)' }}>
        {percent}%
      </span>
    </div>
  );
};
