/**
 * LinkedRecordsPanel Component
 * Displays Knowledge Graph relationships for an entity
 * Phase 2 Week 5 - Knowledge Graph MVP
 */

import React, { useState } from 'react';
import {
  useLinkedRecords,
  getEntityTypeLabel,
  getRelationshipLabel,
  getEntityUrl,
  LinkedRecord
} from '../hooks/useLinkedRecords';

interface LinkedRecordsPanelProps {
  entityType: string;
  entityId: string;
  title?: string;
  compact?: boolean;
  onNavigate?: (url: string) => void;
}

/**
 * Panel showing linked records for an entity
 */
export function LinkedRecordsPanel({
  entityType,
  entityId,
  title = 'Linked Records',
  compact = false,
  onNavigate
}: LinkedRecordsPanelProps) {
  const { linkedRecords, loading, error, counts, refresh } = useLinkedRecords(entityType, entityId);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Group records by type
  const groupedRecords = React.useMemo(() => {
    const groups: Record<string, LinkedRecord[]> = {};
    for (const record of linkedRecords) {
      const type = record.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(record);
    }
    return groups;
  }, [linkedRecords]);

  const handleNavigate = (record: LinkedRecord) => {
    const url = getEntityUrl(record.type, record.id);
    if (onNavigate) {
      onNavigate(url);
    } else {
      // Default: open in new tab or navigate
      window.location.href = url;
    }
  };

  const toggleSection = (type: string) => {
    setExpandedSection(expandedSection === type ? null : type);
  };

  // Loading state
  if (loading) {
    return (
      <div style={styles.panel}>
        <div style={styles.header}>
          <h3 style={styles.title}>{title}</h3>
        </div>
        <div style={styles.loading}>
          <span style={styles.spinner}>...</span>
          Loading relationships...
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={styles.panel}>
        <div style={styles.header}>
          <h3 style={styles.title}>{title}</h3>
        </div>
        <div style={styles.error}>
          {error}
          <button onClick={refresh} style={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (linkedRecords.length === 0) {
    return (
      <div style={styles.panel}>
        <div style={styles.header}>
          <h3 style={styles.title}>{title}</h3>
        </div>
        <div style={styles.empty}>
          No linked records found
        </div>
      </div>
    );
  }

  // Compact view
  if (compact) {
    return (
      <div style={styles.panelCompact}>
        <div style={styles.headerCompact}>
          <span style={styles.titleCompact}>{title}</span>
          <span style={styles.badge}>{linkedRecords.length}</span>
        </div>
        <div style={styles.countsRow}>
          {counts.meetings > 0 && (
            <span style={styles.countBadge} title="Meetings">
              📅 {counts.meetings}
            </span>
          )}
          {counts.tasks > 0 && (
            <span style={styles.countBadge} title="Tasks">
              ✓ {counts.tasks}
            </span>
          )}
          {counts.projects > 0 && (
            <span style={styles.countBadge} title="Projects">
              📁 {counts.projects}
            </span>
          )}
          {counts.deals > 0 && (
            <span style={styles.countBadge} title="Deals">
              💰 {counts.deals}
            </span>
          )}
          {counts.contacts > 0 && (
            <span style={styles.countBadge} title="Contacts">
              👤 {counts.contacts}
            </span>
          )}
          {counts.actionItems > 0 && (
            <span style={styles.countBadge} title="Action Items">
              📋 {counts.actionItems}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Full view
  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <h3 style={styles.title}>{title}</h3>
        <span style={styles.badge}>{linkedRecords.length} links</span>
      </div>

      {/* Summary counts */}
      <div style={styles.summary}>
        {counts.meetings > 0 && (
          <div style={styles.summaryItem}>
            <span style={styles.summaryIcon}>📅</span>
            <span>{counts.meetings} Meeting{counts.meetings !== 1 ? 's' : ''}</span>
          </div>
        )}
        {counts.tasks > 0 && (
          <div style={styles.summaryItem}>
            <span style={styles.summaryIcon}>✓</span>
            <span>{counts.tasks} Task{counts.tasks !== 1 ? 's' : ''}</span>
          </div>
        )}
        {counts.projects > 0 && (
          <div style={styles.summaryItem}>
            <span style={styles.summaryIcon}>📁</span>
            <span>{counts.projects} Project{counts.projects !== 1 ? 's' : ''}</span>
          </div>
        )}
        {counts.deals > 0 && (
          <div style={styles.summaryItem}>
            <span style={styles.summaryIcon}>💰</span>
            <span>{counts.deals} Deal{counts.deals !== 1 ? 's' : ''}</span>
          </div>
        )}
        {counts.contacts > 0 && (
          <div style={styles.summaryItem}>
            <span style={styles.summaryIcon}>👤</span>
            <span>{counts.contacts} Contact{counts.contacts !== 1 ? 's' : ''}</span>
          </div>
        )}
        {counts.pulseMessages > 0 && (
          <div style={styles.summaryItem}>
            <span style={styles.summaryIcon}>💬</span>
            <span>{counts.pulseMessages} Pulse Message{counts.pulseMessages !== 1 ? 's' : ''}</span>
          </div>
        )}
        {counts.actionItems > 0 && (
          <div style={styles.summaryItem}>
            <span style={styles.summaryIcon}>📋</span>
            <span>{counts.actionItems} Action Item{counts.actionItems !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Grouped records */}
      <div style={styles.groups}>
        {Object.entries(groupedRecords).map(([type, records]) => (
          <div key={type} style={styles.group}>
            <button
              style={styles.groupHeader}
              onClick={() => toggleSection(type)}
            >
              <span style={styles.groupTitle}>
                {getEntityTypeLabel(type)}
                <span style={styles.groupCount}>({records.length})</span>
              </span>
              <span style={styles.expandIcon}>
                {expandedSection === type ? '▼' : '▶'}
              </span>
            </button>

            {expandedSection === type && (
              <div style={styles.groupContent}>
                {records.map((record, idx) => (
                  <div
                    key={`${record.id}-${idx}`}
                    style={styles.recordItem}
                    onClick={() => handleNavigate(record)}
                  >
                    <div style={styles.recordMain}>
                      <span style={styles.recordId}>
                        {record.id.includes(':') ? record.id.split(':')[1].substring(0, 8) : record.id.substring(0, 8)}...
                      </span>
                      <span style={styles.relationshipLabel}>
                        {getRelationshipLabel(record.relationshipType)}
                      </span>
                    </div>
                    <div style={styles.recordMeta}>
                      <span style={styles.direction}>
                        {record.direction === 'outgoing' ? '→' : '←'}
                      </span>
                      {record.confidence < 1 && (
                        <span style={styles.confidence}>
                          {Math.round(record.confidence * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Inline styles (can be moved to CSS modules if preferred)
const styles: Record<string, React.CSSProperties> = {
  panel: {
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
  },
  panelCompact: {
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    padding: '12px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    paddingBottom: '12px',
    borderBottom: '1px solid #e5e7eb',
  },
  headerCompact: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: '#1f2937',
  },
  titleCompact: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#4b5563',
  },
  badge: {
    backgroundColor: '#e5e7eb',
    color: '#4b5563',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    color: '#6b7280',
  },
  spinner: {
    marginRight: '8px',
    animation: 'spin 1s linear infinite',
  },
  error: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px',
    color: '#dc2626',
    fontSize: '14px',
  },
  retryButton: {
    marginTop: '8px',
    padding: '6px 12px',
    backgroundColor: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  empty: {
    padding: '24px',
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: '14px',
  },
  countsRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  countBadge: {
    fontSize: '12px',
    color: '#6b7280',
    cursor: 'default',
  },
  summary: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '16px',
  },
  summaryItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '13px',
    color: '#4b5563',
  },
  summaryIcon: {
    fontSize: '14px',
  },
  groups: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  group: {
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  groupHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: '10px 12px',
    backgroundColor: '#f9fafb',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
  },
  groupTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151',
  },
  groupCount: {
    marginLeft: '6px',
    color: '#6b7280',
    fontWeight: 400,
  },
  expandIcon: {
    fontSize: '10px',
    color: '#9ca3af',
  },
  groupContent: {
    padding: '8px',
    backgroundColor: '#fff',
  },
  recordItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 10px',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  recordMain: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  recordId: {
    fontSize: '13px',
    fontFamily: 'monospace',
    color: '#1f2937',
  },
  relationshipLabel: {
    fontSize: '11px',
    color: '#6b7280',
  },
  recordMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  direction: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  confidence: {
    fontSize: '11px',
    color: '#9ca3af',
    backgroundColor: '#f3f4f6',
    padding: '1px 6px',
    borderRadius: '10px',
  },
};

export default LinkedRecordsPanel;
