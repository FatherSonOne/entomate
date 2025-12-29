/**
 * Search Indexer Service
 * Indexes documents from various sources into the search_documents table
 * for vector similarity search
 */

import { supabase } from '../lib/supabase';
import { generateEmbedding, chunkText, prepareTextForEmbedding } from './embedder';
import type { SearchSourceType } from './types';

interface IndexResult {
  success: boolean;
  documentsIndexed: number;
  errors: string[];
}

/**
 * Index a single document
 */
export async function indexDocument(params: {
  sourceType: SearchSourceType;
  sourceId: string;
  title: string;
  content: string;
  metadata?: Record<string, any>;
}): Promise<boolean> {
  const { sourceType, sourceId, title, content, metadata = {} } = params;

  if (!content || content.trim().length === 0) {
    console.log(`[Indexer] Skipping ${sourceType}:${sourceId} - no content`);
    return false;
  }

  try {
    // Prepare text for embedding
    const cleanContent = prepareTextForEmbedding(content);

    // For long documents, we might chunk - for now, use first chunk if needed
    const chunks = chunkText(cleanContent, { maxTokens: 800 });
    const textToEmbed = chunks[0]; // Use first chunk for main embedding

    // Generate embedding
    const { embedding } = await generateEmbedding(textToEmbed);

    // Upsert into search_documents
    const { error } = await supabase
      .from('search_documents')
      .upsert({
        source_type: sourceType,
        source_id: sourceId,
        title,
        content: cleanContent.slice(0, 10000), // Limit stored content
        embedding,
        metadata,
        indexed_at: new Date().toISOString()
      }, {
        onConflict: 'source_type,source_id'
      });

    if (error) {
      console.error(`[Indexer] Failed to index ${sourceType}:${sourceId}:`, error);
      return false;
    }

    console.log(`[Indexer] Indexed ${sourceType}:${sourceId}`);
    return true;

  } catch (err) {
    console.error(`[Indexer] Error indexing ${sourceType}:${sourceId}:`, err);
    return false;
  }
}

/**
 * Index all meetings
 */
export async function indexMeetings(): Promise<IndexResult> {
  console.log('[Indexer] Starting meetings indexing...');

  const { data: meetings, error } = await supabase
    .from('entomate_meetings')
    .select('id, title, transcript, summary, key_points, decisions, created_at')
    .not('transcript', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error || !meetings) {
    console.error('[Indexer] Failed to fetch meetings:', error);
    return { success: false, documentsIndexed: 0, errors: [error?.message || 'Unknown error'] };
  }

  let indexed = 0;
  const errors: string[] = [];

  for (const meeting of meetings) {
    // Combine all meeting text for embedding
    const content = [
      meeting.title,
      meeting.summary,
      meeting.transcript,
      meeting.key_points?.join('\n'),
      meeting.decisions?.join('\n')
    ].filter(Boolean).join('\n\n');

    const success = await indexDocument({
      sourceType: 'meeting',
      sourceId: meeting.id,
      title: meeting.title || 'Untitled Meeting',
      content,
      metadata: {
        createdAt: meeting.created_at,
        hasSummary: !!meeting.summary,
        hasTranscript: !!meeting.transcript
      }
    });

    if (success) indexed++;
    else errors.push(`meeting:${meeting.id}`);

    // Rate limit - small delay between API calls
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`[Indexer] Meetings: indexed ${indexed}/${meetings.length}`);
  return { success: errors.length === 0, documentsIndexed: indexed, errors };
}

/**
 * Index all tasks
 */
export async function indexTasks(): Promise<IndexResult> {
  console.log('[Indexer] Starting tasks indexing...');

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, title, description, status, priority, due_date, project_id, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error || !tasks) {
    console.error('[Indexer] Failed to fetch tasks:', error);
    return { success: false, documentsIndexed: 0, errors: [error?.message || 'Unknown error'] };
  }

  let indexed = 0;
  const errors: string[] = [];

  for (const task of tasks) {
    const content = [
      task.title,
      task.description,
      `Status: ${task.status}`,
      `Priority: ${task.priority}`,
      task.due_date ? `Due: ${task.due_date}` : ''
    ].filter(Boolean).join('\n');

    const success = await indexDocument({
      sourceType: 'task',
      sourceId: task.id,
      title: task.title || 'Untitled Task',
      content,
      metadata: {
        status: task.status,
        priority: task.priority,
        dueDate: task.due_date,
        projectId: task.project_id,
        createdAt: task.created_at
      }
    });

    if (success) indexed++;
    else errors.push(`task:${task.id}`);

    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`[Indexer] Tasks: indexed ${indexed}/${tasks.length}`);
  return { success: errors.length === 0, documentsIndexed: indexed, errors };
}

