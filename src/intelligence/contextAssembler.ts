/**
 * Context Assembler
 * Gathers pre-meeting context from multiple sources (Logos Vision CRM,
 * Pulse chat, and Entomate's own data) to enrich the intelligence prompt.
 *
 * Each source is independently queried with graceful degradation —
 * a failure in one source does not block others.
 */

import { supabase } from '../lib/supabase';
import { logosVisionSupabase, getConnectionInfo as getLVConnectionInfo } from '../lib/logosVisionClient';
import { fetchFromPulseApi, checkPulseConnection } from './pulseFetcher';
import { buildMeetingPrompt } from './promptBuilder';
import { saveMeetingIntelligenceConfig } from './profileService';
import type {
  IntelligenceProfile,
  ContextDepth,
  AssembledContext,
  ParticipantContext,
  OrgContext,
  DealContext,
  PastMeetingContext,
  ConversationContext,
  TaskContext,
} from './types';

/** Max token budget for assembled context (~4 chars per token) */
const MAX_CONTEXT_TOKENS = 4000;

/** Depth-based limits */
const DEPTH_LIMITS: Record<ContextDepth, { pastMeetings: number; pulseDays: number }> = {
  minimal: { pastMeetings: 1, pulseDays: 7 },
  standard: { pastMeetings: 3, pulseDays: 30 },
  deep: { pastMeetings: 5, pulseDays: 90 },
};

// ==================== MAIN ENTRY POINT ====================

/**
 * Assemble cross-app context for a meeting based on its intelligence profile.
 * Updates the meeting_intelligence_config record with the result.
 */
