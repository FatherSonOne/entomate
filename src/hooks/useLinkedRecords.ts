/**
 * useLinkedRecords Hook
 * React hook for fetching and displaying Knowledge Graph relationships
 */

import { useState, useEffect, useCallback } from 'react';
import { getLinksForEntity, getGraphBundle, Relationship, GraphBundle, GraphNode } from '../graph';

export interface LinkedRecord {
  id: string;
  type: string;
  relationshipType: string;
  direction: 'outgoing' | 'incoming';
  confidence: number;
  createdAt: string;
}

export interface UseLinkedRecordsReturn {
  // State
  linkedRecords: LinkedRecord[];
  graphBundle: GraphBundle | null;
  loading: boolean;
  error: string | null;

  // Counts by type
  counts: {
    meetings: number;
    tasks: number;
    projects: number;
    deals: number;
    contacts: number;
    pulseMessages: number;
    actionItems: number;
  };

  // Actions
  refresh: () => Promise<void>;
  loadGraph: () => Promise<void>;
}

/**
 * Hook to load linked records for an entity
 * @param entityType - Type of entity (meeting, task, project, deal, etc.)
 * @param entityId - ID of the entity
 */
export function useLinkedRecords(
  entityType: string | null,
  entityId: string | null
): UseLinkedRecordsReturn {
  const [linkedRecords, setLinkedRecords] = useState<LinkedRecord[]>([]);
  const [graphBundle, setGraphBundle] = useState<GraphBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState({
    meetings: 0,
    tasks: 0,
    projects: 0,
    deals: 0,
    contacts: 0,
    pulseMessages: 0,
    actionItems: 0
  });

  // Transform relationships to LinkedRecord format
  const transformRelationships = useCallback((
    outgoing: Relationship[],
    incoming: Relationship[]
  ): LinkedRecord[] => {
    const records: LinkedRecord[] = [];

    // Process outgoing relationships (this entity -> target)
    for (const rel of outgoing) {
      records.push({
        id: rel.target_id,
        type: rel.target_type,
        relationshipType: rel.relationship_type,
        direction: 'outgoing',
        confidence: rel.confidence,
        createdAt: rel.created_at
      });
    }

    // Process incoming relationships (source -> this entity)
    for (const rel of incoming) {
      records.push({
        id: rel.source_id,
        type: rel.source_type,
        relationshipType: rel.relationship_type,
        direction: 'incoming',
        confidence: rel.confidence,
        createdAt: rel.created_at
      });
    }

    return records;
  }, []);

  // Calculate counts by type
  const calculateCounts = useCallback((records: LinkedRecord[]) => {
    const newCounts = {
      meetings: 0,
      tasks: 0,
      projects: 0,
      deals: 0,
      contacts: 0,
      pulseMessages: 0,
      actionItems: 0
    };

    for (const record of records) {
      switch (record.type) {
        case 'meeting':
          newCounts.meetings++;
          break;
        case 'task':
          newCounts.tasks++;
          break;
        case 'project':
          newCounts.projects++;
          break;
        case 'deal':
        case 'crm_deal':
          newCounts.deals++;
          break;
        case 'contact':
        case 'crm_contact':
          newCounts.contacts++;
          break;
        case 'pulse_message':
          newCounts.pulseMessages++;
          break;
        case 'action_item':
          newCounts.actionItems++;
          break;
      }
    }

    return newCounts;
  }, []);

  // Load linked records
  const refresh = useCallback(async () => {
    if (!entityType || !entityId) {
      setLinkedRecords([]);
      setGraphBundle(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { outgoing, incoming } = await getLinksForEntity(entityType, entityId);
      const records = transformRelationships(outgoing, incoming);
      setLinkedRecords(records);
      setCounts(calculateCounts(records));
    } catch (err) {
      console.error('Error loading linked records:', err);
      setError(err instanceof Error ? err.message : 'Failed to load linked records');
      setLinkedRecords([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, transformRelationships, calculateCounts]);

  // Load full graph bundle (for visualization)
  const loadGraph = useCallback(async () => {
    if (!entityType || !entityId) {
      setGraphBundle(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const bundle = await getGraphBundle(entityType, entityId);
      setGraphBundle(bundle);
    } catch (err) {
      console.error('Error loading graph bundle:', err);
      setError(err instanceof Error ? err.message : 'Failed to load graph');
      setGraphBundle(null);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  // Load on mount and when entity changes
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    linkedRecords,
    graphBundle,
    loading,
    error,
    counts,
    refresh,
    loadGraph
  };
}

/**
 * Get display name for an entity type
 */
export function getEntityTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    meeting: 'Meeting',
    task: 'Task',
    project: 'Project',
    deal: 'Deal',
    crm_deal: 'Deal',
    contact: 'Contact',
    crm_contact: 'Contact',
    pulse_message: 'Pulse Message',
    pulse_channel: 'Pulse Channel',
    action_item: 'Action Item'
  };
  return labels[type] || type;
}

/**
 * Get display name for a relationship type
 */
export function getRelationshipLabel(type: string): string {
  const labels: Record<string, string> = {
    meeting_mentions_deal: 'Discussed in meeting',
    meeting_created_action_item: 'Created from meeting',
    action_item_created_task: 'Created task',
    deal_created_project: 'Created project',
    deal_has_contact: 'Has contact',
    pulse_message_mentions_deal: 'Mentioned in Pulse',
    task_belongs_to_project: 'Belongs to project',
    meeting_related_to_project: 'Related to project',
    task_from_meeting: 'From meeting',
    meeting_linked_to_channel: 'Linked to channel'
  };
  return labels[type] || type.replace(/_/g, ' ');
}

/**
 * Get icon name for an entity type
 */
export function getEntityTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    meeting: 'calendar',
    task: 'check-square',
    project: 'folder',
    deal: 'dollar-sign',
    crm_deal: 'dollar-sign',
    contact: 'user',
    crm_contact: 'user',
    pulse_message: 'message-circle',
    pulse_channel: 'hash',
    action_item: 'list'
  };
  return icons[type] || 'link';
}

/**
 * Get URL for navigating to an entity
 */
export function getEntityUrl(type: string, id: string): string {
  // Extract raw ID from prefixed format
  const rawId = id.includes(':') ? id.split(':')[1] : id;

  const routes: Record<string, string> = {
    meeting: `/meetings/${rawId}`,
    task: `/tasks/${rawId}`,
    project: `/projects/${rawId}`,
    deal: `/deals/${rawId}`,
    crm_deal: `/deals/${rawId}`,
    contact: `/contacts/${rawId}`,
    crm_contact: `/contacts/${rawId}`,
    pulse_message: `/pulse/messages/${rawId}`,
    pulse_channel: `/pulse/channels/${rawId}`,
    action_item: `/action-items/${rawId}`
  };

  return routes[type] || `/${type}/${rawId}`;
}

export default useLinkedRecords;