/**
 * Index all projects
 */
export async function indexProjects(): Promise<IndexResult> {
  console.log('[Indexer] Starting projects indexing...');

  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, name, description, status, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error || !projects) {
    console.error('[Indexer] Failed to fetch projects:', error);
    return { success: false, documentsIndexed: 0, errors: [error?.message || 'Unknown error'] };
  }

  let indexed = 0;
  const errors: string[] = [];

  for (const project of projects) {
    const content = [
      project.name,
      project.description,
      `Status: ${project.status}`
    ].filter(Boolean).join('\n');

    const success = await indexDocument({
      sourceType: 'project',
      sourceId: project.id,
      title: project.name || 'Untitled Project',
      content,
      metadata: {
        status: project.status,
        createdAt: project.created_at
      }
    });

    if (success) indexed++;
    else errors.push(`project:${project.id}`);

    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`[Indexer] Projects: indexed ${indexed}/${projects.length}`);
  return { success: errors.length === 0, documentsIndexed: indexed, errors };
}

/**
 * Index CRM deals (from Logos Vision sync or local)
 */
export async function indexDeals(): Promise<IndexResult> {
  console.log('[Indexer] Starting deals indexing...');

  // Try to fetch from a deals table if it exists
  const { data: deals, error } = await supabase
    .from('deals')
    .select('id, name, description, stage, value, owner_name, customer_name, notes, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    // Table might not exist - that's okay
    console.log('[Indexer] Deals table not found or empty');
    return { success: true, documentsIndexed: 0, errors: [] };
  }

  if (!deals || deals.length === 0) {
    return { success: true, documentsIndexed: 0, errors: [] };
  }

  let indexed = 0;
  const errors: string[] = [];

  for (const deal of deals) {
    const content = [
      deal.name,
      deal.description,
      `Stage: ${deal.stage}`,
      deal.value ? `Value: $${deal.value}` : '',
      deal.owner_name ? `Owner: ${deal.owner_name}` : '',
      deal.customer_name ? `Customer: ${deal.customer_name}` : '',
      deal.notes
    ].filter(Boolean).join('\n');

    const success = await indexDocument({
      sourceType: 'crm_deal',
      sourceId: deal.id,
      title: deal.name || 'Untitled Deal',
      content,
      metadata: {
        stage: deal.stage,
        value: deal.value,
        ownerName: deal.owner_name,
        customerName: deal.customer_name,
        createdAt: deal.created_at
      }
    });

    if (success) indexed++;
    else errors.push(`crm_deal:${deal.id}`);

    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`[Indexer] Deals: indexed ${indexed}/${deals.length}`);
  return { success: errors.length === 0, documentsIndexed: indexed, errors };
}

/**
 * Index Pulse messages
 */
export async function indexPulseMessages(): Promise<IndexResult> {
  console.log('[Indexer] Starting Pulse messages indexing...');

  const { data: messages, error } = await supabase
    .from('pulse_messages')
    .select('id, channel, message, message_type, created_at, metadata')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.log('[Indexer] Pulse messages table not found or empty');
    return { success: true, documentsIndexed: 0, errors: [] };
  }

  if (!messages || messages.length === 0) {
    return { success: true, documentsIndexed: 0, errors: [] };
  }

  let indexed = 0;
  const errors: string[] = [];

  for (const msg of messages) {
    const content = [
      msg.message,
      `Channel: ${msg.channel}`,
      `Type: ${msg.message_type}`
    ].filter(Boolean).join('\n');

    const success = await indexDocument({
      sourceType: 'pulse_message',
      sourceId: msg.id,
      title: `${msg.channel}: ${msg.message?.slice(0, 50) || 'Message'}`,
      content,
      metadata: {
        channel: msg.channel,
        messageType: msg.message_type,
        createdAt: msg.created_at,
        ...msg.metadata
      }
    });

    if (success) indexed++;
    else errors.push(`pulse_message:${msg.id}`);

    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`[Indexer] Pulse messages: indexed ${indexed}/${messages.length}`);
  return { success: errors.length === 0, documentsIndexed: indexed, errors };
}