export async function assembleContext(
  meetingId: string,
  profile: IntelligenceProfile
): Promise<AssembledContext> {
  console.log(`[Intelligence:contextAssembler] Assembling context for meeting:${meetingId} with profile:${profile.slug}`);

  // 1. Load meeting data
  const meeting = await loadMeeting(meetingId);
  if (!meeting) {
    console.error('[Intelligence:contextAssembler] Meeting not found:', meetingId);
    return emptyContext();
  }

  // 2. Extract participant identifiers
  const participantNames = extractParticipantNames(meeting.attendees || meeting.participants || []);

  // 3. Gather context from each configured source
  const sources = profile.contextSources;
  const depth = profile.contextDepth;
  const limits = DEPTH_LIMITS[depth];
  const successfulSources: string[] = [];

  let participants: ParticipantContext[] = [];
  let organization: OrgContext | undefined;
  let relatedDeals: DealContext[] = [];
  let pastMeetings: PastMeetingContext[] = [];
  let recentConversations: ConversationContext[] = [];
  let openTasks: TaskContext[] = [];

  // Determine if external apps are available
  const lvConfigured = getLVConnectionInfo().isConfigured || getLVConnectionInfo().isSharedInstance;
  const pulseAvailable = await isPulseAvailable();

  // Gather contacts (also populates org info and notes)
  if (sources.includes('contacts')) {
    try {
      participants = await gatherContacts(participantNames, lvConfigured);
      if (participants.length > 0) successfulSources.push('contacts');
    } catch (err) {
      console.error('[Intelligence:contextAssembler] contacts gather failed:', err);
    }
  }

  // Gather organization info
  if (sources.includes('org_info') && lvConfigured) {
    try {
      organization = await gatherOrgInfo(participants);
      if (organization) successfulSources.push('org_info');
    } catch (err) {
      console.error('[Intelligence:contextAssembler] org_info gather failed:', err);
    }
  }

  // Gather CRM deals/projects
  if (sources.includes('crm_deals') && lvConfigured) {
    try {
      relatedDeals = await gatherDeals(participants, organization);
      if (relatedDeals.length > 0) successfulSources.push('crm_deals');
    } catch (err) {
      console.error('[Intelligence:contextAssembler] crm_deals gather failed:', err);
    }
  }

  // Gather past meetings from Entomate
  if (sources.includes('past_meetings')) {
    try {
      pastMeetings = await gatherPastMeetings(meetingId, participantNames, limits.pastMeetings);
      if (pastMeetings.length > 0) successfulSources.push('past_meetings');
    } catch (err) {
      console.error('[Intelligence:contextAssembler] past_meetings gather failed:', err);
    }
  }

  // Gather Pulse conversation history
  if (sources.includes('pulse_history') && pulseAvailable) {
    try {
      recentConversations = await gatherPulseHistory(participantNames, limits.pulseDays);
      if (recentConversations.length > 0) successfulSources.push('pulse_history');
    } catch (err) {
      console.error('[Intelligence:contextAssembler] pulse_history gather failed:', err);
    }
  }

  // Gather open tasks
  if (sources.includes('tasks')) {
    try {
      openTasks = await gatherTasks(participantNames, meetingId, lvConfigured);
      if (openTasks.length > 0) successfulSources.push('tasks');
    } catch (err) {
      console.error('[Intelligence:contextAssembler] tasks gather failed:', err);
    }
  }

  // Gather notes from Logos Vision activities
  if (sources.includes('notes') && lvConfigured) {
    try {
      participants = await enrichParticipantsWithNotes(participants);
      successfulSources.push('notes');
    } catch (err) {
      console.error('[Intelligence:contextAssembler] notes gather failed:', err);
    }
  }

  // 4. Build the assembled context
  let context: AssembledContext = {
    participants,
    organization,
    relatedDeals: relatedDeals.length > 0 ? relatedDeals : undefined,
    pastMeetings: pastMeetings.length > 0 ? pastMeetings : undefined,
    recentConversations: recentConversations.length > 0 ? recentConversations : undefined,
    openTasks: openTasks.length > 0 ? openTasks : undefined,
    assembledAt: new Date().toISOString(),
    sources: successfulSources,
    tokenEstimate: 0,
  };

  // 5. Estimate tokens and trim if needed
  context = trimToTokenBudget(context);

  // 6. Cache the result
  await setCachedContext('meeting', meetingId, 'entomate', context, 2);

  // 7. Update the meeting_intelligence_config record
  try {
    const config = await loadMeetingConfig(meetingId);
    if (config) {
      const composedPrompt = buildMeetingPrompt(
        profile,
        config.custom_field_values || {},
        context,
        {
          toneOverride: config.tone_override || undefined,
          focusOverride: config.focus_override || undefined,
          additionalInstructions: config.additional_instructions || undefined,
        }
      );

      await saveMeetingIntelligenceConfig({
        meeting_id: meetingId,
        assembled_context: context as any,
        context_assembled_at: new Date().toISOString(),
        composed_prompt: composedPrompt,
        status: 'context_ready',
      });

      console.log(`[Intelligence:contextAssembler] Context assembled — ${successfulSources.length} sources, ~${context.tokenEstimate} tokens`);
    }
  } catch (err) {
    console.error('[Intelligence:contextAssembler] Failed to update meeting config:', err);
  }

  return context;
}

// ==================== SOURCE GATHERERS ====================

async function gatherContacts(
  participantNames: string[],
  lvConfigured: boolean
): Promise<ParticipantContext[]> {
  const participants: ParticipantContext[] = [];

  if (lvConfigured && participantNames.length > 0) {
    // Query Logos Vision team_members by name
    for (const name of participantNames) {
      const { data: members } = await logosVisionSupabase
        .from('team_members')
        .select('id, name, email, role')
        .ilike('name', `%${name}%`)
        .limit(1);

      if (members && members.length > 0) {
        const member = members[0];
        participants.push({
          name: member.name,
          email: member.email,
          role: member.role,
          sourceApp: 'logos_vision',
        });
        continue;
      }

      // Also check clients table (contact_person field)
      const { data: clients } = await logosVisionSupabase
        .from('clients')
        .select('name, contact_person, email')
        .ilike('contact_person', `%${name}%`)
        .limit(1);

      if (clients && clients.length > 0) {
        const client = clients[0];
        participants.push({
          name: client.contact_person || name,
          email: client.email || undefined,
          organization: client.name,
          relationship: 'client',
          sourceApp: 'logos_vision',
        });
        continue;
      }

      // Fallback: add with just the name from Entomate
      participants.push({ name, sourceApp: 'entomate' });
    }
  } else {
    // No CRM — just use raw participant names
    for (const name of participantNames) {
      participants.push({ name, sourceApp: 'entomate' });
    }
  }

  // Enrich with past meeting counts from Entomate
  for (const p of participants) {
    try {
      const { count } = await supabase
        .from('entomate_meetings')
        .select('id', { count: 'exact', head: true })
        .contains('attendees', [p.name]);

      p.meetingCount = count || 0;
    } catch {
      // Not critical
    }
  }

  return participants;
}

