/**
 * Search Routes
 * Week 6: AI Search & Semantic Assistant
 */

const express = require('express');
const { supabase } = require('../config/supabase');
const ai = require('../config/ai');
const embeddingService = require('../services/embeddingService');
const askService = require('../services/askService');
const { monthlyRecapMode, validComparisonRanges } = require('../services/askMonthlyRecap');
const { searchCache, suggestionCache, withCache } = require('../utils/cache');
const { authenticate } = require('../middleware/auth');
const log = require('../utils/log');
const { attachOrgIds, getOrgIdForUser } = require('../utils/orgContext');
const { meterAi, meterAiForOrg } = require('../services/aiUsage');
const searchEverything = require('../services/searchEverything');
const searchNotes = require('../services/searchNotesService');

const router = express.Router();
router.use(attachOrgIds); // org-owned tables below are limited to req.orgIds (audit finding 3)

// Cache TTL constants (in milliseconds)
const CACHE_TTL = {
  SEARCH_RESULTS: 5 * 60 * 1000,    // 5 minutes
  SEMANTIC_RESULTS: 5 * 60 * 1000,  // 5 minutes
  SUGGESTIONS: 2 * 60 * 1000,       // 2 minutes
  ANALYTICS: 60 * 1000              // 1 minute
};

/**
 * POST /api/search
 * Full-text and semantic search across meetings, projects, tasks
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      query,
      types = ['meetings', 'tasks', 'projects'],
      limit = 20,
      filters = {}
    } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    if (!supabase) {
      return res.json({ results: [], count: 0 });
    }

    // Check cache first
    const cacheKey = searchCache.generateKey('keyword', req.orgIds, query, types, limit, filters);
    const cached = searchCache.get(cacheKey);
    if (cached) {
      log.info(`Cache hit for keyword search: "${query}"`);
      return res.json({ ...cached, fromCache: true });
    }

    const startTime = Date.now();
    const results = [];
    const searchTerm = `%${query}%`;

    // Search meetings
    if (types.includes('meetings')) {
      let meetingQuery = supabase
        .from('meetings')
        .select('id, title, summary, sentiment_label, created_at')
        .in('org_id', req.orgIds)
        .or(`title.ilike.${searchTerm},summary.ilike.${searchTerm},transcript.ilike.${searchTerm}`)
        .order('created_at', { ascending: false })
        .limit(Math.ceil(limit / types.length));

      if (filters.startDate) {
        meetingQuery = meetingQuery.gte('created_at', filters.startDate);
      }
      if (filters.endDate) {
        meetingQuery = meetingQuery.lte('created_at', filters.endDate);
      }
      if (filters.sentiment) {
        meetingQuery = meetingQuery.eq('sentiment_label', filters.sentiment);
      }

      const { data: meetings } = await meetingQuery;

      if (meetings) {
        results.push(...meetings.map(m => ({
          type: 'meeting',
          id: m.id,
          title: m.title,
          preview: m.summary?.substring(0, 200) || '',
          metadata: {
            sentiment: m.sentiment_label,
            date: m.created_at
          }
        })));
      }
    }

    // Search projects
    if (types.includes('projects')) {
      let projectQuery = supabase
        .from('projects')
        .select('id, name, description, status, created_at')
        .in('org_id', req.orgIds)
        .or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`)
        .order('created_at', { ascending: false })
        .limit(Math.ceil(limit / types.length));

      if (filters.status) {
        projectQuery = projectQuery.eq('status', filters.status);
      }

      const { data: projects } = await projectQuery;

      if (projects) {
        results.push(...projects.map(p => ({
          type: 'project',
          id: p.id,
          title: p.name,
          preview: p.description?.substring(0, 200) || '',
          metadata: {
            status: p.status,
            date: p.created_at
          }
        })));
      }
    }

    // Search tasks
    if (types.includes('tasks')) {
      let taskQuery = supabase
        .from('tasks')
        .select('id, title, description, status, priority, project_id, created_at')
        .in('org_id', req.orgIds)
        .or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`)
        .order('created_at', { ascending: false })
        .limit(Math.ceil(limit / types.length));

      if (filters.status) {
        taskQuery = taskQuery.eq('status', filters.status);
      }
      if (filters.priority) {
        taskQuery = taskQuery.eq('priority', filters.priority);
      }

      const { data: tasks } = await taskQuery;

      if (tasks) {
        results.push(...tasks.map(t => ({
          type: 'task',
          id: t.id,
          title: t.title,
          preview: t.description?.substring(0, 200) || '',
          metadata: {
            status: t.status,
            priority: t.priority,
            projectId: t.project_id,
            date: t.created_at
          }
        })));
      }
    }

    // Search action items
    if (types.includes('action_items')) {
      const { data: actionItems } = await supabase
        .from('action_items')
        .select('id, task_description, assigned_to_name, status, priority, meeting_id, created_at')
        .in('org_id', req.orgIds)
        .or(`task_description.ilike.${searchTerm},assigned_to_name.ilike.${searchTerm}`)
        .order('created_at', { ascending: false })
        .limit(Math.ceil(limit / types.length));

      if (actionItems) {
        results.push(...actionItems.map(a => ({
          type: 'action_item',
          id: a.id,
          title: a.task_description,
          preview: `Assigned to: ${a.assigned_to_name || 'Unassigned'}`,
          metadata: {
            status: a.status,
            priority: a.priority,
            meetingId: a.meeting_id,
            date: a.created_at
          }
        })));
      }
    }

    // Sort by date and limit
    results.sort((a, b) => new Date(b.metadata.date) - new Date(a.metadata.date));
    const limitedResults = results.slice(0, limit);
    const executionTime = Date.now() - startTime;

    // Log search to history
    await logSearch(query, 'keyword', limitedResults.length, executionTime, req.user.id);

    const response = {
      query,
      results: limitedResults,
      count: limitedResults.length,
      totalPossible: results.length,
      executionTime
    };

    // Cache the results
    searchCache.set(cacheKey, response, CACHE_TTL.SEARCH_RESULTS);

    res.json(response);

  } catch (error) {
    log.error('Error searching:', { error: error.message || error });
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * POST /api/search/semantic
 * Semantic search using embeddings
 */