/**
 * Index action items (extracted from meetings)
 */
export async function indexActionItems(): Promise<IndexResult> {
  console.log('[Indexer] Starting action items indexing...');

  const { data: items, error } = await supabase
    .from('entomate_action_items')
    .select('id, task_description, assigned_to_name, due_date, priority, status, meeting_id, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error || !items) {
    console.log('[Indexer] Action items table not found or empty');
    return { success: true, documentsIndexed: 0, errors: [] };
  }

  let indexed = 0;
  const errors: string[] = [];

  for (const item of items) {
    const content = [
      item.task_description,
      item.assigned_to_name ? `Assigned to: ${item.assigned_to_name}` : '',
      item.due_date ? `Due: ${item.due_date}` : '',
      `Priority: ${item.priority}`,
      `Status: ${item.status}`
    ].filter(Boolean).join('\n');

    const success = await indexDocument({
      sourceType: 'task',
      sourceId: `action_item:${item.id}`,
      title: item.task_description?.slice(0, 100) || 'Action Item',
      content,
      metadata: {
        assignedTo: item.assigned_to_name,
        dueDate: item.due_date,
        priority: item.priority,
        status: item.status,
        meetingId: item.meeting_id,
        createdAt: item.created_at,
        isActionItem: true
      }
    });

    if (success) indexed++;
    else errors.push(`action_item:${item.id}`);

    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`[Indexer] Action items: indexed ${indexed}/${items.length}`);
  return { success: errors.length === 0, documentsIndexed: indexed, errors };
}

/**
 * Run full reindex of all sources
 */
export async function reindexAll(): Promise<{
  totalIndexed: number;
  results: Record<string, IndexResult>;
}> {
  console.log('[Indexer] Starting full reindex...');

  const results: Record<string, IndexResult> = {};
  let totalIndexed = 0;

  // Index each source type
  results.meetings = await indexMeetings();
  totalIndexed += results.meetings.documentsIndexed;

  results.tasks = await indexTasks();
  totalIndexed += results.tasks.documentsIndexed;

  results.actionItems = await indexActionItems();
  totalIndexed += results.actionItems.documentsIndexed;

  results.projects = await indexProjects();
  totalIndexed += results.projects.documentsIndexed;

  results.deals = await indexDeals();
  totalIndexed += results.deals.documentsIndexed;

  results.pulseMessages = await indexPulseMessages();
  totalIndexed += results.pulseMessages.documentsIndexed;

  console.log(`[Indexer] Full reindex complete. Total: ${totalIndexed} documents`);

  return { totalIndexed, results };
}

/**
 * Index a specific meeting (call after meeting is processed)
 */
export async function indexMeeting(meetingId: string): Promise<boolean> {
  const { data: meeting, error } = await supabase
    .from('entomate_meetings')
    .select('id, title, transcript, summary, key_points, decisions, created_at')
    .eq('id', meetingId)
    .single();

  if (error || !meeting) {
    console.error('[Indexer] Meeting not found:', meetingId);
    return false;
  }

  const content = [
    meeting.title,
    meeting.summary,
    meeting.transcript,
    meeting.key_points?.join('\n'),
    meeting.decisions?.join('\n')
  ].filter(Boolean).join('\n\n');

  return indexDocument({
    sourceType: 'meeting',
    sourceId: meeting.id,
    title: meeting.title || 'Untitled Meeting',
    content,
    metadata: {
      createdAt: meeting.created_at,
      hasSummary: !!meeting.summary,
      hasTranscript: !!meeting.transcript
    }
  });
}

/**
 * Get indexing stats
 */
export async function getIndexingStats(): Promise<{
  totalDocuments: number;
  bySourceType: Record<string, number>;
  lastIndexedAt: string | null;
}> {
  const { data, error } = await supabase
    .from('search_documents')
    .select('source_type, indexed_at')
    .order('indexed_at', { ascending: false });

  if (error || !data) {
    return { totalDocuments: 0, bySourceType: {}, lastIndexedAt: null };
  }

  const bySourceType: Record<string, number> = {};
  for (const doc of data) {
    bySourceType[doc.source_type] = (bySourceType[doc.source_type] || 0) + 1;
  }

  return {
    totalDocuments: data.length,
    bySourceType,
    lastIndexedAt: data[0]?.indexed_at || null
  };
}