async function gatherOrgInfo(
  participants: ParticipantContext[]
): Promise<OrgContext | undefined> {
  // Find the first participant with an organization reference
  const orgName = participants.find(p => p.organization)?.organization;
  if (!orgName) return undefined;

  const { data: clients } = await logosVisionSupabase
    .from('clients')
    .select('id, name, contact_person, email, phone, location')
    .ilike('name', `%${orgName}%`)
    .limit(1);

  if (!clients || clients.length === 0) return undefined;

  const client = clients[0];

  // Count active projects for this client
  const { count: dealCount } = await logosVisionSupabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', client.id)
    .neq('status', 'Completed');

  // Count meetings involving this org's contacts
  const { count: meetingCount } = await supabase
    .from('entomate_meetings')
    .select('id', { count: 'exact', head: true })
    .contains('attendees', [client.contact_person || orgName]);

  return {
    name: client.name,
    relationship: 'client',
    activeDeals: dealCount || 0,
    totalMeetings: meetingCount || 0,
    keyContacts: client.contact_person ? [client.contact_person] : [],
  };
}

async function gatherDeals(
  _participants: ParticipantContext[],
  org?: OrgContext
): Promise<DealContext[]> {
  if (!org) return [];

  // Find the client ID from Logos Vision
  const { data: clients } = await logosVisionSupabase
    .from('clients')
    .select('id')
    .ilike('name', `%${org.name}%`)
    .limit(1);

  if (!clients || clients.length === 0) return [];

  const clientId = clients[0].id;

  const { data: projects } = await logosVisionSupabase
    .from('projects')
    .select('name, description, status, start_date, end_date')
    .eq('client_id', clientId)
    .neq('status', 'Completed')
    .order('start_date', { ascending: false })
    .limit(5);

  if (!projects) return [];

  return projects.map(p => ({
    name: p.name,
    stage: p.status,
    lastActivity: p.start_date || undefined,
  }));
}

async function gatherPastMeetings(
  currentMeetingId: string,
  participantNames: string[],
  limit: number
): Promise<PastMeetingContext[]> {
  if (participantNames.length === 0) return [];

  // Find past meetings with overlapping participants
  // Supabase doesn't support OR on contains easily, so query by each name
  const meetingIds = new Set<string>();
  const meetingMap = new Map<string, any>();

  for (const name of participantNames.slice(0, 3)) { // Limit to 3 lookups
    const { data } = await supabase
      .from('entomate_meetings')
      .select('id, title, summary, key_points, decisions, created_at')
      .neq('id', currentMeetingId)
      .contains('attendees', [name])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (data) {
      for (const m of data) {
        if (!meetingIds.has(m.id)) {
          meetingIds.add(m.id);
          meetingMap.set(m.id, m);
        }
      }
    }
  }

  // Also try participants column for older meetings
  for (const name of participantNames.slice(0, 3)) {
    const { data } = await supabase
      .from('entomate_meetings')
      .select('id, title, summary, key_points, decisions, created_at')
      .neq('id', currentMeetingId)
      .contains('participants', [name])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (data) {
      for (const m of data) {
        if (!meetingIds.has(m.id)) {
          meetingIds.add(m.id);
          meetingMap.set(m.id, m);
        }
      }
    }
  }

  // Sort by date and limit
  const meetings = Array.from(meetingMap.values())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);

  // Enrich with open action items
  const results: PastMeetingContext[] = [];

  for (const m of meetings) {
    const { data: actionItems } = await supabase
      .from('entomate_action_items')
      .select('task_description')
      .eq('meeting_id', m.id)
      .neq('status', 'completed')
      .limit(5);

    results.push({
      title: m.title,
      date: m.created_at,
      summary: m.summary || undefined,
      keyDecisions: m.decisions || undefined,
      openActionItems: actionItems?.map((ai: any) => ai.task_description) || undefined,
    });
  }

  return results;
}

