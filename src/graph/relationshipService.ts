/**
 * Relationship Service for Knowledge Graph
 * Manages entity relationships (meeting → deal, task → project, etc.)
 */

import { supabase } from '../lib/supabase';
import { formatEntityId } from './idFormat';

// Relationship types used in Phase 2
export type RelationshipType =
  | 'meeting_mentions_deal'
  | 'meeting_created_action_item'
  | 'action_item_created_task'
  | 'deal_created_project'
  | 'deal_has_contact'
  | 'pulse_message_mentions_deal'
  | 'task_belongs_to_project'
  | 'meeting_related_to_project';

export interface Relationship {
  id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  relationship_type: string;
  confidence: number;
  evidence: Record<string, any>;
  source_system: string;
  created_by: string | null;
  rule_version: string;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertRelationshipParams {
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  relationshipType: RelationshipType | string;
  confidence?: number;
  evidence?: Record<string, any>;
  sourceSystem?: string;
  createdBy?: string | null;
}

export interface GraphNode {
  type: string;
  id: string;
}

export interface GraphBundle {
  center: GraphNode;
  nodes: GraphNode[];
  edges: Relationship[];
}

/**
 * Create or update a relationship between two entities
 * Uses upsert to prevent duplicates (based on unique constraint)
 */
export async function upsertRelationship({
  sourceType,
  sourceId,
  targetType,
  targetId,
  relationshipType,
  confidence = 1.0,
  evidence = {},
  sourceSystem = 'entomate',
  createdBy = null
}: UpsertRelationshipParams): Promise<Relationship> {
  const sType = String(sourceType).trim();
  const tType = String(targetType).trim();
  const relType = String(relationshipType).trim();

  // Format IDs with prefixes
  const sId = formatEntityId(sType, sourceId);
  const tId = formatEntityId(tType, targetId);

  const { data, error } = await supabase
    .from('relationships')
    .upsert(
      {
        source_type: sType,
        source_id: sId,
        target_type: tType,
        target_id: tId,
        relationship_type: relType,
        confidence,
        evidence,
        source_system: sourceSystem,
        created_by: createdBy
      },
      {
        onConflict: 'source_type,source_id,target_type,target_id,relationship_type',
        ignoreDuplicates: false
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert relationship: ${error.message}`);
  }

  return data;
}

/**
 * Get all relationships for an entity (both outgoing and incoming)
 * By default, excludes soft-deleted relationships
 */
export async function getLinksForEntity(
  entityType: string,
  entityId: string,
  options: { includeDeleted?: boolean } = {}
): Promise<{
  entity: GraphNode;
  outgoing: Relationship[];
  incoming: Relationship[];
}> {
  const { includeDeleted = false } = options;
  const type = String(entityType).trim();
  const id = formatEntityId(type, entityId);

  // Get outgoing links (this entity is the source)
  let outgoingQuery = supabase
    .from('relationships')
    .select('*')
    .eq('source_type', type)
    .eq('source_id', id)
    .order('created_at', { ascending: false });

  if (!includeDeleted) {
    outgoingQuery = outgoingQuery.eq('is_deleted', false);
  }

  const { data: outgoing, error: outError } = await outgoingQuery;

  if (outError) {
    throw new Error(`Failed to fetch outgoing relationships: ${outError.message}`);
  }

  // Get incoming links (this entity is the target)
  let incomingQuery = supabase
    .from('relationships')
    .select('*')
    .eq('target_type', type)
    .eq('target_id', id)
    .order('created_at', { ascending: false });

  if (!includeDeleted) {
    incomingQuery = incomingQuery.eq('is_deleted', false);
  }

  const { data: incoming, error: inError } = await incomingQuery;

  if (inError) {
    throw new Error(`Failed to fetch incoming relationships: ${inError.message}`);
  }

  return {
    entity: { type, id },
    outgoing: outgoing || [],
    incoming: incoming || []
  };
}

/**
 * Get a graph bundle for visualization (center node + all connected nodes)
 */
export async function getGraphBundle(
  entityType: string,
  entityId: string
): Promise<GraphBundle> {
  const { entity, outgoing, incoming } = await getLinksForEntity(entityType, entityId);
  const edges = [...outgoing, ...incoming];

  // Build unique nodes map
  const nodesMap = new Map<string, GraphNode>();
  nodesMap.set(`${entity.type}:${entity.id}`, { type: entity.type, id: entity.id });

  for (const e of edges) {
    nodesMap.set(`${e.source_type}:${e.source_id}`, {
      type: e.source_type,
      id: e.source_id
    });
    nodesMap.set(`${e.target_type}:${e.target_id}`, {
      type: e.target_type,
      id: e.target_id
    });
  }

  return {
    center: entity,
    nodes: Array.from(nodesMap.values()),
    edges
  };
}

/**
 * Delete all relationships for a deleted entity
 * Call this when an entity is deleted to clean up the graph
 */
export async function deleteRelationshipsForEntity(
  entityType: string,
  entityId: string
): Promise<number> {
  const type = String(entityType).trim();
  const id = formatEntityId(type, entityId);

  // Delete where entity is source
  const { error: sourceError, count: sourceCount } = await supabase
    .from('relationships')
    .delete({ count: 'exact' })
    .eq('source_type', type)
    .eq('source_id', id);

  if (sourceError) {
    throw new Error(`Failed to delete source relationships: ${sourceError.message}`);
  }

  // Delete where entity is target
  const { error: targetError, count: targetCount } = await supabase
    .from('relationships')
    .delete({ count: 'exact' })
    .eq('target_type', type)
    .eq('target_id', id);

  if (targetError) {
    throw new Error(`Failed to delete target relationships: ${targetError.message}`);
  }

  return (sourceCount || 0) + (targetCount || 0);
}

/**
 * Get relationships by type
 */
export async function getRelationshipsByType(
  relationshipType: RelationshipType | string,
  limit = 100,
  options: { includeDeleted?: boolean } = {}
): Promise<Relationship[]> {
  const { includeDeleted = false } = options;

  let query = supabase
    .from('relationships')
    .select('*')
    .eq('relationship_type', relationshipType)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!includeDeleted) {
    query = query.eq('is_deleted', false);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch relationships by type: ${error.message}`);
  }

  return data || [];
}

// ============================================
// Soft Delete Functions
// ============================================

/**
 * Soft delete a relationship (hide without losing history)
 */
export async function softDeleteRelationship(
  relationshipId: string,
  deletedBy: string = 'system'
): Promise<boolean> {
  const { error, count } = await supabase
    .from('relationships')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: deletedBy
    })
    .eq('id', relationshipId)
    .eq('is_deleted', false);

  if (error) {
    throw new Error(`Failed to soft delete relationship: ${error.message}`);
  }

  return (count || 0) > 0;
}

