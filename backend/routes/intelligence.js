/**
 * Intelligence API Routes
 * Provides endpoints for "Today's Intelligence" morning briefing
 */

const express = require('express');
const router = express.Router();
const intelligenceService = require('../services/intelligenceService');

/**
 * GET /api/intelligence/today
 * Get today's intelligence briefing
 * Returns aggregated data from meetings, action_items, and shared-hub
 */
router.get('/today', async (req, res) => {
  try {
    const { timezone } = req.query;
    const userId = req.user?.id; // From auth middleware if authenticated

    console.log('[Intelligence] Fetching today\'s briefing...');

    const result = await intelligenceService.getTodaysBriefing({
      userId,
      timezone: timezone || 'UTC'
    });

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to generate briefing',
        details: result.error
      });
    }

    console.log('[Intelligence] Briefing generated successfully');

    res.json(result.briefing);
  } catch (error) {
    console.error('[Intelligence] Error fetching briefing:', error);
    res.status(500).json({
      error: 'Failed to fetch today\'s intelligence',
      details: error.message
    });
  }
});

/**
 * GET /api/intelligence/meetings
 * Get today's meetings with context
 */
router.get('/meetings', async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const result = await intelligenceService.getTodaysMeetings(todayStart, todayEnd);

    res.json(result);
  } catch (error) {
    console.error('[Intelligence] Error fetching meetings:', error);
    res.status(500).json({
      error: 'Failed to fetch meetings',
      details: error.message
    });
  }
});

/**
 * GET /api/intelligence/overdue
 * Get overdue action items
 */
router.get('/overdue', async (req, res) => {
  try {
    const result = await intelligenceService.getOverdueActionItems();

    res.json(result);
  } catch (error) {
    console.error('[Intelligence] Error fetching overdue items:', error);
    res.status(500).json({
      error: 'Failed to fetch overdue items',
      details: error.message
    });
  }
});

/**
 * GET /api/intelligence/deals
 * Get deals requiring attention with AI-scored urgency
 */
router.get('/deals', async (req, res) => {
  try {
    const result = await intelligenceService.getDealsRequiringAttention();

    res.json(result);
  } catch (error) {
    console.error('[Intelligence] Error fetching deals:', error);
    res.status(500).json({
      error: 'Failed to fetch deals',
      details: error.message
    });
  }
});

/**
 * GET /api/intelligence/contacts/recent
 * Get contacts synced from Logos CRM in last 24h
 */
router.get('/contacts/recent', async (req, res) => {
  try {
    const result = await intelligenceService.getRecentContacts();

    res.json(result);
  } catch (error) {
    console.error('[Intelligence] Error fetching recent contacts:', error);
    res.status(500).json({
      error: 'Failed to fetch recent contacts',
      details: error.message
    });
  }
});

/**
 * GET /api/intelligence/deadlines
 * Get upcoming deadlines
 */
router.get('/deadlines', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const result = await intelligenceService.getUpcomingDeadlines(parseInt(days));

    res.json(result);
  } catch (error) {
    console.error('[Intelligence] Error fetching deadlines:', error);
    res.status(500).json({
      error: 'Failed to fetch deadlines',
      details: error.message
    });
  }
});

/**
 * GET /api/intelligence/sentiment
 * Get meeting sentiment summary
 */
router.get('/sentiment', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const result = await intelligenceService.getMeetingSentimentSummary(parseInt(days));

    res.json(result);
  } catch (error) {
    console.error('[Intelligence] Error fetching sentiment:', error);
    res.status(500).json({
      error: 'Failed to fetch sentiment summary',
      details: error.message
    });
  }
});

/**
 * POST /api/intelligence/briefing/viewed
 * Mark the briefing as viewed (for tracking engagement)
 */
router.post('/briefing/viewed', async (req, res) => {
  try {
    const userId = req.user?.id;
    const result = await intelligenceService.markBriefingViewed(userId);

    res.json(result);
  } catch (error) {
    console.error('[Intelligence] Error marking briefing viewed:', error);
    res.status(500).json({
      error: 'Failed to mark briefing as viewed',
      details: error.message
    });
  }
});

module.exports = router;