async function gatherPulseHistory(
  participantNames: string[],
  lookbackDays: number
): Promise<ConversationContext[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);
  const cutoffIso = cutoff.toISOString();

  try {
    // Query Pulse chat_messages mentioning participants
    const conversations: ConversationContext[] = [];

    for (const name of participantNames.slice(0, 3)) {
      const messages = await fetchFromPulseApi(
        'chat_messages',
        `?content=ilike.*${encodeURIComponent(name)}*&created_at=gte.${cutoffIso}&order=created_at.desc&limit=10`
      );

      if (messages && messages.length > 0) {
        // Group by channel
        const byChannel = new Map<string, any[]>();
        for (const msg of messages) {
          const ch = msg.channel_id || 'unknown';
          if (!byChannel.has(ch)) byChannel.set(ch, []);
          byChannel.get(ch)!.push(msg);
        }

        for (const [channelId, msgs] of byChannel) {
          conversations.push({
            channel: channelId,
            lastMessage: msgs[0].content?.slice(0, 200) || '',
            messageCount: msgs.length,
            lastActivity: msgs[0].created_at,
            topics: [name],
          });
        }
      }
    }

    return conversations;
  } catch (err) {
    console.error('[Intelligence:contextAssembler] Pulse query failed:', err);
    return [];
  }
}

async function gatherTasks(
  participantNames: string[],
  meetingId: string,
  lvConfigured: boolean
): Promise<TaskContext[]> {
  const tasks: TaskContext[] = [];

  // Entomate action items related to participants
  for (const name of participantNames.slice(0, 3)) {
    const { data } = await supabase
      .from('entomate_action_items')
      .select('task_description, status, assigned_to_name, due_date, priority')
      .ilike('assigned_to_name', `%${name}%`)
      .neq('status', 'completed')
      .order('due_date', { ascending: true })
      .limit(5);

    if (data) {
      for (const item of data) {
        tasks.push({
          title: item.task_description,
          status: item.status,
          assignee: item.assigned_to_name || undefined,
          dueDate: item.due_date || undefined,
          priority: item.priority,
          relatedTo: 'entomate',
        });
      }
    }
  }

  // Logos Vision tasks if configured
  if (lvConfigured) {
    try {
      const { data: lvTasks } = await logosVisionSupabase
        .from('tasks')
        .select('description, status, priority, due_date, notes')
        .eq('entomate_meeting_id', meetingId)
        .neq('status', 'Done')
        .limit(10);

      if (lvTasks) {
        for (const t of lvTasks) {
          tasks.push({
            title: t.description,
            status: t.status,
            dueDate: t.due_date || undefined,
            priority: t.priority || 'medium',
            relatedTo: 'logos_vision',
          });
        }
      }
    } catch {
      // CRM task lookup is non-critical
    }
  }

  return tasks;
}

async function enrichParticipantsWithNotes(
  participants: ParticipantContext[]
): Promise<ParticipantContext[]> {
  for (const p of participants) {
    if (p.sourceApp !== 'logos_vision' || !p.name) continue;

    try {
      // Look for recent Note-type activities mentioning this person
      const { data: activities } = await logosVisionSupabase
        .from('activities')
        .select('title, notes, activity_date')
        .eq('type', 'Note')
        .ilike('title', `%${p.name}%`)
        .order('activity_date', { ascending: false })
        .limit(2);

      if (activities && activities.length > 0) {
        const noteTexts = activities
          .map(a => a.notes || a.title)
          .filter(Boolean)
          .join('; ');
        p.notes = noteTexts.slice(0, 500);
      }
    } catch {
      // Non-critical
    }
  }

  return participants;
}

// ==================== HELPERS ====================

async function loadMeeting(meetingId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('entomate_meetings')
    .select('*')
    .eq('id', meetingId)
    .single();

  if (error) {
    console.error('[Intelligence:contextAssembler] Failed to load meeting:', error);
    return null;
  }
  return data;
}

