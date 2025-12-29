/**
 * Cross-App Search Service
 *
 * Searches across the shared hub for contacts, events, and data from all connected apps.
 * Provides unified search results with deep links to source applications.
 */

const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger');

// Hub client (lazy initialization)
let hubClient = null;

/**
 * Initialize the hub client using environment variables
 */
function getHubClient() {
  if (hubClient) return hubClient;

  const hubUrl = process.env.HUB_SUPABASE_URL;
  const hubServiceKey = process.env.HUB_SUPABASE_SERVICE_KEY;

  if (!hubUrl || !hubServiceKey) {
    logger.warn('[CrossAppSearch] Hub credentials not configured. Set HUB_SUPABASE_URL and HUB_SUPABASE_SERVICE_KEY');
    return null;
  }

  hubClient = createClient(hubUrl, hubServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return hubClient;
}

/**
 * App metadata for generating deep links and icons
 */
const APP_METADATA = {
  entomate: {
    name: 'Entomate',
    icon: 'calendar',
    color: '#6366f1',
    baseUrl: process.env.ENTOMATE_URL || 'http://localhost:5173'
  },
  pulse: {
    name: 'Pulse',
    icon: 'activity',
    color: '#10b981',
    baseUrl: process.env.PULSE_URL || 'http://pulse.local:3000'
  },
  agentica: {
    name: 'Agentica',
    icon: 'bot',
    color: '#8b5cf6',
    baseUrl: process.env.AGENTICA_URL || 'http://agentica.local:3000'
  },
  logos_crm: {
    name: 'Logos CRM',
    icon: 'briefcase',
    color: '#f59e0b',
    baseUrl: process.env.LOGOS_CRM_URL || 'http://logos.local:3000'
  }
};

/**
 * Result type configurations for icons and formatting
 */
const RESULT_TYPES = {
  contact: {
    icon: 'user',
    color: '#3b82f6',
    label: 'Contact'
  },
  meeting: {
    icon: 'video',
    color: '#8b5cf6',
    label: 'Meeting'
  },
  deal: {
    icon: 'dollar-sign',
    color: '#10b981',
    label: 'Deal'
  },
  event: {
    icon: 'bell',
    color: '#f59e0b',
    label: 'Event'
  },
  agent: {
    icon: 'bot',
    color: '#6366f1',
    label: 'Agent'
  },
  workflow: {
    icon: 'git-branch',
    color: '#ec4899',
    label: 'Workflow'
  }
};

/**
 * Search contacts in the shared hub
 */
async function searchContacts(supabase, query, options = {}) {
  const { limit = 10, userId, organizationId } = options;

  try {
    let queryBuilder = supabase
      .from('shared_contacts')
      .select('*')
      .or(`name.ilike.%${query}%,email.ilike.%${query}%,company_name.ilike.%${query}%,job_title.ilike.%${query}%`)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (userId) {
      queryBuilder = queryBuilder.eq('owner_id', userId);
    }

    if (organizationId) {
      queryBuilder = queryBuilder.eq('organization_id', organizationId);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      logger.error('[CrossAppSearch] Contact search error:', error);
      return [];
    }

    return (data || []).map(contact => ({
      id: contact.id,
      type: 'contact',
      typeInfo: RESULT_TYPES.contact,
      title: contact.name || contact.email,
      subtitle: contact.company_name ? `${contact.job_title || 'Contact'} at ${contact.company_name}` : contact.job_title,
      description: contact.email,
      sourceApp: contact.source_app,
      sourceAppInfo: APP_METADATA[contact.source_app] || APP_METADATA.logos_crm,
      sourceId: contact.source_id,
      deepLink: generateDeepLink('contact', contact),
      metadata: {
        email: contact.email,
        phone: contact.phone,
        tags: contact.tags,
        lastUpdated: contact.updated_at
      },
      score: calculateContactScore(contact, query),
      timestamp: contact.updated_at
    }));
  } catch (error) {
    logger.error('[CrossAppSearch] Contact search exception:', error);
    return [];
  }
}

/**
 * Search cross-app events in the shared hub
 */
async function searchEvents(supabase, query, options = {}) {
  const { limit = 10, userId, organizationId, categories } = options;

  try {
    // Search in event payloads using PostgreSQL JSON operators
    let queryBuilder = supabase
      .from('cross_app_events')
      .select('*')
      .or(`event_type.ilike.%${query}%,payload->>'title'.ilike.%${query}%,payload->>'name'.ilike.%${query}%,payload->>'summary'.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (userId) {
      queryBuilder = queryBuilder.eq('user_id', userId);
    }

    if (organizationId) {
      queryBuilder = queryBuilder.eq('organization_id', organizationId);
    }

    if (categories && categories.length > 0) {
      queryBuilder = queryBuilder.in('event_category', categories);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      logger.error('[CrossAppSearch] Event search error:', error);
      return [];
    }

    return (data || []).map(event => {
      const eventType = mapEventToResultType(event);
      return {
        id: event.id,
        type: eventType,
        typeInfo: RESULT_TYPES[eventType] || RESULT_TYPES.event,
        title: extractEventTitle(event),
        subtitle: event.event_type.replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: extractEventDescription(event),
        sourceApp: event.source_app,
        sourceAppInfo: APP_METADATA[event.source_app] || APP_METADATA.entomate,
        sourceId: extractSourceId(event),
        deepLink: generateEventDeepLink(event),
        metadata: {
          eventType: event.event_type,
          category: event.event_category,
          payload: event.payload,
          createdAt: event.created_at
        },
        score: calculateEventScore(event, query),
        timestamp: event.created_at
      };
    });
  } catch (error) {
    logger.error('[CrossAppSearch] Event search exception:', error);
    return [];
  }
}

/**
 * Search local Entomate meetings
 */
async function searchMeetings(query, options = {}) {
  const { limit = 10 } = options;
  const { supabase } = require('../config/supabase');

  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('meetings')
      .select('id, title, summary, transcript, created_at, topics, sentiment_label')
      .or(`title.ilike.%${query}%,summary.ilike.%${query}%,transcript.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('[CrossAppSearch] Meeting search error:', error);
      return [];
    }

    return (data || []).map(meeting => ({
      id: meeting.id,
      type: 'meeting',
      typeInfo: RESULT_TYPES.meeting,
      title: meeting.title,
      subtitle: meeting.topics?.slice(0, 3).join(', ') || 'Meeting',
      description: meeting.summary?.substring(0, 150) + (meeting.summary?.length > 150 ? '...' : ''),
      sourceApp: 'entomate',
      sourceAppInfo: APP_METADATA.entomate,
      sourceId: meeting.id,
      deepLink: `${APP_METADATA.entomate.baseUrl}/meetings/${meeting.id}`,
      metadata: {
        topics: meeting.topics,
        sentiment: meeting.sentiment_label,
        createdAt: meeting.created_at
      },
      score: calculateMeetingScore(meeting, query),
      timestamp: meeting.created_at
    }));
  } catch (error) {
    logger.error('[CrossAppSearch] Meeting search exception:', error);
    return [];
  }
}

/**
 * Search local Entomate action items
 */
async function searchActionItems(query, options = {}) {
  const { limit = 10 } = options;
  const { supabase } = require('../config/supabase');

  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('action_items')
      .select('id, task_description, context, assigned_to_name, status, priority, due_date, meeting_id')
      .or(`task_description.ilike.%${query}%,context.ilike.%${query}%,assigned_to_name.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('[CrossAppSearch] Action item search error:', error);
      return [];
    }

    return (data || []).map(item => ({
      id: item.id,
      type: 'action_item',
      typeInfo: {
        icon: 'check-square',
        color: item.priority === 'high' ? '#ef4444' : item.priority === 'medium' ? '#f59e0b' : '#22c55e',
        label: 'Action Item'
      },
      title: item.task_description,
      subtitle: item.assigned_to_name ? `Assigned to ${item.assigned_to_name}` : 'Unassigned',
      description: item.context?.substring(0, 100) + (item.context?.length > 100 ? '...' : ''),
      sourceApp: 'entomate',
      sourceAppInfo: APP_METADATA.entomate,
      sourceId: item.id,
      deepLink: item.meeting_id
        ? `${APP_METADATA.entomate.baseUrl}/meetings/${item.meeting_id}?action=${item.id}`
        : `${APP_METADATA.entomate.baseUrl}/tasks`,
      metadata: {
        status: item.status,
        priority: item.priority,
        dueDate: item.due_date,
        meetingId: item.meeting_id
      },
      score: calculateActionItemScore(item, query),
      timestamp: item.due_date || item.created_at
    }));
  } catch (error) {
    logger.error('[CrossAppSearch] Action item search exception:', error);
    return [];
  }
}

/**
 * Main unified search function
 * Performs parallel queries across all data sources
 */
async function search(query, options = {}) {
  const startTime = Date.now();
  const {
    limit = 20,
    types = ['contacts', 'meetings', 'events', 'action_items'],
    userId,
    organizationId
  } = options;

  if (!query || query.trim().length < 2) {
    return {
      results: [],
      totalCount: 0,
      executionTime: Date.now() - startTime,
      sources: []
    };
  }

  const searchQuery = query.trim();
  const perTypeLimit = Math.ceil(limit / types.length) + 2; // Fetch slightly more for ranking

  // Build parallel search promises
  const searchPromises = [];
  const sources = [];

  const hubClient = getHubClient();

  if (types.includes('contacts') && hubClient) {
    searchPromises.push(searchContacts(hubClient, searchQuery, { limit: perTypeLimit, userId, organizationId }));
    sources.push('hub:contacts');
  }

  if (types.includes('events') && hubClient) {
    searchPromises.push(searchEvents(hubClient, searchQuery, { limit: perTypeLimit, userId, organizationId }));
    sources.push('hub:events');
  }

  if (types.includes('meetings')) {
    searchPromises.push(searchMeetings(searchQuery, { limit: perTypeLimit }));
    sources.push('local:meetings');
  }

  if (types.includes('action_items')) {
    searchPromises.push(searchActionItems(searchQuery, { limit: perTypeLimit }));
    sources.push('local:action_items');
  }

  // Execute all searches in parallel
  const searchResults = await Promise.allSettled(searchPromises);

  // Combine and flatten results
  let allResults = [];
  searchResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      allResults = allResults.concat(result.value);
    } else {
      logger.warn(`[CrossAppSearch] Search failed for ${sources[index]}:`, result.reason);
    }
  });

  // Sort by score (relevance) and recency
  allResults.sort((a, b) => {
    // Primary: score (higher is better)
    const scoreDiff = (b.score || 0) - (a.score || 0);
    if (Math.abs(scoreDiff) > 0.1) return scoreDiff;

    // Secondary: timestamp (more recent is better)
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return timeB - timeA;
  });

  // Limit final results
  const finalResults = allResults.slice(0, limit);

  // Group by type for UI
  const groupedResults = groupResultsByType(finalResults);

  return {
    results: finalResults,
    grouped: groupedResults,
    totalCount: allResults.length,
    executionTime: Date.now() - startTime,
    sources: sources.filter((_, i) => searchResults[i].status === 'fulfilled'),
    query: searchQuery
  };
}

/**
 * Get recent searches for a user (from local storage or database)
 */
async function getRecentSearches(userId, limit = 10) {
  const { supabase } = require('../config/supabase');

  if (!supabase) {
    return [];
  }

  try {
    // Try to get from search_history table if it exists
    const { data, error } = await supabase
      .from('search_history')
      .select('query, search_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      // Table might not exist
      return [];
    }

    return data || [];
  } catch (error) {
    return [];
  }
}

/**
 * Save a search to history
 */
async function saveSearchToHistory(userId, query, searchType = 'cross_app') {
  const { supabase } = require('../config/supabase');

  if (!supabase || !userId) {
    return;
  }

  try {
    await supabase
      .from('search_history')
      .insert({
        user_id: userId,
        query,
        search_type: searchType,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    // Silently fail - history is not critical
    logger.debug('[CrossAppSearch] Failed to save search history:', error.message);
  }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Generate deep link for a contact
 */
function generateDeepLink(type, item) {
  const sourceApp = item.source_app || 'logos_crm';
  const appInfo = APP_METADATA[sourceApp] || APP_METADATA.logos_crm;

  switch (sourceApp) {
    case 'logos_crm':
      return `${appInfo.baseUrl}/contacts/${item.source_id || item.id}`;
    case 'entomate':
      return `${appInfo.baseUrl}/contacts/${item.source_id || item.id}`;
    case 'pulse':
      return `${appInfo.baseUrl}/contacts/${item.source_id || item.id}`;
    default:
      return `${appInfo.baseUrl}/contacts/${item.source_id || item.id}`;
  }
}

/**
 * Generate deep link for an event
 */
function generateEventDeepLink(event) {
  const appInfo = APP_METADATA[event.source_app] || APP_METADATA.entomate;
  const category = event.event_category;
  const payload = event.payload || {};

  switch (category) {
    case 'meeting':
      return `${APP_METADATA.entomate.baseUrl}/meetings/${payload.meeting?.id || payload.meetingId || ''}`;
    case 'deal':
      return `${APP_METADATA.logos_crm.baseUrl}/deals/${payload.deal?.id || payload.dealId || ''}`;
    case 'contact':
      return `${APP_METADATA.logos_crm.baseUrl}/contacts/${payload.contact?.id || payload.contactId || ''}`;
    case 'agent':
      return `${APP_METADATA.agentica.baseUrl}/agents/${payload.agentId || ''}`;
    case 'workflow':
      return `${APP_METADATA.entomate.baseUrl}/workflows/${payload.workflowId || ''}`;
    default:
      return appInfo.baseUrl;
  }
}

/**
 * Map event to result type
 */
function mapEventToResultType(event) {
  const category = event.event_category;
  if (category === 'meeting') return 'meeting';
  if (category === 'deal') return 'deal';
  if (category === 'contact') return 'contact';
  if (category === 'agent') return 'agent';
  if (category === 'workflow') return 'workflow';
  return 'event';
}

/**
 * Extract title from event payload
 */
function extractEventTitle(event) {
  const payload = event.payload || {};
  return payload.title
    || payload.name
    || payload.meeting?.title
    || payload.deal?.name
    || payload.contact?.name
    || payload.agent?.name
    || event.event_type.split('.').pop().replace(/_/g, ' ');
}

/**
 * Extract description from event payload
 */
function extractEventDescription(event) {
  const payload = event.payload || {};
  return payload.summary
    || payload.description
    || payload.meeting?.summary
    || payload.deal?.description
    || '';
}

/**
 * Extract source ID from event
 */
function extractSourceId(event) {
  const payload = event.payload || {};
  return payload.id
    || payload.meeting?.id
    || payload.deal?.id
    || payload.contact?.id
    || payload.agentId
    || payload.workflowId
    || event.id;
}

/**
 * Calculate relevance score for a contact
 */
function calculateContactScore(contact, query) {
  const queryLower = query.toLowerCase();
  let score = 0;

  // Exact name match
  if (contact.name?.toLowerCase() === queryLower) score += 1.0;
  else if (contact.name?.toLowerCase().startsWith(queryLower)) score += 0.8;
  else if (contact.name?.toLowerCase().includes(queryLower)) score += 0.5;

  // Email match
  if (contact.email?.toLowerCase().includes(queryLower)) score += 0.4;

  // Company match
  if (contact.company_name?.toLowerCase().includes(queryLower)) score += 0.3;

  // Recency boost
  const daysSinceUpdate = (Date.now() - new Date(contact.updated_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate < 7) score += 0.2;
  else if (daysSinceUpdate < 30) score += 0.1;

  return Math.min(score, 1.0);
}

/**
 * Calculate relevance score for an event
 */
function calculateEventScore(event, query) {
  const queryLower = query.toLowerCase();
  const title = extractEventTitle(event).toLowerCase();
  let score = 0;

  if (title === queryLower) score += 1.0;
  else if (title.startsWith(queryLower)) score += 0.7;
  else if (title.includes(queryLower)) score += 0.4;

  // Event type match
  if (event.event_type.toLowerCase().includes(queryLower)) score += 0.3;

  // Recency boost
  const daysSinceCreated = (Date.now() - new Date(event.created_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceCreated < 1) score += 0.3;
  else if (daysSinceCreated < 7) score += 0.2;
  else if (daysSinceCreated < 30) score += 0.1;

  return Math.min(score, 1.0);
}

/**
 * Calculate relevance score for a meeting
 */
function calculateMeetingScore(meeting, query) {
  const queryLower = query.toLowerCase();
  let score = 0;

  // Title match
  if (meeting.title?.toLowerCase() === queryLower) score += 1.0;
  else if (meeting.title?.toLowerCase().startsWith(queryLower)) score += 0.8;
  else if (meeting.title?.toLowerCase().includes(queryLower)) score += 0.5;

  // Summary match
  if (meeting.summary?.toLowerCase().includes(queryLower)) score += 0.4;

  // Topics match
  if (meeting.topics?.some(t => t.toLowerCase().includes(queryLower))) score += 0.3;

  // Recency boost
  const daysSinceCreated = (Date.now() - new Date(meeting.created_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceCreated < 7) score += 0.2;
  else if (daysSinceCreated < 30) score += 0.1;

  return Math.min(score, 1.0);
}

/**
 * Calculate relevance score for an action item
 */
function calculateActionItemScore(item, query) {
  const queryLower = query.toLowerCase();
  let score = 0;

  // Task description match
  if (item.task_description?.toLowerCase().includes(queryLower)) score += 0.6;

  // Assignee match
  if (item.assigned_to_name?.toLowerCase().includes(queryLower)) score += 0.4;

  // Context match
  if (item.context?.toLowerCase().includes(queryLower)) score += 0.3;

  // Priority boost
  if (item.priority === 'high') score += 0.2;
  else if (item.priority === 'medium') score += 0.1;

  // Open items boost
  if (item.status === 'open' || item.status === 'pending') score += 0.2;

  return Math.min(score, 1.0);
}

/**
 * Group results by type for UI rendering
 */
function groupResultsByType(results) {
  const groups = {};

  results.forEach(result => {
    const type = result.type;
    if (!groups[type]) {
      groups[type] = {
        type,
        typeInfo: result.typeInfo,
        items: []
      };
    }
    groups[type].items.push(result);
  });

  return Object.values(groups);
}

/**
 * Check if hub is configured
 */
function isHubConfigured() {
  return !!(process.env.HUB_SUPABASE_URL && process.env.HUB_SUPABASE_SERVICE_KEY);
}

module.exports = {
  search,
  searchContacts,
  searchEvents,
  searchMeetings,
  searchActionItems,
  getRecentSearches,
  saveSearchToHistory,
  isHubConfigured,
  APP_METADATA,
  RESULT_TYPES
};