/**
 * Restore a soft-deleted relationship
 */
export async function restoreRelationship(relationshipId: string): Promise<boolean> {
  const { error, count } = await supabase
    .from('relationships')
    .update({
      is_deleted: false,
      deleted_at: null,
      deleted_by: null
    })
    .eq('id', relationshipId)
    .eq('is_deleted', true);

  if (error) {
    throw new Error(`Failed to restore relationship: ${error.message}`);
  }

  return (count || 0) > 0;
}

/**
 * Soft delete all relationships for an entity
 * Use this instead of hard delete to preserve history
 */
export async function softDeleteRelationshipsForEntity(
  entityType: string,
  entityId: string,
  deletedBy: string = 'system'
): Promise<number> {
  const type = String(entityType).trim();
  const id = formatEntityId(type, entityId);

  // Soft delete where entity is source
  const { error: sourceError, count: sourceCount } = await supabase
    .from('relationships')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: deletedBy
    })
    .eq('source_type', type)
    .eq('source_id', id)
    .eq('is_deleted', false);

  if (sourceError) {
    throw new Error(`Failed to soft delete source relationships: ${sourceError.message}`);
  }

  // Soft delete where entity is target
  const { error: targetError, count: targetCount } = await supabase
    .from('relationships')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: deletedBy
    })
    .eq('target_type', type)
    .eq('target_id', id)
    .eq('is_deleted', false);

  if (targetError) {
    throw new Error(`Failed to soft delete target relationships: ${targetError.message}`);
  }

  return (sourceCount || 0) + (targetCount || 0);
}

/**
 * Get relationship audit events
 */
export async function getRelationshipEvents(
  relationshipId: string,
  limit = 50
): Promise<Array<{
  id: string;
  relationship_id: string;
  event_type: string;
  actor: string | null;
  event_payload: Record<string, any>;
  created_at: string;
}>> {
  const { data, error } = await supabase
    .from('relationship_events')
    .select('*')
    .eq('relationship_id', relationshipId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch relationship events: ${error.message}`);
  }

  return data || [];
}
