/**
 * Search Routes
 * Week 6: AI Search & Semantic Assistant
 */

const express = require('express');
const { supabase } = require('../config/supabase');
const ai = require('../config/ai');
const embeddingService = require('../services/embeddingService');
const askService = require('../services/askService');
const { searchCache, suggestionCache, withCache } = require('../utils/cache');
const { authenticate } = require('../middleware/auth');
const log = require('../utils/log');

const router = express.Router();

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
router.post('/', async (req, res) => {
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
    const cacheKey = searchCache.generateKey('keyword', query, types, limit, filters);
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
    await logSearch(query, 'keyword', limitedResults.length, executionTime);

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
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/search/semantic
 * Semantic search using embeddings
 */
router.post('/semantic', async (req, res) => {
  try {
    const { query, limit = 10, threshold = 0.5 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Check cache first
    const cacheKey = searchCache.generateKey('semantic', query, limit, threshold);
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
    await logSearch(query, 'semantic', results.length, executionTime);

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
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/search/ask
 * Ask AI a question about meetings
 */
router.post('/ask', async (req, res) => {
  try {
    const { question, conversationId, meetingIds } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    if (!askService.isReady()) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    const answer = await askService.answerQuestion(question, {
      conversationId,
      meetingIds
    });

    res.json(answer);

  } catch (error) {
    log.error('Error in ask endpoint:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/search/ask/stream
 * Ask AI a question with streaming response (SSE)
 */
router.post('/ask/stream', async (req, res) => {
  try {
    const { question, conversationId, meetingIds } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    if (!askService.isReady()) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial event
    res.write(`data: ${JSON.stringify({ type: 'start', timestamp: Date.now() })}\n\n`);

    // Stream the answer
    await askService.answerQuestionStreaming(question, {
      conversationId,
      meetingIds,
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
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
      }
    });

  } catch (error) {
    log.error('Error in streaming ask endpoint:', { error: error.message || error });
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }
  }
});

/**
 * POST /api/search/ask/follow-up
 * Ask follow-up question in existing conversation
 */
router.post('/ask/follow-up', async (req, res) => {
  try {
    const { question, conversationId } = req.body;

    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID required for follow-up' });
    }

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const answer = await askService.answerQuestion(question, { conversationId });

    res.json(answer);

  } catch (error) {
    log.error('Follow-up error:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/search/conversations
 * List all conversations
 */
router.get('/conversations', async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const conversations = await askService.listConversations(parseInt(limit));

    res.json({ conversations });

  } catch (error) {
    log.error('Error listing conversations:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/search/conversations/:id
 * Get conversation messages
 */
router.get('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const messages = await askService.getConversation(id);

    res.json({ messages });

  } catch (error) {
    log.error('Error fetching conversation:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/search/conversations/:id
 * Delete a conversation
 */
router.delete('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await askService.deleteConversation(id);

    res.json({ success: true });

  } catch (error) {
    log.error('Error deleting conversation:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/search/history
 * Get search history
 */
router.get('/history', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    if (!supabase) {
      return res.json({ history: [] });
    }

    const { data: history, error } = await supabase
      .from('search_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (error && error.code !== '42P01') {
      throw error;
    }

    res.json({ history: history || [] });

  } catch (error) {
    log.error('Error fetching history:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/search/history
 * Clear search history
 */
router.delete('/history', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ success: true });
    }

    await supabase.from('search_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    res.json({ success: true });

  } catch (error) {
    log.error('Error clearing history:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/search/save
 * Save a search
 */
router.post('/save', async (req, res) => {
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
        search_type: searchType
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ saved: data });

  } catch (error) {
    log.error('Error saving search:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/search/saved
 * Get saved searches
 */
router.get('/saved', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ saved: [] });
    }

    const { data, error } = await supabase
      .from('saved_searches')
      .select('*')
      .order('created_at', { ascending: false });

    if (error && error.code !== '42P01') {
      throw error;
    }

    res.json({ saved: data || [] });

  } catch (error) {
    log.error('Error fetching saved searches:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/search/saved/:id
 * Delete a saved search
 */
router.delete('/saved/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.json({ success: true });
    }

    await supabase.from('saved_searches').delete().eq('id', id);

    res.json({ success: true });

  } catch (error) {
    log.error('Error deleting saved search:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/search/suggestions
 * Get search suggestions with autocomplete and trending topics
 */
router.get('/suggestions', authenticate, async (req, res) => {
  try {
    const { prefix, includeTrending = 'true' } = req.query;

    if (!supabase) {
      return res.json({ suggestions: [], trending: [] });
    }

    // Check cache first
    const cacheKey = suggestionCache.generateKey('suggestions', prefix || '', includeTrending);
    const cached = suggestionCache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const suggestions = [];
    let trending = [];

    // 1. Get trending searches (most popular in last 7 days)
    if (includeTrending === 'true') {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const { data: trendingData } = await supabase
        .from('search_history')
        .select('query, results_count')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (trendingData && trendingData.length > 0) {
        // Count query frequency and filter for successful searches
        const queryCounts = {};
        trendingData.forEach(item => {
          const q = item.query.toLowerCase().trim();
          if (!queryCounts[q]) {
            queryCounts[q] = { count: 0, hasResults: false, original: item.query };
          }
          queryCounts[q].count++;
          if (item.results_count > 0) {
            queryCounts[q].hasResults = true;
          }
        });

        // Sort by frequency and filter out zero-result queries
        trending = Object.entries(queryCounts)
          .filter(([_, data]) => data.hasResults && data.count >= 1)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 5)
          .map(([_, data]) => ({
            type: 'trending',
            text: data.original,
            count: data.count
          }));
      }
    }

    // 2. Get recent meeting titles matching prefix
    let meetingQuery = supabase
      .from('meetings')
      .select('title')
      .order('created_at', { ascending: false })
      .limit(8);

    if (prefix && prefix.length > 0) {
      meetingQuery = meetingQuery.ilike('title', `%${prefix}%`);
    }

    const { data: meetings } = await meetingQuery;

    if (meetings) {
      suggestions.push(...meetings.map(m => ({
        type: 'meeting',
        text: m.title,
        icon: 'mic'
      })));
    }

    // 3. Get project names matching prefix
    let projectQuery = supabase
      .from('projects')
      .select('name')
      .order('created_at', { ascending: false })
      .limit(5);

    if (prefix && prefix.length > 0) {
      projectQuery = projectQuery.ilike('name', `%${prefix}%`);
    }

    const { data: projects } = await projectQuery;

    if (projects) {
      suggestions.push(...projects.map(p => ({
        type: 'project',
        text: p.name,
        icon: 'folder'
      })));
    }

    // 4. Get recent user searches matching prefix
    let historyQuery = supabase
      .from('search_history')
      .select('query')
      .order('created_at', { ascending: false })
      .limit(20);

    if (prefix && prefix.length > 0) {
      historyQuery = historyQuery.ilike('query', `%${prefix}%`);
    }

    const { data: history } = await historyQuery;

    if (history) {
      const uniqueQueries = [...new Set(history.map(h => h.query))].slice(0, 5);
      suggestions.push(...uniqueQueries.map(q => ({
        type: 'recent',
        text: q,
        icon: 'clock'
      })));
    }

    // 5. Filter and deduplicate
    const seen = new Set();
    let filtered = suggestions.filter(s => {
      const key = s.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Apply prefix filter if provided
    if (prefix && prefix.length > 0) {
      const lowerPrefix = prefix.toLowerCase();
      filtered = filtered.filter(s =>
        s.text.toLowerCase().includes(lowerPrefix)
      );
    }

    const response = {
      suggestions: filtered.slice(0, 8),
      trending: trending
    };

    // Cache the response
    suggestionCache.set(cacheKey, response, CACHE_TTL.SUGGESTIONS);

    res.json(response);

  } catch (error) {
    log.error('Error getting suggestions:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/search/recent
 * Get recent searches and activity
 */
router.get('/recent', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ recent: [] });
    }

    // Get recent meetings
    const { data: meetings } = await supabase
      .from('meetings')
      .select('id, title, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    // Get recent tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    const recent = [
      ...(meetings || []).map(m => ({ type: 'meeting', ...m })),
      ...(tasks || []).map(t => ({ type: 'task', ...t }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);

    res.json({ recent });

  } catch (error) {
    log.error('Error getting recent:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/search/analytics
 * Get comprehensive search analytics
 */
router.get('/analytics', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ analytics: null });
    }

    const { period = '7d' } = req.query; // '24h', '7d', '30d', 'all'

    // Calculate date range
    let startDate = null;
    const now = new Date();
    switch (period) {
      case '24h':
        startDate = new Date(now - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = null;
    }

    // Base query with optional date filter
    let baseQuery = supabase.from('search_history').select('*');
    if (startDate) {
      baseQuery = baseQuery.gte('created_at', startDate.toISOString());
    }

    const { data: allSearches } = await baseQuery.order('created_at', { ascending: false });
    const searches = allSearches || [];

    // Total searches
    const totalSearches = searches.length;

    // Searches by type
    const searchesByType = {};
    searches.forEach(s => {
      searchesByType[s.search_type] = (searchesByType[s.search_type] || 0) + 1;
    });
    const byTypeArray = Object.entries(searchesByType).map(([type, count]) => ({ type, count }));

    // Average execution time
    const avgExecutionTime = searches.length > 0
      ? Math.round(searches.reduce((sum, s) => sum + (s.execution_time || 0), 0) / searches.length)
      : 0;

    // Top queries
    const queryCounts = {};
    searches.forEach(s => {
      const q = s.query.toLowerCase().trim();
      queryCounts[q] = (queryCounts[q] || 0) + 1;
    });
    const topQueries = Object.entries(queryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    // Zero result queries (results_count = 0)
    const zeroResultQueries = searches
      .filter(s => s.results_count === 0)
      .reduce((acc, s) => {
        const q = s.query.toLowerCase().trim();
        acc[q] = (acc[q] || 0) + 1;
        return acc;
      }, {});
    const zeroResults = Object.entries(zeroResultQueries)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([query, count]) => ({ query, count }));

    // Average results per search
    const avgResultsPerSearch = searches.length > 0
      ? Math.round(searches.reduce((sum, s) => sum + (s.results_count || 0), 0) / searches.length * 10) / 10
      : 0;

    // Success rate (searches with at least 1 result)
    const successfulSearches = searches.filter(s => s.results_count > 0).length;
    const successRate = totalSearches > 0 ? Math.round((successfulSearches / totalSearches) * 100) : 0;

    // Searches over time (group by day)
    const searchesByDay = {};
    searches.forEach(s => {
      const day = new Date(s.created_at).toISOString().split('T')[0];
      searchesByDay[day] = (searchesByDay[day] || 0) + 1;
    });
    const dailyTrend = Object.entries(searchesByDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14) // Last 14 days
      .map(([date, count]) => ({ date, count }));

    // Searches by hour (to find peak usage times)
    const searchesByHour = Array(24).fill(0);
    searches.forEach(s => {
      const hour = new Date(s.created_at).getHours();
      searchesByHour[hour]++;
    });
    const peakHour = searchesByHour.indexOf(Math.max(...searchesByHour));

    res.json({
      analytics: {
        totalSearches,
        searchesByType: byTypeArray,
        avgExecutionTime,
        topQueries,
        zeroResultQueries: zeroResults,
        avgResultsPerSearch,
        successRate,
        dailyTrend,
        peakHour,
        period
      }
    });

  } catch (error) {
    log.error('Error getting analytics:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/search/export
 * Export search results to CSV or JSON
 */
router.post('/export', async (req, res) => {
  try {
    const { results, format = 'csv', query = '', searchType = '' } = req.body;

    if (!results || !Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ error: 'No results to export' });
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `search-results-${timestamp}`;

    if (format === 'json') {
      // Export as JSON
      const exportData = {
        exportedAt: new Date().toISOString(),
        query,
        searchType,
        totalResults: results.length,
        results: results.map(r => ({
          type: r.type,
          title: r.title,
          preview: r.preview || '',
          similarity: r.similarity || null,
          date: r.metadata?.date || null,
          status: r.metadata?.status || null,
          sentiment: r.metadata?.sentiment || null,
          priority: r.metadata?.priority || null
        }))
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      return res.json(exportData);
    }

    // Export as CSV
    const csvRows = [];

    // Header row
    csvRows.push(['Type', 'Title', 'Preview', 'Similarity', 'Date', 'Status', 'Sentiment', 'Priority'].join(','));

    // Data rows
    results.forEach(r => {
      const row = [
        escapeCsvField(r.type || ''),
        escapeCsvField(r.title || ''),
        escapeCsvField((r.preview || '').substring(0, 200)),
        r.similarity ? Math.round(r.similarity * 100) + '%' : '',
        r.metadata?.date ? new Date(r.metadata.date).toLocaleDateString() : '',
        escapeCsvField(r.metadata?.status || ''),
        escapeCsvField(r.metadata?.sentiment || ''),
        escapeCsvField(r.metadata?.priority || '')
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    res.send(csvContent);

  } catch (error) {
    log.error('Error exporting results:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Helper: Escape CSV field
 */
function escapeCsvField(field) {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Helper: Log search to history
 */
async function logSearch(query, searchType, resultsCount, executionTime) {
  try {
    if (!supabase) return;

    await supabase
      .from('search_history')
      .insert({
        query,
        search_type: searchType,
        results_count: resultsCount,
        execution_time: executionTime
      });
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
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/search/cache/invalidate
 * Invalidate cache (called when new content is added)
 */
router.post('/cache/invalidate', async (req, res) => {
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
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