async function loadMeetingConfig(meetingId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('meeting_intelligence_config')
    .select('*')
    .eq('meeting_id', meetingId)
    .single();

  if (error) return null;
  return data;
}

function extractParticipantNames(participants: any[]): string[] {
  if (!Array.isArray(participants)) return [];
  return participants
    .map(p => {
      if (typeof p === 'string') return p.trim();
      if (p && typeof p === 'object' && p.name) return p.name.trim();
      return '';
    })
    .filter(Boolean);
}

async function isPulseAvailable(): Promise<boolean> {
  try {
    return await checkPulseConnection();
  } catch {
    return false;
  }
}

function emptyContext(): AssembledContext {
  return {
    participants: [],
    assembledAt: new Date().toISOString(),
    sources: [],
    tokenEstimate: 0,
  };
}

// ==================== TOKEN BUDGET MANAGEMENT ====================

function estimateTokens(obj: any): number {
  const json = JSON.stringify(obj);
  return Math.ceil(json.length / 4);
}

function trimToTokenBudget(context: AssembledContext): AssembledContext {
  context.tokenEstimate = estimateTokens(context);

  if (context.tokenEstimate <= MAX_CONTEXT_TOKENS) return context;

  // Priority trimming: conversations first, then past meetings, then notes
  // Never trim participant names/roles

  // 1. Trim conversation history
  if (context.recentConversations) {
    context.recentConversations = context.recentConversations.slice(0, 2);
    for (const c of context.recentConversations) {
      c.lastMessage = c.lastMessage.slice(0, 100);
    }
    context.tokenEstimate = estimateTokens(context);
    if (context.tokenEstimate <= MAX_CONTEXT_TOKENS) return context;
  }

  // 2. Trim past meeting summaries
  if (context.pastMeetings) {
    context.pastMeetings = context.pastMeetings.slice(0, 2);
    for (const m of context.pastMeetings) {
      if (m.summary && m.summary.length > 200) {
        m.summary = m.summary.slice(0, 200) + '...';
      }
      m.openActionItems = m.openActionItems?.slice(0, 3);
    }
    context.tokenEstimate = estimateTokens(context);
    if (context.tokenEstimate <= MAX_CONTEXT_TOKENS) return context;
  }

  // 3. Trim participant notes
  for (const p of context.participants) {
    if (p.notes && p.notes.length > 100) {
      p.notes = p.notes.slice(0, 100) + '...';
    }
  }

  // 4. Remove conversations entirely if still over
  if (context.recentConversations) {
    context.recentConversations = undefined;
    context.tokenEstimate = estimateTokens(context);
    if (context.tokenEstimate <= MAX_CONTEXT_TOKENS) return context;
  }

  // 5. Remove open tasks if still over
  if (context.openTasks) {
    context.openTasks = context.openTasks.slice(0, 3);
  }

  context.tokenEstimate = estimateTokens(context);
  return context;
}

// ==================== CACHE MANAGEMENT ====================

/**
 * Get cached context from intelligence_context_cache
 */
export async function getCachedContext(
  entityType: string,
  entityId: string,
  sourceApp: string
): Promise<any | null> {
  const { data, error } = await supabase
    .from('intelligence_context_cache')
    .select('context_data')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('source_app', sourceApp)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) return null;
  return data.context_data;
}

/**
 * Store context in the cache with a TTL
 */
export async function setCachedContext(
  entityType: string,
  entityId: string,
  sourceApp: string,
  data: any,
  ttlHours: number = 2
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + ttlHours);

  const { error } = await supabase
    .from('intelligence_context_cache')
    .upsert({
      entity_type: entityType,
      entity_id: entityId,
      source_app: sourceApp,
      context_data: data,
      expires_at: expiresAt.toISOString(),
    }, { onConflict: 'entity_type,entity_id,source_app' });

  if (error) {
    console.error('[Intelligence:contextAssembler] Cache write failed:', error);
  }
}

/**
 * Remove expired cache entries
 */
export async function clearExpiredCache(): Promise<number> {
  const { data, error } = await supabase
    .from('intelligence_context_cache')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) {
    console.error('[Intelligence:contextAssembler] Cache cleanup failed:', error);
    return 0;
  }
  return data?.length || 0;
}
