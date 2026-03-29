/**
 * ContextPreview
 * Displays assembled cross-app context in a readable, collapsible format.
 */

import React, { useState } from 'react';
import type { AssembledContext } from '../../intelligence/types';

interface ContextPreviewProps {
  context: AssembledContext | null;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const ContextPreview: React.FC<ContextPreviewProps> = ({
  context,
  isLoading = false,
  onRefresh,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          Assembling Context...
        </p>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--bg-elevated)' }} />
        ))}
      </div>
    );
  }

  if (!context) {
    return (
      <div className="rounded-xl p-4 text-center" style={{ background: 'var(--bg-elevated)' }}>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Context will be assembled when you save the profile configuration.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          Assembled Context
        </p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-xs px-2 py-1 rounded-lg border transition-all hover:opacity-80"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            Refresh
          </button>
        )}
      </div>

      {/* Source badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        {context.participants.length > 0 && (
          <SourceBadge icon="👤" label={`${context.participants.length} contacts`} />
        )}
        {context.pastMeetings && context.pastMeetings.length > 0 && (
          <SourceBadge icon="📅" label={`${context.pastMeetings.length} past meetings`} />
        )}
        {context.recentConversations && context.recentConversations.length > 0 && (
          <SourceBadge icon="📧" label={`${context.recentConversations.length} threads`} />
        )}
        {context.openTasks && context.openTasks.length > 0 && (
          <SourceBadge icon="✅" label={`${context.openTasks.length} open tasks`} />
        )}
        {context.relatedDeals && context.relatedDeals.length > 0 && (
          <SourceBadge icon="💼" label={`${context.relatedDeals.length} deals`} />
        )}
      </div>

      {/* Token budget */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(100, (context.tokenEstimate / 4000) * 100)}%`,
              background: context.tokenEstimate > 3500
                ? 'var(--accent-tertiary, #FFB800)'
                : 'var(--accent-secondary, #00F5D4)',
            }}
          />
        </div>
        <span className="font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>
          ~{context.tokenEstimate.toLocaleString()} / 4,000 tokens
        </span>
      </div>

      {/* Collapsible sections */}
      <div className="space-y-2">
        {context.participants.length > 0 && (
          <CollapsibleSection title="Participants" defaultOpen>
            <div className="space-y-2">
              {context.participants.map((p, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                  {p.role && <span style={{ color: 'var(--text-secondary)' }}> ({p.role})</span>}
                  {p.organization && <span style={{ color: 'var(--text-secondary)' }}> at {p.organization}</span>}
                  {p.meetingCount ? (
                    <span className="font-mono text-xs ml-2" style={{ color: 'var(--text-tertiary)' }}>
                      {p.meetingCount} meetings
                    </span>
                  ) : null}
                  {p.notes && (
                    <p className="text-xs mt-0.5 pl-3 border-l-2" style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border-subtle)' }}>
                      {p.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {context.organization && (
          <CollapsibleSection title="Organization">
            <div className="text-sm space-y-1">
              <p style={{ color: 'var(--text-primary)' }}>{context.organization.name}</p>
              {context.organization.activeDeals !== undefined && (
                <p style={{ color: 'var(--text-secondary)' }}>{context.organization.activeDeals} active deals</p>
              )}
              {context.organization.totalMeetings !== undefined && (
                <p style={{ color: 'var(--text-secondary)' }}>{context.organization.totalMeetings} total meetings</p>
              )}
            </div>
          </CollapsibleSection>
        )}

        {context.pastMeetings && context.pastMeetings.length > 0 && (
          <CollapsibleSection title="Past Meetings">
            <div className="space-y-2">
              {context.pastMeetings.map((m, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{m.title}</span>
                  <span className="font-mono text-xs ml-2" style={{ color: 'var(--text-tertiary)' }}>
                    {new Date(m.date).toLocaleDateString()}
                  </span>
                  {m.summary && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {m.summary.slice(0, 150)}{m.summary.length > 150 ? '...' : ''}
                    </p>
                  )}
                  {m.openActionItems && m.openActionItems.length > 0 && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--accent-tertiary)' }}>
                      {m.openActionItems.length} open items
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {context.openTasks && context.openTasks.length > 0 && (
          <CollapsibleSection title="Open Tasks">
            <div className="space-y-1.5">
              {context.openTasks.map((t, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <PriorityDot priority={t.priority} />
                  <div className="min-w-0">
                    <span style={{ color: 'var(--text-primary)' }}>{t.title}</span>
                    {t.assignee && <span style={{ color: 'var(--text-tertiary)' }}> — {t.assignee}</span>}
                    {t.dueDate && (
                      <span className="font-mono text-xs ml-1" style={{ color: 'var(--text-tertiary)' }}>
                        due {new Date(t.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {context.recentConversations && context.recentConversations.length > 0 && (
          <CollapsibleSection title="Recent Conversations">
            <div className="space-y-1.5">
              {context.recentConversations.map((c, i) => (
                <div key={i} className="text-sm">
                  <span style={{ color: 'var(--text-primary)' }}>{c.messageCount} messages</span>
                  <span className="font-mono text-xs ml-2" style={{ color: 'var(--text-tertiary)' }}>
                    last {new Date(c.lastActivity).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
};

// ==================== SUB-COMPONENTS ====================

const SourceBadge: React.FC<{ icon: string; label: string }> = ({ icon, label }) => (
  <span
    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs"
    style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
  >
    {icon} {label}
  </span>
);

const CollapsibleSection: React.FC<{
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border" style={{ borderColor: 'var(--border-subtle)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <span className="font-mono text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          {title}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3">
          {children}
        </div>
      )}
    </div>
  );
};

const PriorityDot: React.FC<{ priority: string }> = ({ priority }) => {
  const color = priority === 'high'
    ? 'var(--semantic-error, #ef4444)'
    : priority === 'medium'
      ? 'var(--accent-tertiary, #FFB800)'
      : 'var(--semantic-success, #10b981)';

  return (
    <span
      className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
      style={{ background: color }}
    />
  );
};
