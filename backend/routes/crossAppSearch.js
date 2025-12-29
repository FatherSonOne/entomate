/**
 * Cross-App Search Routes
 *
 * GET /api/cross-search?q=query - Unified search across all apps
 * GET /api/cross-search/recent - Get recent searches
 * GET /api/cross-search/status - Check hub connection status
 */

const express = require('express');
const router = express.Router();
const crossAppSearch = require('../services/crossAppSearch');
const logger = require('../services/logger');
const { apiLimiter } = require('../middleware/rateLimiter');

/**
 * GET /api/cross-search
 * Unified search across contacts, meetings, deals, and events
 *
 * Query parameters:
 *   q: Search query (required, min 2 chars)
 *   types: Comma-separated types to search (contacts,meetings,events,action_items)
 *   limit: Max results (default 20, max 100)
 */
router.get('/', apiLimiter, async (req, res) => {
  try {
    const { q, types, limit } = req.query;

    // Validate query
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters',
        results: [],
        totalCount: 0
      });
    }

    // Parse options
    const searchTypes = types
      ? types.split(',').map(t => t.trim()).filter(Boolean)
      : ['contacts', 'meetings', 'events', 'action_items'];

    const searchLimit = Math.min(parseInt(limit) || 20, 100);

    // Execute search
    const searchResult = await crossAppSearch.search(q, {
      types: searchTypes,
      limit: searchLimit,
      userId: req.user?.id,
      organizationId: req.user?.organizationId
    });

    // Save to history if user is authenticated
    if (req.user?.id) {
      crossAppSearch.saveSearchToHistory(req.user.id, q, 'cross_app').catch(() => {});
    }

    res.json({
      success: true,
      query: searchResult.query,
      results: searchResult.results,
      grouped: searchResult.grouped,
      totalCount: searchResult.totalCount,
      executionTime: searchResult.executionTime,
      sources: searchResult.sources
    });
  } catch (error) {
    logger.error('[CrossAppSearch] Route error:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed',
      message: error.message
    });
  }
});

/**
 * GET /api/cross-search/recent
 * Get recent searches for the current user
 */
router.get('/recent', async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.json({
        success: true,
        searches: []
      });
    }

    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const recentSearches = await crossAppSearch.getRecentSearches(userId, limit);

    res.json({
      success: true,
      searches: recentSearches
    });
  } catch (error) {
    logger.error('[CrossAppSearch] Recent searches error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recent searches'
    });
  }
});

/**
 * GET /api/cross-search/status
 * Check hub connection status and available sources
 */
router.get('/status', async (req, res) => {
  try {
    const hubConfigured = crossAppSearch.isHubConfigured();

    // Check local database
    let localDbConnected = false;
    try {
      const { supabase } = require('../config/supabase');
      if (supabase) {
        const { error } = await supabase.from('meetings').select('id').limit(1);
        localDbConnected = !error;
      }
    } catch (e) {
      localDbConnected = false;
    }

    const sources = [];

    if (hubConfigured) {
      sources.push({
        name: 'Shared Hub',
        type: 'hub',
        status: 'available',
        provides: ['contacts', 'events', 'companies']
      });
    }

    if (localDbConnected) {
      sources.push({
        name: 'Entomate Local',
        type: 'local',
        status: 'available',
        provides: ['meetings', 'action_items', 'projects', 'tasks']
      });
    }

    res.json({
      success: true,
      hubConfigured,
      localDbConnected,
      sources,
      appMetadata: crossAppSearch.APP_METADATA,
      resultTypes: crossAppSearch.RESULT_TYPES
    });
  } catch (error) {
    logger.error('[CrossAppSearch] Status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check status'
    });
  }
});

/**
 * GET /api/cross-search/suggestions
 * Get search suggestions based on partial input
 */
router.get('/suggestions', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 1) {
      return res.json({
        success: true,
        suggestions: []
      });
    }

    // Perform a quick search for suggestions
    const searchResult = await crossAppSearch.search(q.trim(), {
      types: ['contacts', 'meetings'],
      limit: 5,
      userId: req.user?.id
    });

    // Extract unique suggestion titles
    const suggestions = searchResult.results.map(r => ({
      text: r.title,
      type: r.type,
      id: r.id
    })).slice(0, 5);

    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    logger.error('[CrossAppSearch] Suggestions error:', error);
    res.json({
      success: true,
      suggestions: []
    });
  }
});

module.exports = router;