router.post('/semantic', authenticate, async (req, res) => {
  try {
    const { query, limit = 10, threshold = 0.5 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Check cache first
    const cacheKey = searchCache.generateKey('semantic', req.orgIds, query, limit, threshold);
    const cached = searchCache.get(cacheKey);
    if (cached) {
      log.info(`Cache hit for semantic search: "${query}"`);
      return res.json({ ...cached, fromCache: true });
    }

    const startTime = Date.now();

    // Use embedding service for semantic search
    const searchResult = await embeddingService.semanticSearch(query, limit, { threshold });

    // Re-rank results
    const rerankedResults = embeddingService.reRankResults(searchResult.results || []);

    // Format results
    const results = rerankedResults.map(r => ({
      type: r.source_type,
      id: r.source_id,
      title: r.meeting?.title || r.actionItem?.task_description || 'Unknown',
      preview: r.text_content?.substring(0, 200) || '',
      similarity: r.similarity,
      metadata: {
        sentiment: r.meeting?.sentiment_label,
        date: r.meeting?.created_at || r.actionItem?.created_at
      }
    }));

    const executionTime = Date.now() - startTime;

    // Log search to history
    await logSearch(query, 'semantic', results.length, executionTime, req.user.id);

    const response = {
      query,
      results,
      count: results.length,
      executionTime,
      searchType: searchResult.searchType
    };

    // Cache the results
    searchCache.set(cacheKey, response, CACHE_TTL.SEMANTIC_RESULTS);

    res.json(response);

  } catch (error) {
    log.error('Error in semantic search:', { error: error.message || error });
    res.status(500).json({ error: 'Semantic search failed' });
  }
});

function validAskQuestion(question) {
  return typeof question === 'string' && question.trim().length > 0 && question.length <= 2000;
}

function validAskMeetingIds(ids) {
  return ids == null || (Array.isArray(ids) && ids.length <= 100 &&
    ids.every((id) => typeof id === 'string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)));
}

function meterAsk(req, res, next) {
  const { question, workspaceId, timeZone = 'UTC', comparisonRanges } = req.body || {};
  if (comparisonRanges === undefined && !monthlyRecapMode(question)) return meterAi(req, res, next);
  if (comparisonRanges !== undefined && !validComparisonRanges(comparisonRanges)) {
    return res.status(400).json({ error: 'Choose two valid, non-overlapping ranges with the earlier period first' });
  }
  const orgIds = req.orgIds || [];
  const orgId = workspaceId ?? (orgIds.length === 1 ? orgIds[0] : null);
  if (!orgId) return res.status(400).json({ error: 'Choose a workspace for this question' });
  if (!orgIds.includes(orgId)) return res.status(403).json({ error: 'Workspace access required' });
  try {
    if (typeof timeZone !== 'string' || !timeZone || timeZone.length > 80) throw new Error('Invalid time zone');
    // PostgreSQL and browsers accept IANA time zones. Reject raw offsets.
    if (!/^[a-z][a-z0-9_+\-/]*$/i.test(timeZone)) throw new Error('Invalid time zone');
    const canonicalTimeZone = new Intl.DateTimeFormat('en', { timeZone }).resolvedOptions().timeZone;
    req.monthlyRecapScope = { orgId, timeZone: canonicalTimeZone, comparisonRanges };
  } catch {
    return res.status(400).json({ error: 'Choose a valid time zone for this question' });
  }
  return meterAiForOrg(orgId, res, next);
}

/** POST /api/search/ask */
router.post('/ask', authenticate, meterAsk, async (req, res) => {
  try {
    const { question, conversationId, meetingIds } = req.body;

    if (!validAskQuestion(question)) {
      return res.status(400).json({ error: 'Enter a question of up to 2,000 characters' });
    }
    if (!validAskMeetingIds(meetingIds)) {
      return res.status(400).json({ error: 'Provide up to 100 valid meeting IDs' });
    }

    if (!askService.isReady()) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    const answer = await askService.answerQuestion(question.trim(), {
      conversationId,
      meetingIds,
      monthlyRecapScope: req.monthlyRecapScope,
      userId: req.user.id
    });

    res.json(answer);

  } catch (error) {
    log.error('Error in ask endpoint:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to answer question' });
  }
});

/**
 * POST /api/search/ask/stream
 * Ask AI a question with streaming response (SSE)
 */
router.post('/ask/stream', authenticate, meterAsk, async (req, res) => {
  try {
    const { question, conversationId, meetingIds } = req.body;

    if (!validAskQuestion(question)) {
      return res.status(400).json({ error: 'Enter a question of up to 2,000 characters' });
    }
    if (!validAskMeetingIds(meetingIds)) {
      return res.status(400).json({ error: 'Provide up to 100 valid meeting IDs' });
    }

    if (!askService.isReady()) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial event
    res.write(`data: ${JSON.stringify({ type: 'start', timestamp: Date.now() })}\n\n`);

    // Stream the answer
    await askService.answerQuestionStreaming(question.trim(), {
      conversationId,
      meetingIds,
      monthlyRecapScope: req.monthlyRecapScope,
      userId: req.user.id,
      onChunk: (chunk) => {
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      },
      onCitations: (citations) => {
        res.write(`data: ${JSON.stringify({ type: 'citations', citations })}\n\n`);
      },
      onFollowUp: (suggestions) => {
        res.write(`data: ${JSON.stringify({ type: 'followUp', suggestions })}\n\n`);
      },
      onComplete: (result) => {
        res.write(`data: ${JSON.stringify({ type: 'complete', ...result })}\n\n`);
        res.end();
      },
      onError: (error) => {
        log.error('Error generating Ask answer:', { error: error.message });
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to answer question' })}\n\n`);
        res.end();
      }
    });

  } catch (error) {
    log.error('Error in streaming ask endpoint:', { error: error.message || error });
    if (!res.headersSent) {
      res.status(500).json({ error: 'Streaming failed' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'An error occurred' })}\n\n`);
      res.end();
    }
  }
});

/**
 * POST /api/search/ask/follow-up
 * Ask follow-up question in existing conversation
 */
router.post('/ask/follow-up', authenticate, meterAsk, async (req, res) => {
  try {
    const { question, conversationId } = req.body;

    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID required for follow-up' });
    }

    if (!validAskQuestion(question)) {
      return res.status(400).json({ error: 'Enter a question of up to 2,000 characters' });
    }

    if (!askService.isReady()) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    const answer = await askService.answerQuestion(question.trim(), {
      conversationId, monthlyRecapScope: req.monthlyRecapScope, userId: req.user.id,
    });

    res.json(answer);

  } catch (error) {
    log.error('Follow-up error:', { error: error.message || error });
    res.status(500).json({ error: 'Follow-up failed' });
  }
});

/**
 * GET /api/search/conversations
 * List all conversations
 */
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const conversations = await askService.listConversations(parseInt(limit), req.user.id);

    res.json({ conversations });

  } catch (error) {
    log.error('Error listing conversations:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

/**
 * GET /api/search/conversations/:id
 * Get conversation messages
 */
router.get('/conversations/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const messages = await askService.getConversation(id, req.user.id);

    res.json({ messages });

  } catch (error) {
    log.error('Error fetching conversation:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

/**
 * DELETE /api/search/conversations/:id
 * Delete a conversation
 */
router.delete('/conversations/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    await askService.deleteConversation(id, req.user.id);

    res.json({ success: true });

  } catch (error) {
    log.error('Error deleting conversation:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

/**
 * POST /api/search/everything
 * The one engine behind the ⌘K palette and the Search page. Body:
 * { query, types?: string[], limit?: number (per group, max 25), log?: boolean, meaning?: boolean }.
 * Returns { query, terms, groups: { meetings, decisions, action_items, tasks,
 * projects, notes }, counts, total, engine, executionTime }.
 */
router.post('/everything', authenticate, async (req, res) => {
  try {
    const query = typeof req.body?.query === 'string' ? req.body.query.trim().slice(0, 300) : '';
    if (!query) return res.status(400).json({ error: 'Search query is required' });
    const types = Array.isArray(req.body.types) && req.body.types.length ? req.body.types : undefined;
    const limit = Math.min(Math.max(parseInt(req.body.limit, 10) || 8, 1), 25);

    const startTime = Date.now();
    const result = await searchEverything.search({ query, types, limit, orgIds: req.orgIds, userId: req.user.id, includePassages: true });
    const engine = req.body.meaning === false ? 'words' : await addMeaningMatches(result, query, limit);
    const executionTime = Date.now() - startTime;

    // The palette searches as you type; only the page (or Enter) logs history.
    if (req.body.log === true) await logSearch(query, 'everything', result.total, executionTime, req.user.id);

    res.json({ ...result, engine, executionTime });
  } catch (error) {
    log.error('Error in search everything:', { error: error.message || error });
    res.status(500).json({ error: 'Search failed' });
  }
});

// Whether meaning (vector) search has anything to search. Cached: the nightly
// embeddings job is the only writer.
let embeddingsReady = { value: false, at: 0 };
async function hasEmbeddings() {
  if (Date.now() - embeddingsReady.at < 10 * 60 * 1000) return embeddingsReady.value;
  let value = false;
  try {
    const { count, error } = await supabase.from('embeddings').select('id', { count: 'exact', head: true });
    value = !error && (count || 0) > 0;
  } catch (e) {
    value = false;
  }
  embeddingsReady = { value, at: Date.now() };
  return value;
}

/**
 * When meetings are indexed, add meetings found by meaning that matching words
 * missed. Returns the engine label the UI shows ("words" or "words+meaning").
 */
async function addMeaningMatches(result, query, limit) {
  if (!supabase || !result.groups.meetings || !(await hasEmbeddings())) return 'words';
  try {
    const found = await embeddingService.semanticSearch(query, limit, { threshold: 0.55 });
    if (found.searchType !== 'vector') return 'words';
    const have = new Set(result.groups.meetings.map((m) => m.id));
    for (const r of found.results || []) {
      if (r.source_type !== 'meeting' || have.has(r.source_id) || !r.meeting) continue;
      have.add(r.source_id);
      result.groups.meetings.push({
        type: 'meeting',
        id: r.source_id,
        title: r.meeting.title || 'Untitled meeting',
        titleHits: [],
        snippet: String(r.text_content || '').slice(0, 180),
        snippetHits: [],
        meta: { date: r.meeting.created_at || null, atMs: null, speaker: null, context: [], decisions: [], byMeaning: true },
      });
      result.counts.meetings = (result.counts.meetings || 0) + 1;
      result.total += 1;
    }
    return 'words+meaning';
  } catch (e) {
    log.warn('Meaning search skipped:', e.message);
    return 'words';
  }
}

/**
 * Notes column: GET/POST /api/search/notes, PATCH/DELETE /api/search/notes/:id.
 * Private to the signed-in user (rules in services/searchNotesService.js).
 */
function notesError(res, error, what) {
  if (error instanceof searchNotes.SearchNotesError) return res.status(error.status).json({ error: error.message });
  log.error(`Error ${what} search note:`, { error: error.message || error });
  return res.status(500).json({ error: `Could not ${what} the note` });
}

router.get('/notes', authenticate, async (req, res) => {
  try {
    res.json({ notes: await searchNotes.list(req.user.id, req.orgIds, parseInt(req.query.limit, 10) || 100) });
  } catch (error) { notesError(res, error, 'load'); }
});

router.post('/notes', authenticate, async (req, res) => {
  try {
    const orgId = (req.orgIds && req.orgIds[0]) || await getOrgIdForUser(req.user.id);
    res.status(201).json({ note: await searchNotes.create(req.user.id, orgId, req.body || {}) });
  } catch (error) { notesError(res, error, 'save'); }
});

router.patch('/notes/:id', authenticate, async (req, res) => {
  try {
    res.json({ note: await searchNotes.update(req.user.id, req.orgIds, req.params.id, req.body || {}) });
  } catch (error) { notesError(res, error, 'update'); }
});

router.delete('/notes/:id', authenticate, async (req, res) => {
  try {
    await searchNotes.remove(req.user.id, req.orgIds, req.params.id);
    res.json({ success: true });
  } catch (error) { notesError(res, error, 'delete'); }
});

/**
 * GET /api/search/history
 * Get search history
 */
router.get('/history', authenticate, async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    if (!supabase) {
      return res.json({ history: [] });
    }

    const { data: history, error } = await supabase
      .from('search_history')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (error && error.code !== '42P01') {
      throw error;
    }

    res.json({ history: history || [] });

  } catch (error) {
    log.error('Error fetching history:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

/**
 * DELETE /api/search/history
 * Clear search history
 */
router.delete('/history', authenticate, async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ success: true });
    }

    await supabase.from('search_history').delete().eq('user_id', req.user.id);

    res.json({ success: true });

  } catch (error) {
    log.error('Error clearing history:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to clear history' });
  }
});

/**
 * POST /api/search/save
 * Save a search
 */
router.post('/save', authenticate, async (req, res) => {
  try {
    const { name, query, searchType = 'semantic' } = req.body;

    if (!name || !query) {
      return res.status(400).json({ error: 'Name and query are required' });
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { data, error } = await supabase
      .from('saved_searches')
      .insert({
        name,
        query,
        search_type: searchType,
        user_id: req.user.id
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ saved: data });

  } catch (error) {
    log.error('Error saving search:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to save search' });
  }
});

/**
 * GET /api/search/saved
 * Get saved searches
 */
router.get('/saved', authenticate, async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ saved: [] });
    }

    const { data, error } = await supabase
      .from('saved_searches')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error && error.code !== '42P01') {
      throw error;
    }

    res.json({ saved: data || [] });

  } catch (error) {
    log.error('Error fetching saved searches:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to fetch saved searches' });
  }
});

/**
 * DELETE /api/search/saved/:id
 * Delete a saved search
 */
router.delete('/saved/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.json({ success: true });
    }

    await supabase.from('saved_searches').delete().eq('id', id).eq('user_id', req.user.id);

    res.json({ success: true });

  } catch (error) {
    log.error('Error deleting saved search:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to delete saved search' });
  }
});

/**
 * GET /api/search/recent
 * Get recent searches and activity
 */
router.get('/recent', authenticate, async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ recent: [] });
    }

    // Get recent meetings
    const { data: meetings } = await supabase
      .from('meetings')
      .select('id, title, created_at')
      .in('org_id', req.orgIds)
      .order('created_at', { ascending: false })
      .limit(5);

    // Get recent tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, created_at')
      .in('org_id', req.orgIds)
      .order('created_at', { ascending: false })
      .limit(5);

    const recent = [
      ...(meetings || []).map(m => ({ type: 'meeting', ...m })),
      ...(tasks || []).map(t => ({ type: 'task', ...t }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);

    res.json({ recent });

  } catch (error) {
    log.error('Error getting recent:', { error: error.message || error });
    res.status(500).json({ error: 'Failed to get recent items' });
  }
});

/**
 * Helper: Log search to history
 */
async function logSearch(query, searchType, resultsCount, executionTime, userId) {
  try {
    if (!supabase) return;

    const { error } = await supabase
      .from('search_history')
      .insert({
        query,
        search_type: searchType,
        result_count: resultsCount,
        user_id: userId
      });
    // supabase-js returns errors instead of throwing; surface them (this insert
    // used the wrong column names for months and nobody saw it).
    if (error) log.warn('Could not log search:', error.message);
  } catch (error) {
    // Non-critical, don't throw
    log.warn('Could not log search:', error.message);
  }
}

/**
 * GET /api/search/cache/stats
 * Get cache statistics (for monitoring)
 */
router.get('/cache/stats', authenticate, async (req, res) => {
  try {
    res.json({
      searchCache: searchCache.getStats(),
      suggestionCache: suggestionCache.getStats()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get cache stats' });
  }
});

/**
 * POST /api/search/cache/invalidate
 * Invalidate cache (called when new content is added)
 */
router.post('/cache/invalidate', authenticate, async (req, res) => {
  try {
    const { pattern } = req.body;

    let cleared = 0;
    if (pattern) {
      cleared += searchCache.invalidatePattern(pattern);
      cleared += suggestionCache.invalidatePattern(pattern);
    } else {
      cleared += searchCache.clear();
      cleared += suggestionCache.clear();
    }

    log.info(`Cache invalidated: ${cleared} entries cleared`);
    res.json({ success: true, cleared });
  } catch (error) {
    res.status(500).json({ error: 'Cache invalidation failed' });
  }
});

module.exports = router;
